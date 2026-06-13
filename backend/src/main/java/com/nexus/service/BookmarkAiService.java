package com.nexus.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexus.dto.request.BookmarkAnalyzeRequest;
import com.nexus.dto.response.BookmarkAnalyzeResponse;
import com.nexus.dto.response.BookmarkResponse;
import com.nexus.entity.Bookmark;
import com.nexus.entity.BookmarkSmartGroup;
import com.nexus.mapper.BookmarkMapper;
import dev.langchain4j.model.chat.ChatLanguageModel;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

/**
 * 书签 AI 分析服务，提供单条 URL 的智能解析（归一化、去重检测、AI 标题/描述/标签/分组建议）。
 * AI 分析为可选增强，失败时自动降级为非 AI 模式，不影响核心流程。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class BookmarkAiService {

    private final LlmConfigService llmConfigService;
    private final BookmarkUrlNormalizer urlNormalizer;
    private final BookmarkService bookmarkService;
    private final BookmarkSmartGroupService smartGroupService;
    private final BookmarkMapper bookmarkMapper;
    private final ObjectMapper objectMapper;

    /**
     * 分析单个书签 URL，返回归一化结果、AI 建议（标题/描述/标签/分组）和冲突检测。
     * 不会创建或修改任何书签数据。
     *
     * @param req 包含待分析 URL 和可选标题/标签
     * @return 完整的分析结果，含 AI 建议和冲突信息
     */
    public BookmarkAnalyzeResponse analyze(BookmarkAnalyzeRequest req) {
        // 1. 确定性归一化，移除追踪参数
        BookmarkUrlNormalizer.NormalizeResult normalized = urlNormalizer.normalizeWithDetail(req.getUrl());

        // 2. 检查重复和冲突：按 normalized_url 唯一索引查重
        String duplicateStatus = "none";
        BookmarkResponse conflictCandidate = null;
        Bookmark existing = bookmarkMapper.selectOne(
                new LambdaQueryWrapper<Bookmark>().eq(Bookmark::getNormalizedUrl, normalized.normalizedUrl()));
        if (existing != null) {
            if (req.getTitle() != null && !req.getTitle().isBlank()
                    && existing.getTitle() != null && !req.getTitle().trim().equals(existing.getTitle().trim())) {
                duplicateStatus = "possible_conflict";
                conflictCandidate = BookmarkResponse.from(existing);
            } else {
                duplicateStatus = "exact_duplicate";
            }
        }

        // 3. 确定性分组匹配：基于现有书签标签/域名/URL 规则评估
        List<BookmarkSmartGroup> matchedGroups = smartGroupService.matchGroups(buildTempBookmark(req, normalized));
        List<BookmarkAnalyzeResponse.GroupSuggestion> groupSuggestions = matchedGroups.stream()
                .map(g -> {
                    var gs = new BookmarkAnalyzeResponse.GroupSuggestion();
                    gs.setGroupId(g.getId());
                    gs.setGroupName(g.getName());
                    gs.setMatchReason(g.getMatchMode());
                    return gs;
                }).collect(Collectors.toList());

        // 4. 尝试 AI 分析：失败时降级，保证核心流程不受影响
        boolean aiAvailable = false;
        String suggestedTitle = null;
        String suggestedDescription = null;
        List<String> suggestedTags = null;
        String suggestedGroupName = null;
        String confidence = "medium";

        try {
            ChatLanguageModel model = llmConfigService.resolveModel("inbox");
            aiAvailable = true;

            String prompt = buildBookmarkAnalyzePrompt(req, normalized);
            String response = model.generate(prompt);

            // 安全解析 JSON（先清理 markdown 代码块包裹）
            String jsonStr = stripCodeFence(response);
            JsonNode json = objectMapper.readTree(jsonStr);

            if (json.has("title") && !json.get("title").isNull()) {
                suggestedTitle = json.get("title").asText();
            }
            if (json.has("description") && !json.get("description").isNull()) {
                suggestedDescription = json.get("description").asText();
            }
            if (json.has("tags") && json.get("tags").isArray()) {
                List<String> aiTags = new ArrayList<>();
                json.get("tags").forEach(t -> {
                    if (!t.isNull() && !t.asText().isBlank()) {
                        aiTags.add(t.asText().trim());
                    }
                });
                if (!aiTags.isEmpty()) {
                    suggestedTags = aiTags;
                }
            }
            if (json.has("group_name") && !json.get("group_name").isNull()) {
                suggestedGroupName = json.get("group_name").asText();
            }
            if (json.has("confidence") && !json.get("confidence").isNull()) {
                confidence = json.get("confidence").asText();
            }
        } catch (Exception e) {
            log.warn("Bookmark AI 分析失败，降级为非 AI 模式: {}", e.getMessage());
            // aiAvailable 保持 false，其余 AI 字段为 null
        }

        // 5. 组装响应
        BookmarkAnalyzeResponse resp = new BookmarkAnalyzeResponse();
        resp.setOriginalUrl(req.getUrl());
        resp.setNormalizedUrl(normalized.normalizedUrl());
        resp.setTrackingParamsRemoved(normalized.removedParams());
        resp.setDomain(normalized.domain());
        resp.setDuplicateStatus(duplicateStatus);
        resp.setConflictCandidate(conflictCandidate);
        resp.setAiAvailable(aiAvailable);
        resp.setSuggestedTitle(suggestedTitle);
        resp.setSuggestedDescription(suggestedDescription);
        resp.setSuggestedTags(suggestedTags);
        // AI 无法感知数据库中的分组 ID，只提供分组名称建议
        resp.setSuggestedGroupId(null);
        resp.setSuggestedGroupName(suggestedGroupName);
        resp.setMatchedGroups(groupSuggestions);
        resp.setConfidence(confidence);
        return resp;
    }

    /**
     * 构建一个临时 Bookmark 对象用于分组评估，不写入数据库。
     * 只填充分组匹配所需的字段（URL、标题、标签）。
     */
    private Bookmark buildTempBookmark(BookmarkAnalyzeRequest req, BookmarkUrlNormalizer.NormalizeResult normalized) {
        Bookmark b = new Bookmark();
        b.setUrl(req.getUrl());
        b.setTitle(req.getTitle());
        b.setTags(req.getExistingTags());
        return b;
    }

    /**
     * 构建 AI 分析 prompt，要求 LLM 返回严格 JSON 格式。
     * 中文 prompt，告知 LLM 用户偏好中文标签和描述。
     */
    private String buildBookmarkAnalyzePrompt(BookmarkAnalyzeRequest req, BookmarkUrlNormalizer.NormalizeResult normalized) {
        StringBuilder sb = new StringBuilder();
        sb.append("你是一个书签分析助手。请分析以下网页书签，并以合法 JSON 格式返回分析结果。\n\n");
        sb.append("URL: ").append(req.getUrl()).append("\n");
        sb.append("归一化后 URL: ").append(normalized.normalizedUrl()).append("\n");
        if (normalized.removedParams() != null && !normalized.removedParams().isEmpty()) {
            sb.append("已移除的追踪参数: ").append(String.join(", ", normalized.removedParams())).append("\n");
        }
        if (req.getTitle() != null && !req.getTitle().isBlank()) {
            sb.append("用户提供的标题: ").append(req.getTitle().trim()).append("\n");
        }
        if (req.getExistingTags() != null && !req.getExistingTags().isEmpty()) {
            sb.append("现有标签参考: ").append(String.join(", ", req.getExistingTags())).append("\n");
        }

        sb.append("\n请返回 JSON 对象，包含以下字段：\n");
        sb.append("- title: 建议的书签标题（中文优先，简洁准确）\n");
        sb.append("- description: 简短描述（1-2 句话，中文）\n");
        sb.append("- tags: 字符串数组，3-5 个中文标签\n");
        sb.append("- group_name: 建议的分组名称（可选，中文），如\"技术文章\"、\"设计资源\"\n");
        sb.append("- group_reason: 分组建议的理由（可选）\n");
        sb.append("- confidence: 置信度，取值为 high、medium 或 low\n");
        sb.append("- is_duplicate: 布尔值，是否疑似与常见内容重复\n");
        sb.append("\n只输出 JSON，不要 Markdown 代码块包裹，不要额外说明。");
        return sb.toString();
    }

    /**
     * 清理 LLM 返回的 markdown 代码块包裹（```json ... ``` 或 ``` ... ```）。
     * 与 TranslateStreamingService 中的实现保持一致。
     */
    private String stripCodeFence(String output) {
        String trimmed = output == null ? "" : output.trim();
        if (trimmed.startsWith("```")) {
            return trimmed.replaceFirst("^```(?:json)?\\s*", "").replaceFirst("\\s*```$", "");
        }
        return trimmed;
    }
}
