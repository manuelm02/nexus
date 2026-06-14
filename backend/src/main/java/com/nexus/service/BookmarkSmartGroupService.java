package com.nexus.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.nexus.dto.request.BookmarkGroupPreviewRequest;
import com.nexus.dto.response.BookmarkGroupPreviewResponse;
import com.nexus.entity.Bookmark;
import com.nexus.entity.BookmarkSmartGroup;
import com.nexus.entity.BookmarkSmartGroupAssignment;
import com.nexus.mapper.BookmarkMapper;
import com.nexus.mapper.BookmarkSmartGroupAssignmentMapper;
import com.nexus.mapper.BookmarkSmartGroupMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

/**
 * 书签智能分组服务，管理分组定义、规则评估和书签到分组的自动分配。
 * <p>
 * 分组匹配模式：any_tag（任一标签匹配）、all_tags（全部标签匹配）、
 * domain（域名匹配）、url_pattern（URL 关键词匹配）。
 * matchValue 为逗号分隔的多值字符串，评估时解析为列表。
 */
@Service
@RequiredArgsConstructor
public class BookmarkSmartGroupService {

    private final BookmarkSmartGroupMapper groupMapper;
    private final BookmarkSmartGroupAssignmentMapper assignmentMapper;
    private final BookmarkMapper bookmarkMapper;

    /** 列出全部分组，按 orderIndex 升序排列。 */
    public List<BookmarkSmartGroup> listGroups() {
        return groupMapper.selectList(
                new LambdaQueryWrapper<BookmarkSmartGroup>()
                        .orderByAsc(BookmarkSmartGroup::getOrderIndex));
    }

    /** 根据 ID 获取单个分组。 */
    public BookmarkSmartGroup getGroup(String id) {
        BookmarkSmartGroup group = groupMapper.selectById(id);
        if (group == null) {
            throw new IllegalArgumentException("智能分组不存在: " + id);
        }
        return group;
    }

    /** 创建新的智能分组。 */
    public BookmarkSmartGroup createGroup(String name, String description, String matchMode,
                                           String matchValue, int orderIndex) {
        BookmarkSmartGroup group = new BookmarkSmartGroup();
        group.setName(name);
        group.setDescription(description);
        group.setMatchMode(matchMode);
        group.setMatchValue(matchValue);
        group.setOrderIndex(orderIndex);
        group.setEnabled(true);
        groupMapper.insert(group);
        return group;
    }

    /** 更新分组信息，null 字段表示保持不变。 */
    public BookmarkSmartGroup updateGroup(String id, String name, String description,
                                           String matchMode, String matchValue,
                                           int orderIndex, Boolean enabled) {
        BookmarkSmartGroup group = getGroup(id);
        if (name != null) group.setName(name);
        if (description != null) group.setDescription(description);
        if (matchMode != null) group.setMatchMode(matchMode);
        if (matchValue != null) group.setMatchValue(matchValue);
        if (enabled != null) group.setEnabled(enabled);
        group.setOrderIndex(orderIndex);
        groupMapper.updateById(group);
        return group;
    }

    /**
     * 删除分组及其所有分配记录。
     * ON DELETE CASCADE 由数据库层面保证，此处显式清理以保持逻辑清晰。
     */
    @Transactional
    public void deleteGroup(String id) {
        getGroup(id);
        // 级联删除分配记录
        assignmentMapper.delete(
                new LambdaQueryWrapper<BookmarkSmartGroupAssignment>()
                        .eq(BookmarkSmartGroupAssignment::getGroupId, id));
        groupMapper.deleteById(id);
    }

    /**
     * 评估单个书签是否匹配某个分组的规则。
     *
     * @param group    智能分组定义
     * @param bookmark 待评估的书签
     * @return 是否匹配
     */
    public boolean evaluateGroup(BookmarkSmartGroup group, Bookmark bookmark) {
        if (group.getMatchValue() == null || group.getMatchValue().isBlank()) {
            return false;
        }
        List<String> values = parseMatchValues(group.getMatchValue());

        return switch (group.getMatchMode()) {
            case "any_tag" -> matchesAnyTag(bookmark, values);
            case "all_tags" -> matchesAllTags(bookmark, values);
            case "domain" -> matchesDomain(bookmark, values);
            case "url_pattern" -> matchesUrlPattern(bookmark, values);
            default -> false;
        };
    }

    /**
     * 对单个书签评估所有已启用的分组规则，返回匹配的分组列表。
     *
     * @param bookmark 待评估的书签
     * @return 匹配的分组列表（按 orderIndex 排序）
     */
    public List<BookmarkSmartGroup> matchGroups(Bookmark bookmark) {
        List<BookmarkSmartGroup> enabledGroups = groupMapper.selectList(
                new LambdaQueryWrapper<BookmarkSmartGroup>()
                        .eq(BookmarkSmartGroup::getEnabled, true)
                        .orderByAsc(BookmarkSmartGroup::getOrderIndex));

        return enabledGroups.stream()
                .filter(g -> evaluateGroup(g, bookmark))
                .collect(Collectors.toList());
    }

    /**
     * 预览分组匹配结果，不写入数据库。
     *
     * @param bookmarkIds 待评估的书签 ID 列表
     * @param groupIds    要评估的分组 ID 列表，为 null 则评估所有已启用分组
     * @return Map<groupId, List<bookmarkId>>，只包含有匹配书签的分组
     */
    public Map<String, List<String>> previewGroupMatches(List<String> bookmarkIds, List<String> groupIds) {
        // 加载书签实体
        List<Bookmark> bookmarks = bookmarkMapper.selectBatchIds(bookmarkIds);
        if (bookmarks.isEmpty()) {
            return Collections.emptyMap();
        }

        // 加载要评估的分组
        List<BookmarkSmartGroup> groups;
        if (groupIds != null && !groupIds.isEmpty()) {
            groups = groupMapper.selectBatchIds(groupIds).stream()
                    .filter(g -> Boolean.TRUE.equals(g.getEnabled()))
                    .collect(Collectors.toList());
        } else {
            groups = groupMapper.selectList(
                    new LambdaQueryWrapper<BookmarkSmartGroup>()
                            .eq(BookmarkSmartGroup::getEnabled, true));
        }

        // 按 groupId 收集匹配的 bookmarkId
        Map<String, List<String>> result = new LinkedHashMap<>();
        for (BookmarkSmartGroup group : groups) {
            for (Bookmark bookmark : bookmarks) {
                if (evaluateGroup(group, bookmark)) {
                    result.computeIfAbsent(group.getId(), k -> new ArrayList<>())
                            .add(bookmark.getId());
                }
            }
        }
        return result;
    }

    /**
     * 预览分组匹配结果，返回详细的匹配信息供前端展示。
     * 不写入任何数据库记录。
     *
     * @param req 包含可选 bookmarkIds 和 groupIds 过滤条件
     * @return 按分组组织的预览响应，含匹配书签详情
     */
    public BookmarkGroupPreviewResponse previewGroups(BookmarkGroupPreviewRequest req) {
        // 加载要评估的分组
        List<BookmarkSmartGroup> groups;
        if (req.getGroupIds() != null && !req.getGroupIds().isEmpty()) {
            groups = groupMapper.selectBatchIds(req.getGroupIds()).stream()
                    .filter(g -> Boolean.TRUE.equals(g.getEnabled()))
                    .collect(Collectors.toList());
        } else {
            groups = groupMapper.selectList(
                    new LambdaQueryWrapper<BookmarkSmartGroup>()
                            .eq(BookmarkSmartGroup::getEnabled, true)
                            .orderByAsc(BookmarkSmartGroup::getOrderIndex));
        }

        // 加载要评估的书签
        List<Bookmark> bookmarks;
        if (req.getBookmarkIds() != null && !req.getBookmarkIds().isEmpty()) {
            bookmarks = bookmarkMapper.selectBatchIds(req.getBookmarkIds());
        } else {
            bookmarks = bookmarkMapper.selectList(null);
        }

        // 构建已有分配的快照，用于判断 alreadyAssigned
        Set<String> assignedPairs = new HashSet<>();
        List<BookmarkSmartGroupAssignment> existingAssignments = assignmentMapper.selectList(null);
        for (BookmarkSmartGroupAssignment a : existingAssignments) {
            assignedPairs.add(a.getGroupId() + ":" + a.getBookmarkId());
        }

        // 评估每个分组对每个书签的匹配情况
        BookmarkGroupPreviewResponse resp = new BookmarkGroupPreviewResponse();
        List<BookmarkGroupPreviewResponse.GroupPreview> groupPreviews = new ArrayList<>();

        for (BookmarkSmartGroup group : groups) {
            BookmarkGroupPreviewResponse.GroupPreview gp = new BookmarkGroupPreviewResponse.GroupPreview();
            gp.setGroupId(group.getId());
            gp.setGroupName(group.getName());
            gp.setMatchMode(group.getMatchMode());

            List<BookmarkGroupPreviewResponse.MatchedBookmark> matched = new ArrayList<>();
            for (Bookmark bm : bookmarks) {
                if (evaluateGroup(group, bm)) {
                    BookmarkGroupPreviewResponse.MatchedBookmark mb = new BookmarkGroupPreviewResponse.MatchedBookmark();
                    mb.setBookmarkId(bm.getId());
                    mb.setTitle(bm.getTitle());
                    mb.setUrl(bm.getUrl());
                    // 提取 domain
                    try {
                        java.net.URI uri = new java.net.URI(bm.getUrl());
                        mb.setDomain(uri.getHost());
                    } catch (Exception e) {
                        mb.setDomain(bm.getUrl());
                    }
                    mb.setAlreadyAssigned(assignedPairs.contains(group.getId() + ":" + bm.getId()));
                    matched.add(mb);
                }
            }
            gp.setMatchedCount(matched.size());
            gp.setMatchedBookmarks(matched);
            groupPreviews.add(gp);
        }

        resp.setGroups(groupPreviews);
        return resp;
    }

    /**
     * 应用分组分配：先清除指定分组对指定书签的旧 rule 分配，再重新评估并插入新分配。
     * 仅在事务内执行，保证原子性。
     *
     * @param bookmarkIds 待分配的书签 ID 列表
     * @param groupIds    目标分组 ID 列表
     */
    @Transactional
    public void applyGroupAssignments(List<String> bookmarkIds, List<String> groupIds) {
        // 清除指定分组、指定书签的旧 rule 分配
        assignmentMapper.delete(
                new LambdaQueryWrapper<BookmarkSmartGroupAssignment>()
                        .in(BookmarkSmartGroupAssignment::getGroupId, groupIds)
                        .in(BookmarkSmartGroupAssignment::getBookmarkId, bookmarkIds)
                        .eq(BookmarkSmartGroupAssignment::getAssignSource, "rule"));

        // 加载书签和分组，重新评估
        List<Bookmark> bookmarks = bookmarkMapper.selectBatchIds(bookmarkIds);
        List<BookmarkSmartGroup> groups = groupMapper.selectBatchIds(groupIds).stream()
                .filter(g -> Boolean.TRUE.equals(g.getEnabled()))
                .collect(Collectors.toList());

        for (BookmarkSmartGroup group : groups) {
            for (Bookmark bookmark : bookmarks) {
                if (evaluateGroup(group, bookmark)) {
                    BookmarkSmartGroupAssignment assignment = new BookmarkSmartGroupAssignment();
                    assignment.setGroupId(group.getId());
                    assignment.setBookmarkId(bookmark.getId());
                    assignment.setAssignSource("rule");
                    assignmentMapper.insert(assignment);
                }
            }
        }
    }

    /**
     * 获取指定书签所属的智能分组列表。
     *
     * @param bookmarkId 书签 ID
     * @return 分组列表
     */
    public List<BookmarkSmartGroup> getGroupsForBookmark(String bookmarkId) {
        List<BookmarkSmartGroupAssignment> assignments = assignmentMapper.selectList(
                new LambdaQueryWrapper<BookmarkSmartGroupAssignment>()
                        .eq(BookmarkSmartGroupAssignment::getBookmarkId, bookmarkId));

        if (assignments.isEmpty()) {
            return Collections.emptyList();
        }

        List<String> groupIds = assignments.stream()
                .map(BookmarkSmartGroupAssignment::getGroupId)
                .distinct()
                .collect(Collectors.toList());

        return groupMapper.selectBatchIds(groupIds);
    }

    /**
     * 获取指定分组包含的书签数量。
     *
     * @param groupId 分组 ID
     * @return 书签数量
     */
    public long getBookmarkCount(String groupId) {
        return assignmentMapper.selectCount(
                new LambdaQueryWrapper<BookmarkSmartGroupAssignment>()
                        .eq(BookmarkSmartGroupAssignment::getGroupId, groupId));
    }

    // ==================== 内部辅助方法 ====================

    /** 将逗号分隔的 matchValue 解析为字符串列表，trim 并过滤空串。 */
    private List<String> parseMatchValues(String matchValue) {
        return Arrays.stream(matchValue.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(String::toLowerCase)
                .collect(Collectors.toList());
    }

    /** any_tag 模式：书签标签包含 matchValues 中任意一个即可。 */
    private boolean matchesAnyTag(Bookmark bookmark, List<String> values) {
        if (bookmark.getTags() == null || bookmark.getTags().isEmpty()) {
            return false;
        }
        List<String> lowerTags = bookmark.getTags().stream()
                .map(String::toLowerCase)
                .collect(Collectors.toList());
        return values.stream().anyMatch(lowerTags::contains);
    }

    /** all_tags 模式：书签标签必须包含 matchValues 中全部标签。 */
    private boolean matchesAllTags(Bookmark bookmark, List<String> values) {
        if (bookmark.getTags() == null || bookmark.getTags().isEmpty()) {
            return false;
        }
        List<String> lowerTags = bookmark.getTags().stream()
                .map(String::toLowerCase)
                .collect(Collectors.toList());
        return values.stream().allMatch(lowerTags::contains);
    }

    /** domain 模式：从书签 URL 提取域名，与 matchValues 中任意域名匹配。 */
    private boolean matchesDomain(Bookmark bookmark, List<String> values) {
        String domain = extractDomain(bookmark.getUrl());
        if (domain == null) {
            return false;
        }
        return values.contains(domain.toLowerCase());
    }

    /** url_pattern 模式：书签 URL 中包含 matchValues 中任意关键词（大小写不敏感）。 */
    private boolean matchesUrlPattern(Bookmark bookmark, List<String> values) {
        if (bookmark.getUrl() == null) {
            return false;
        }
        String lowerUrl = bookmark.getUrl().toLowerCase();
        return values.stream().anyMatch(lowerUrl::contains);
    }

    /**
     * 从 URL 中提取域名，与 BookmarkService.extractDomainFallback 逻辑一致。
     * 解析失败时返回 null。
     */
    private String extractDomain(String url) {
        if (url == null || url.isBlank()) {
            return null;
        }
        try {
            java.net.URI uri = new java.net.URI(url.trim());
            String host = uri.getHost();
            return host != null ? host : null;
        } catch (Exception e) {
            return null;
        }
    }
}
