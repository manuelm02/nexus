package com.nexus.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.nexus.dto.request.BookmarkCreateRequest;
import com.nexus.dto.request.BookmarkImportCommitRequest;
import com.nexus.dto.request.BookmarkImportCommitRequest.ImportAction;
import com.nexus.dto.request.BookmarkImportCommitRequest.ImportDecision;
import com.nexus.dto.request.BookmarkImportPreviewRequest;
import com.nexus.dto.request.BookmarkImportPreviewRequest.ImportItem;
import com.nexus.dto.request.BookmarkUpdateRequest;
import com.nexus.dto.response.BookmarkImportCommitResponse;
import com.nexus.dto.response.BookmarkImportPreviewResponse;
import com.nexus.dto.response.BookmarkResponse;
import com.nexus.entity.Bookmark;
import com.nexus.entity.BookmarkSmartGroup;
import com.nexus.entity.BookmarkSmartGroupAssignment;
import com.nexus.mapper.BookmarkMapper;
import com.nexus.mapper.BookmarkSmartGroupAssignmentMapper;
import com.nexus.mapper.BookmarkSmartGroupMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * 书签批量导入服务，提供预览（去重/分析/冲突检测）和确认提交（批量创建/更新/分组分配）功能。
 * 预览阶段不写入数据，commit 阶段在事务内原子执行。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class BookmarkImportService {

    private final BookmarkService bookmarkService;
    private final BookmarkUrlNormalizer urlNormalizer;
    private final BookmarkSmartGroupService smartGroupService;
    private final BookmarkAiService bookmarkAiService;
    private final BookmarkMapper bookmarkMapper;
    private final BookmarkSmartGroupMapper groupMapper;
    private final BookmarkSmartGroupAssignmentMapper assignmentMapper;

    /** 预览结果缓存，key 为 importSessionId，commit 时用于关联原始导入数据 */
    private final Map<String, PreviewSnapshot> previewCache = new ConcurrentHashMap<>();

    /**
     * 预览批量导入：校验 URL、归一化、查重、分类为 create/skip/conflict/invalid。
     * 对 create 和 conflict 项尝试 AI 分析（降级到非 AI 模式），不写入任何数据。
     *
     * @param req 包含待导入的 URL 列表
     * @return 分类后的预览结果，含 AI 建议和冲突信息
     */
    public BookmarkImportPreviewResponse preview(BookmarkImportPreviewRequest req) {
        List<ImportItem> items = req.getItems();

        List<BookmarkImportPreviewResponse.ImportPreviewItem> createItems = new ArrayList<>();
        List<BookmarkImportPreviewResponse.ImportPreviewItem> skipItems = new ArrayList<>();
        List<BookmarkImportPreviewResponse.ConflictPreviewItem> conflictItems = new ArrayList<>();
        List<BookmarkImportPreviewResponse.InvalidPreviewItem> invalidItems = new ArrayList<>();

        // 缓存冲突项的 existingBookmarkId，供 commit 阶段 update 决策使用
        Map<Integer, String> existingBookmarkIds = new ConcurrentHashMap<>();
        // 缓存 AI 建议的分组 ID（sourceIndex -> groupId）
        Map<Integer, String> aiSuggestedGroupIds = new ConcurrentHashMap<>();

        boolean aiAvailable = false;

        for (int i = 0; i < items.size(); i++) {
            ImportItem item = items.get(i);
            int sourceIndex = i;

            // 校验 URL 格式
            if (!isValidUrl(item.getUrl())) {
                var invalid = new BookmarkImportPreviewResponse.InvalidPreviewItem();
                invalid.setSourceIndex(sourceIndex);
                invalid.setUrl(item.getUrl());
                invalid.setTitle(item.getTitle());
                invalid.setReason("URL 格式无效，必须以 http:// 或 https:// 开头");
                invalidItems.add(invalid);
                continue;
            }

            // 归一化 URL
            BookmarkUrlNormalizer.NormalizeResult normalized;
            try {
                normalized = urlNormalizer.normalizeWithDetail(item.getUrl());
            } catch (Exception e) {
                var invalid = new BookmarkImportPreviewResponse.InvalidPreviewItem();
                invalid.setSourceIndex(sourceIndex);
                invalid.setUrl(item.getUrl());
                invalid.setTitle(item.getTitle());
                invalid.setReason("URL 解析失败: " + e.getMessage());
                invalidItems.add(invalid);
                continue;
            }

            // 查重
            Bookmark existing = bookmarkMapper.selectOne(
                    new LambdaQueryWrapper<Bookmark>().eq(Bookmark::getNormalizedUrl, normalized.normalizedUrl()));

            if (existing != null) {
                existingBookmarkIds.put(sourceIndex, existing.getId());
                // 标题相同 → 跳过；标题不同 → 冲突
                if (item.getTitle() != null && !item.getTitle().isBlank()
                        && existing.getTitle() != null
                        && !item.getTitle().trim().equals(existing.getTitle().trim())) {
                    var conflict = new BookmarkImportPreviewResponse.ConflictPreviewItem();
                    conflict.setSourceIndex(sourceIndex);
                    conflict.setUrl(item.getUrl());
                    conflict.setTitle(item.getTitle());
                    conflict.setNormalizedUrl(normalized.normalizedUrl());
                    conflict.setExistingBookmarkId(existing.getId());
                    conflict.setExistingTitle(existing.getTitle());
                    conflict.setExistingUrl(existing.getUrl());
                    conflict.setAiAvailable(false);
                    conflictItems.add(conflict);
                } else {
                    var skip = new BookmarkImportPreviewResponse.ImportPreviewItem();
                    skip.setSourceIndex(sourceIndex);
                    skip.setUrl(item.getUrl());
                    skip.setTitle(item.getTitle());
                    skip.setNormalizedUrl(normalized.normalizedUrl());
                    skip.setDomain(normalized.domain());
                    skip.setAiAvailable(false);
                    skipItems.add(skip);
                }
            } else {
                // 不存在的 URL → 创建候选
                var create = new BookmarkImportPreviewResponse.ImportPreviewItem();
                create.setSourceIndex(sourceIndex);
                create.setUrl(item.getUrl());
                create.setTitle(item.getTitle());
                create.setNormalizedUrl(normalized.normalizedUrl());
                create.setDomain(normalized.domain());
                // AI 分析（可选，不阻塞预览）
                tryEnrichWithAi(create, item.getTitle(), aiSuggestedGroupIds, sourceIndex);
                if (!aiAvailable && create.isAiAvailable()) {
                    aiAvailable = true;
                }
                createItems.add(create);
            }
        }

        // 对冲突项也尝试 AI 判定
        for (var conflict : conflictItems) {
            tryEnrichConflictWithAi(conflict);
        }

        // 构造汇总统计
        var summary = new BookmarkImportPreviewResponse.ImportSummary();
        summary.setTotalCount(items.size());
        summary.setCreateCount(createItems.size());
        summary.setSkipCount(skipItems.size());
        summary.setConflictCount(conflictItems.size());
        summary.setInvalidCount(invalidItems.size());

        // 生成预览会话 ID 并缓存
        String sessionId = UUID.randomUUID().toString();
        previewCache.put(sessionId, new PreviewSnapshot(items, existingBookmarkIds, aiSuggestedGroupIds));

        var resp = new BookmarkImportPreviewResponse();
        resp.setImportSessionId(sessionId);
        resp.setSummary(summary);
        resp.setCreateItems(createItems);
        resp.setSkipItems(skipItems);
        resp.setConflictItems(conflictItems);
        resp.setInvalidItems(invalidItems);
        return resp;
    }

    /**
     * 根据用户决策提交批量导入，在事务内执行创建/更新/跳过操作。
     * 完成数据写入后自动应用确定性规则分组匹配。
     *
     * @param req 包含 importSessionId 和逐项决策列表
     * @return 各操作计数及新建书签 ID 列表
     */
    @Transactional
    public BookmarkImportCommitResponse commit(BookmarkImportCommitRequest req) {
        PreviewSnapshot snapshot = previewCache.remove(req.getImportSessionId());
        if (snapshot == null) {
            throw new IllegalArgumentException("预览会话已过期或不存在，请重新预览");
        }

        int createdCount = 0;
        int updatedCount = 0;
        int skippedCount = 0;
        List<String> createdBookmarkIds = new ArrayList<>();

        // 收集新创建书签 ID 以便后续分组分配
        List<String> newBookmarkIdsForGroup = new ArrayList<>();
        // 收集 AI 建议的分组分配（bookmarkId -> groupId，assignSource=ai）
        List<AiGroupPair> aiAssignments = new ArrayList<>();

        for (ImportDecision decision : req.getDecisions()) {
            int sourceIndex = decision.getSourceIndex();

            if (decision.getAction() == ImportAction.create) {
                ImportItem item = snapshot.getItems(sourceIndex);
                if (item == null) {
                    log.warn("Commit create: sourceIndex={} 对应的原始数据不存在，跳过", sourceIndex);
                    skippedCount++;
                    continue;
                }

                BookmarkCreateRequest createReq = new BookmarkCreateRequest();
                createReq.setUrl(item.getUrl());
                createReq.setTitle(decision.getFinalTitle() != null ? decision.getFinalTitle() : item.getTitle());
                createReq.setTags(decision.getFinalTags());
                createReq.setDescription(decision.getFinalDescription());

                BookmarkResponse created = bookmarkService.create(createReq);
                createdBookmarkIds.add(created.getId());
                createdCount++;
                newBookmarkIdsForGroup.add(created.getId());

                // 如果用户接受 AI 建议分组，记录待分配
                if (decision.isAcceptSuggestedGroup()) {
                    String aiGroupId = snapshot.getAiSuggestedGroupId(sourceIndex);
                    if (aiGroupId != null) {
                        aiAssignments.add(new AiGroupPair(created.getId(), aiGroupId));
                    }
                }
            } else if (decision.getAction() == ImportAction.update) {
                String existingId = snapshot.getExistingBookmarkId(sourceIndex);
                if (existingId == null) {
                    log.warn("Commit update: sourceIndex={} 对应的冲突书签不存在，跳过", sourceIndex);
                    skippedCount++;
                    continue;
                }

                BookmarkUpdateRequest updateReq = new BookmarkUpdateRequest();
                updateReq.setTitle(decision.getFinalTitle());
                if (decision.getFinalTags() != null) {
                    updateReq.setTags(decision.getFinalTags());
                }
                if (decision.getFinalDescription() != null) {
                    updateReq.setDescription(decision.getFinalDescription());
                }

                bookmarkService.update(existingId, updateReq);
                updatedCount++;
            } else {
                // skip
                skippedCount++;
            }
        }

        // 对新创建的书签应用确定性规则分组匹配
        if (!newBookmarkIdsForGroup.isEmpty()) {
            applyRuleBasedGroups(newBookmarkIdsForGroup);
        }

        // 对接受 AI 建议分组的新书签插入 ai 来源的分配记录
        // 避免重复分配：只插入该 bookmarkId+groupId 组合尚不存在的记录
        for (AiGroupPair pair : aiAssignments) {
            Long exists = assignmentMapper.selectCount(
                    new LambdaQueryWrapper<BookmarkSmartGroupAssignment>()
                            .eq(BookmarkSmartGroupAssignment::getBookmarkId, pair.bookmarkId)
                            .eq(BookmarkSmartGroupAssignment::getGroupId, pair.groupId));
            if (exists == 0) {
                BookmarkSmartGroupAssignment assignment = new BookmarkSmartGroupAssignment();
                assignment.setGroupId(pair.groupId);
                assignment.setBookmarkId(pair.bookmarkId);
                assignment.setAssignSource("ai");
                assignmentMapper.insert(assignment);
            }
        }

        var resp = new BookmarkImportCommitResponse();
        resp.setCreatedCount(createdCount);
        resp.setUpdatedCount(updatedCount);
        resp.setSkippedCount(skippedCount);
        resp.setCreatedBookmarkIds(createdBookmarkIds);
        return resp;
    }

    /**
     * 对新创建的书签执行确定性规则分组匹配并写入分配记录。
     */
    private void applyRuleBasedGroups(List<String> newBookmarkIds) {
        List<Bookmark> newBookmarks = bookmarkMapper.selectBatchIds(newBookmarkIds);
        List<BookmarkSmartGroup> enabledGroups = groupMapper.selectList(
                new LambdaQueryWrapper<BookmarkSmartGroup>()
                        .eq(BookmarkSmartGroup::getEnabled, true));

        for (BookmarkSmartGroup group : enabledGroups) {
            for (Bookmark bookmark : newBookmarks) {
                if (smartGroupService.evaluateGroup(group, bookmark)) {
                    // 避免重复插入
                    Long exists = assignmentMapper.selectCount(
                            new LambdaQueryWrapper<BookmarkSmartGroupAssignment>()
                                    .eq(BookmarkSmartGroupAssignment::getBookmarkId, bookmark.getId())
                                    .eq(BookmarkSmartGroupAssignment::getGroupId, group.getId()));
                    if (exists == 0) {
                        BookmarkSmartGroupAssignment assignment = new BookmarkSmartGroupAssignment();
                        assignment.setGroupId(group.getId());
                        assignment.setBookmarkId(bookmark.getId());
                        assignment.setAssignSource("rule");
                        assignmentMapper.insert(assignment);
                    }
                }
            }
        }
    }

    /**
     * 尝试对创建候选项进行 AI 分析，填入建议的标题/描述/标签/分组。
     * 失败时静默降级，不影响预览流程。
     */
    private void tryEnrichWithAi(BookmarkImportPreviewResponse.ImportPreviewItem item, String originalTitle,
                                  Map<Integer, String> aiSuggestedGroupIds, int sourceIndex) {
        try {
            var analyzeReq = new com.nexus.dto.request.BookmarkAnalyzeRequest();
            analyzeReq.setUrl(item.getUrl());
            analyzeReq.setTitle(originalTitle);
            var analyzeResp = bookmarkAiService.analyze(analyzeReq);

            if (analyzeResp.isAiAvailable()) {
                item.setAiAvailable(true);
                item.setSuggestedTitle(analyzeResp.getSuggestedTitle());
                item.setSuggestedDescription(analyzeResp.getSuggestedDescription());
                item.setSuggestedTags(analyzeResp.getSuggestedTags());
                item.setSuggestedGroupName(analyzeResp.getSuggestedGroupName());
                // 尝试将 AI 建议的分组名匹配到已有分组 ID
                if (analyzeResp.getSuggestedGroupName() != null) {
                    String matchedId = findGroupIdByName(analyzeResp.getSuggestedGroupName());
                    item.setSuggestedGroupId(matchedId);
                    if (matchedId != null) {
                        aiSuggestedGroupIds.put(sourceIndex, matchedId);
                    }
                }
            }
        } catch (Exception e) {
            log.debug("导入预览 AI 分析失败，忽略: {}", e.getMessage());
        }
    }

    /**
     * 尝试对冲突项进行 AI 判定，提供冲突判定建议。
     * 失败时静默降级。
     */
    private void tryEnrichConflictWithAi(BookmarkImportPreviewResponse.ConflictPreviewItem conflict) {
        try {
            var analyzeReq = new com.nexus.dto.request.BookmarkAnalyzeRequest();
            analyzeReq.setUrl(conflict.getUrl());
            analyzeReq.setTitle(conflict.getTitle());
            var analyzeResp = bookmarkAiService.analyze(analyzeReq);
            conflict.setAiAvailable(analyzeResp.isAiAvailable());
        } catch (Exception e) {
            log.debug("冲突项 AI 分析失败，忽略: {}", e.getMessage());
        }
    }

    /**
     * 根据分组名查找已有分组的 ID，大小写不敏感匹配。
     *
     * @param groupName 分组名称
     * @return 匹配的分组 ID，未找到返回 null
     */
    private String findGroupIdByName(String groupName) {
        if (groupName == null || groupName.isBlank()) {
            return null;
        }
        List<BookmarkSmartGroup> groups = groupMapper.selectList(
                new LambdaQueryWrapper<BookmarkSmartGroup>()
                        .eq(BookmarkSmartGroup::getEnabled, true));
        String lowerName = groupName.trim().toLowerCase();
        for (BookmarkSmartGroup group : groups) {
            if (group.getName() != null && group.getName().toLowerCase().equals(lowerName)) {
                return group.getId();
            }
        }
        return null;
    }

    /**
     * URL 格式校验：必须为合法的 http/https URL。
     */
    private boolean isValidUrl(String url) {
        if (url == null || url.isBlank()) {
            return false;
        }
        String trimmed = url.trim();
        if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
            return false;
        }
        try {
            URI uri = new URI(trimmed);
            return uri.getHost() != null;
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * 预览阶段内部快照，保存原始导入数据和冲突/分组映射，供 commit 阶段使用。
     */
    private static class PreviewSnapshot {
        private final List<ImportItem> items;
        private final Map<Integer, String> existingBookmarkIds;
        private final Map<Integer, String> aiSuggestedGroupIds;

        PreviewSnapshot(List<ImportItem> items, Map<Integer, String> existingBookmarkIds,
                        Map<Integer, String> aiSuggestedGroupIds) {
            this.items = Collections.unmodifiableList(new ArrayList<>(items));
            this.existingBookmarkIds = Collections.unmodifiableMap(existingBookmarkIds);
            this.aiSuggestedGroupIds = Collections.unmodifiableMap(aiSuggestedGroupIds);
        }

        ImportItem getItems(int sourceIndex) {
            if (sourceIndex < 0 || sourceIndex >= items.size()) {
                return null;
            }
            return items.get(sourceIndex);
        }

        String getExistingBookmarkId(int sourceIndex) {
            return existingBookmarkIds.get(sourceIndex);
        }

        String getAiSuggestedGroupId(int sourceIndex) {
            return aiSuggestedGroupIds.get(sourceIndex);
        }
    }

    /** AI 建议分组分配的临时数据结构 */
    private record AiGroupPair(String bookmarkId, String groupId) {
    }
}
