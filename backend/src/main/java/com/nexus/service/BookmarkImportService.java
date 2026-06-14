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
import java.util.LinkedHashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
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
    /** 导入时自动生成的智能分组数量上限，避免把标签体系膨胀复制成分组体系 */
    private static final int AUTO_GROUP_LIMIT = 3;
    /** 标签至少覆盖两个新导入书签才会升级为智能分组，避免为偶发细标签建组 */
    private static final int AUTO_GROUP_MIN_BOOKMARKS = 2;

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
        // 缓存 AI 建议的主分组名，即使当前还没有同名分组也会在 commit 阶段用于自动建组
        Map<Integer, String> aiSuggestedGroupNames = new ConcurrentHashMap<>();

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
                tryEnrichWithAi(create, item.getTitle(), aiSuggestedGroupIds, aiSuggestedGroupNames, sourceIndex);
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
        previewCache.put(sessionId, new PreviewSnapshot(items, existingBookmarkIds, aiSuggestedGroupIds, aiSuggestedGroupNames));

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
        // 收集本次导入最终标签，用于创建少量高覆盖智能分组，而不是一标签一组
        Map<String, List<String>> importedTagBookmarkIds = new LinkedHashMap<>();
        // 收集 AI 主分组建议，用主分组控制数量，再用标签集合作为后续匹配规则
        List<ImportedBookmarkGrouping> importedGroupings = new ArrayList<>();
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
                collectImportedTags(importedTagBookmarkIds, created.getId(), decision.getFinalTags());
                importedGroupings.add(new ImportedBookmarkGrouping(
                        created.getId(),
                        decision.getFinalTags(),
                        snapshot.getAiSuggestedGroupName(sourceIndex)));

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
            boolean createdAiGroups = createCompactGroupsFromAiSuggestions(importedGroupings);
            if (!createdAiGroups) {
                createCompactGroupsFromImportedTags(importedTagBookmarkIds);
            }
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
     * 优先使用 AI 给出的主分组名创建少量分组。
     * 分组名负责收敛数量，matchValue 使用组内标签集合，避免把不可匹配的抽象名称写成规则值。
     */
    private boolean createCompactGroupsFromAiSuggestions(List<ImportedBookmarkGrouping> importedGroupings) {
        if (importedGroupings.isEmpty()) {
            return false;
        }

        List<BookmarkSmartGroup> existingGroups = groupMapper.selectList(
                new LambdaQueryWrapper<BookmarkSmartGroup>()
                        .eq(BookmarkSmartGroup::getEnabled, true));
        Set<String> existingNames = existingGroups.stream()
                .map(BookmarkSmartGroup::getName)
                .filter(name -> name != null && !name.isBlank())
                .map(name -> name.trim().toLowerCase())
                .collect(Collectors.toSet());

        Map<String, AiImportGroupCandidate> candidatesByName = new LinkedHashMap<>();
        for (ImportedBookmarkGrouping grouping : importedGroupings) {
            String groupName = normalizeText(grouping.groupName());
            if (groupName == null) {
                continue;
            }
            String key = groupName.toLowerCase();
            AiImportGroupCandidate candidate = candidatesByName.computeIfAbsent(
                    key,
                    ignored -> new AiImportGroupCandidate(groupName, candidatesByName.size()));
            candidate.bookmarkIds.add(grouping.bookmarkId());
            addTags(candidate.matchTags, grouping.tags());
        }

        List<AiImportGroupCandidate> candidates = candidatesByName.entrySet().stream()
                .filter(entry -> !existingNames.contains(entry.getKey()))
                .map(Map.Entry::getValue)
                .filter(candidate -> !candidate.bookmarkIds.isEmpty() && !candidate.matchTags.isEmpty())
                .sorted((a, b) -> {
                    int coverage = Integer.compare(b.bookmarkIds.size(), a.bookmarkIds.size());
                    return coverage != 0 ? coverage : Integer.compare(a.firstOrder, b.firstOrder);
                })
                .limit(AUTO_GROUP_LIMIT)
                .toList();

        int nextOrderIndex = existingGroups.size();
        for (AiImportGroupCandidate candidate : candidates) {
            BookmarkSmartGroup group = new BookmarkSmartGroup();
            group.setId(UUID.randomUUID().toString());
            group.setName(candidate.name);
            group.setDescription("导入时根据 AI 主分组自动创建，覆盖 " + candidate.bookmarkIds.size() + " 个新书签");
            group.setMatchMode("any_tag");
            group.setMatchValue(candidate.matchTags.stream().limit(8).collect(Collectors.joining(",")));
            group.setOrderIndex(nextOrderIndex++);
            group.setEnabled(true);
            groupMapper.insert(group);

            for (String bookmarkId : candidate.bookmarkIds) {
                BookmarkSmartGroupAssignment assignment = new BookmarkSmartGroupAssignment();
                assignment.setGroupId(group.getId());
                assignment.setBookmarkId(bookmarkId);
                assignment.setAssignSource("ai_import");
                assignmentMapper.insert(assignment);
            }
        }
        return !candidates.isEmpty();
    }

    /**
     * 收集单个导入书签最终保存的标签，单个书签内标签去重后再计数。
     */
    private void collectImportedTags(Map<String, List<String>> tagBookmarkIds, String bookmarkId, List<String> tags) {
        if (bookmarkId == null || tags == null || tags.isEmpty()) {
            return;
        }
        Set<String> seenInBookmark = new java.util.LinkedHashSet<>();
        for (String tag : tags) {
            String normalized = tag == null ? "" : tag.trim();
            if (normalized.isEmpty() || !seenInBookmark.add(normalized)) {
                continue;
            }
            tagBookmarkIds.computeIfAbsent(normalized, key -> new ArrayList<>()).add(bookmarkId);
        }
    }

    /**
     * 把一组标签清洗后加入目标集合，用 LinkedHashSet 保留 AI 输出的优先顺序。
     */
    private void addTags(LinkedHashSet<String> target, List<String> tags) {
        if (tags == null) {
            return;
        }
        for (String tag : tags) {
            String normalized = normalizeText(tag);
            if (normalized != null) {
                target.add(normalized);
            }
        }
    }

    /**
     * 统一清洗 AI 输出和用户提交文本，空字符串返回 null 便于调用方跳过。
     */
    private String normalizeText(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    /**
     * 从本次导入的 AI 标签中自动创建少量智能分组。
     * 只取覆盖新书签数最高的标签，且至少覆盖 2 个新书签，避免分组数量退化成标签数量。
     */
    private void createCompactGroupsFromImportedTags(Map<String, List<String>> tagBookmarkIds) {
        if (tagBookmarkIds.isEmpty()) {
            return;
        }

        List<BookmarkSmartGroup> existingGroups = groupMapper.selectList(
                new LambdaQueryWrapper<BookmarkSmartGroup>()
                        .eq(BookmarkSmartGroup::getEnabled, true));
        Set<String> existingNames = existingGroups.stream()
                .map(BookmarkSmartGroup::getName)
                .filter(name -> name != null && !name.isBlank())
                .map(String::trim)
                .map(String::toLowerCase)
                .collect(Collectors.toSet());
        Set<String> existingAnyTagValues = existingGroups.stream()
                .filter(group -> "any_tag".equals(group.getMatchMode()))
                .map(BookmarkSmartGroup::getMatchValue)
                .filter(value -> value != null && !value.isBlank())
                .map(String::trim)
                .map(String::toLowerCase)
                .collect(Collectors.toSet());

        List<Map.Entry<String, List<String>>> candidates = tagBookmarkIds.entrySet().stream()
                .filter(entry -> entry.getValue().size() >= AUTO_GROUP_MIN_BOOKMARKS)
                .filter(entry -> !existingNames.contains(entry.getKey().toLowerCase()))
                .filter(entry -> !existingAnyTagValues.contains(entry.getKey().toLowerCase()))
                .sorted((a, b) -> Integer.compare(b.getValue().size(), a.getValue().size()))
                .limit(AUTO_GROUP_LIMIT)
                .toList();

        int nextOrderIndex = existingGroups.size();
        for (Map.Entry<String, List<String>> candidate : candidates) {
            BookmarkSmartGroup group = new BookmarkSmartGroup();
            group.setId(UUID.randomUUID().toString());
            group.setName(candidate.getKey());
            group.setDescription("导入时根据 AI 标签自动创建，覆盖 " + candidate.getValue().size() + " 个新书签");
            group.setMatchMode("any_tag");
            group.setMatchValue(candidate.getKey());
            group.setOrderIndex(nextOrderIndex++);
            group.setEnabled(true);
            groupMapper.insert(group);

            for (String bookmarkId : candidate.getValue()) {
                BookmarkSmartGroupAssignment assignment = new BookmarkSmartGroupAssignment();
                assignment.setGroupId(group.getId());
                assignment.setBookmarkId(bookmarkId);
                assignment.setAssignSource("ai_import");
                assignmentMapper.insert(assignment);
            }
        }
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
                                  Map<Integer, String> aiSuggestedGroupIds,
                                  Map<Integer, String> aiSuggestedGroupNames,
                                  int sourceIndex) {
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
                String suggestedGroupName = normalizeText(analyzeResp.getSuggestedGroupName());
                if (suggestedGroupName != null) {
                    aiSuggestedGroupNames.put(sourceIndex, suggestedGroupName);
                    String matchedId = findGroupIdByName(suggestedGroupName);
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
        private final Map<Integer, String> aiSuggestedGroupNames;

        PreviewSnapshot(List<ImportItem> items, Map<Integer, String> existingBookmarkIds,
                        Map<Integer, String> aiSuggestedGroupIds,
                        Map<Integer, String> aiSuggestedGroupNames) {
            this.items = Collections.unmodifiableList(new ArrayList<>(items));
            this.existingBookmarkIds = Collections.unmodifiableMap(existingBookmarkIds);
            this.aiSuggestedGroupIds = Collections.unmodifiableMap(aiSuggestedGroupIds);
            this.aiSuggestedGroupNames = Collections.unmodifiableMap(aiSuggestedGroupNames);
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

        String getAiSuggestedGroupName(int sourceIndex) {
            return aiSuggestedGroupNames.get(sourceIndex);
        }
    }

    /** AI 建议分组分配的临时数据结构 */
    private record AiGroupPair(String bookmarkId, String groupId) {
    }

    /** 导入书签用于自动建组的轻量快照 */
    private record ImportedBookmarkGrouping(String bookmarkId, List<String> tags, String groupName) {
    }

    /** AI 主分组聚合候选，使用可变集合减少中间对象创建 */
    private static class AiImportGroupCandidate {
        private final String name;
        private final int firstOrder;
        private final List<String> bookmarkIds = new ArrayList<>();
        private final LinkedHashSet<String> matchTags = new LinkedHashSet<>();

        private AiImportGroupCandidate(String name, int firstOrder) {
            this.name = name;
            this.firstOrder = firstOrder;
        }
    }
}
