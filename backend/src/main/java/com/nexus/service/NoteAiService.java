package com.nexus.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexus.dto.request.NoteAnalyzeRequest;
import com.nexus.dto.response.NoteAnalyzeResponse;
import com.nexus.dto.response.NoteAnalyzeResponse.ActionItem;
import com.nexus.dto.response.NoteTagEntryResponse;
import com.nexus.dto.response.NoteTagSuggestionResponse;
import dev.langchain4j.model.chat.ChatLanguageModel;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * 笔记 AI 分析服务，调用 LLM 对笔记内容进行智能分析，
 * 生成建议标题、类型、标签（恰好 1 个）、分类、文件夹、清洗后 Markdown 及待办项。
 * LLM 不可用时降级返回原始内容，不影响业务流程。
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class NoteAiService {

    private final LlmConfigService llmConfigService;
    private final InboxSettingsService inboxSettingsService;
    private final NoteTagIndexService noteTagIndexService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    /** 从 LLM 响应中提取 JSON 的正则 */
    private static final Pattern JSON_BLOCK_PATTERN = Pattern.compile(
            "```(?:json)?\\s*\\n?([\\s\\S]*?)```");

    /**
     * 分析笔记内容，返回 AI 建议的元数据和清洗后的 Markdown。
     * 不写入任何文件，纯分析操作。
     *
     * @param req 包含笔记 title、content、kind、tags
     * @return AI 分析结果
     */
    public NoteAnalyzeResponse analyze(NoteAnalyzeRequest req) {
        NoteAnalyzeResponse resp = new NoteAnalyzeResponse();
        resp.setAiAvailable(false);

        // 标签索引：AI 打标签时优先复用，最终标签恰好 1 个
        List<NoteTagEntryResponse> existingTags = noteTagIndexService.listTags(req.getKind());

        // 1. LLM 可用性检查
        if (!inboxSettingsService.isInboxAiAvailable()) {
            resp.setSuggestedTitle(req.getTitle());
            resp.setSuggestedKind(req.getKind());
            resp.setSuggestedTags(capTags(req.getTags()));
            resp.setNewTagDescriptions(Map.of());
            return resp;
        }

        // 2. 调用 LLM 分析
        try {
            ChatLanguageModel model = llmConfigService.resolveModel("inbox");
            String prompt = buildNoteAnalyzePrompt(req, existingTags);
            String response = model.generate(prompt);

            log.debug("LLM 分析原始响应长度: {}", response.length());

            String jsonStr = extractJson(response);
            Map<String, Object> result = objectMapper.readValue(jsonStr,
                    new TypeReference<Map<String, Object>>() {});

            resp.setAiAvailable(true);

            // 解析各字段
            resp.setSuggestedTitle(getString(result, "title", req.getTitle()));
            resp.setSuggestedKind(getString(result, "kind", req.getKind()));
            resp.setSuggestedCategory(getString(result, "category", null));
            resp.setSuggestedFolder(getString(result, "folder", null));
            resp.setCleanedMarkdown(getString(result, "cleaned_markdown", null));
            resp.setConfidence(getString(result, "confidence", null));

            // 解析 tags，最终数量限制为恰好 1 个（截断多余项），与"单标签机制"保持一致
            Object tagsObj = result.get("tags");
            List<String> tags;
            if (tagsObj instanceof List<?> tagsList) {
                tags = new ArrayList<>();
                for (Object tag : tagsList) {
                    if (tag != null) tags.add(tag.toString());
                }
                if (tags.isEmpty()) tags = req.getTags();
            } else {
                tags = req.getTags();
            }
            resp.setSuggestedTags(capTags(tags));

            // 解析 new_tags：仅保留索引中尚不存在的标签及其说明，随保存请求写回索引
            Set<String> existingNames = existingTags.stream()
                    .map(NoteTagEntryResponse::getName)
                    .collect(Collectors.toSet());
            Map<String, String> newTagDescriptions = new LinkedHashMap<>();
            Object newTagsObj = result.get("new_tags");
            if (newTagsObj instanceof List<?> newTagsList) {
                for (Object item : newTagsList) {
                    if (item instanceof Map<?, ?> tagMap) {
                        Object name = tagMap.get("name");
                        Object description = tagMap.get("description");
                        if (name != null && !existingNames.contains(name.toString())) {
                            newTagDescriptions.put(name.toString(),
                                    description != null ? description.toString() : "");
                        }
                    }
                }
            }
            resp.setNewTagDescriptions(newTagDescriptions);

            // 解析 action_items
            Object itemsObj = result.get("action_items");
            if (itemsObj instanceof List<?> itemsList) {
                List<ActionItem> actionItems = new ArrayList<>();
                for (Object item : itemsList) {
                    if (item instanceof Map<?, ?> itemMap) {
                        ActionItem ai = new ActionItem();
                        Object desc = itemMap.get("description");
                        Object prio = itemMap.get("priority");
                        if (desc != null) ai.setDescription(desc.toString());
                        if (prio != null) ai.setPriority(prio.toString());
                        if (ai.getDescription() != null) actionItems.add(ai);
                    }
                }
                resp.setActionItems(actionItems);
            }

        } catch (Exception e) {
            log.warn("笔记 AI 分析失败，降级返回原文: {}", e.getMessage());
            resp.setAiAvailable(false);
            resp.setSuggestedTitle(req.getTitle());
            resp.setSuggestedKind(req.getKind());
            resp.setSuggestedTags(capTags(req.getTags()));
            resp.setNewTagDescriptions(Map.of());
        }

        return resp;
    }

    /** 将标签列表截断至恰好 1 个（单标签机制），防止标签爆炸；null 时原样返回 */
    private List<String> capTags(List<String> tags) {
        if (tags == null) return null;
        return tags.size() > 1 ? new ArrayList<>(tags.subList(0, 1)) : tags;
    }

    /**
     * 构建发送给 LLM 的笔记分析中文 Prompt。
     * 包含已有标签索引，引导 LLM 优先复用标签、最终标签恰好 1 个，必要时通过 new_tags 新建。
     */
    private String buildNoteAnalyzePrompt(NoteAnalyzeRequest req, List<NoteTagEntryResponse> existingTags) {
        String tagsStr = "";
        if (req.getTags() != null && !req.getTags().isEmpty()) {
            tagsStr = String.join(", ", req.getTags());
        }

        String tagIndexStr = existingTags.isEmpty()
                ? "（暂无已有标签）"
                : existingTags.stream()
                        .map(t -> "- " + t.getName() + ": " + t.getDescription())
                        .collect(Collectors.joining("\n"));

        return """
                你是一个个人知识管理助手。请分析以下笔记内容，返回严格的 JSON 格式。

                笔记内容：
                %s

                已有标题：%s
                已有类型：%s
                已有标签：%s

                已有标签索引（请优先从中选择语义匹配的标签）：
                %s

                请返回 JSON（不要包含 markdown 代码块标记）：
                {
                  "title": "建议的标题",
                  "kind": "quick_note 或 memo",
                  "tags": ["标签1", "标签2"],
                  "new_tags": [{"name": "新标签名", "description": "该标签适用范围的一句话说明"}],
                  "category": "建议的分类（如 技术/阅读/生活/工作/学习）",
                  "folder": "建议的 Obsidian 子文件夹",
                  "cleaned_markdown": "整理后的 Markdown 内容",
                  "action_items": [
                    {"description": "行动项描述", "priority": "high|medium|low"}
                  ],
                  "confidence": "high|medium|low"
                }

                标签要求：
                - 优先复用"已有标签索引"中语义匹配的标签
                - tags 字段最终数量（复用 + 新建）恰好 1 个
                - 若已有标签都不适用，通过 new_tags 新建 1 个标签，并给出一句话范围说明
                - 若无需新建标签，new_tags 返回空数组 []

                要求：
                - 标题简洁（不超过 30 字）
                - cleaned_markdown 保留原文核心信息，提升格式和可读性
                - 行动项仅提取明确需要后续执行的内容
                """
                .formatted(req.getContent(),
                        req.getTitle() != null ? req.getTitle() : "",
                        req.getKind() != null ? req.getKind() : "",
                        tagsStr,
                        tagIndexStr);
    }

    /**
     * 从 LLM 响应中提取 JSON 字符串。
     * 处理 ```json ... ``` 包裹以及直接返回 JSON 的情况。
     */
    private String extractJson(String response) {
        if (response == null || response.isBlank()) {
            return "{}";
        }
        // 先尝试提取 markdown 代码块中的 JSON
        Matcher matcher = JSON_BLOCK_PATTERN.matcher(response);
        if (matcher.find()) {
            return matcher.group(1).trim();
        }
        // 裸 JSON：截取第一个 { 到最后一个 }
        int start = response.indexOf('{');
        int end = response.lastIndexOf('}');
        if (start >= 0 && end > start) {
            return response.substring(start, end + 1).trim();
        }
        // 无法识别 JSON，返回空对象
        log.warn("无法从 LLM 响应中提取 JSON，原始响应前 200 字符: {}", response.substring(0, Math.min(200, response.length())));
        return "{}";
    }

    /** 从 Map 中安全获取字符串值，返回默认值 */
    private String getString(Map<String, Object> map, String key, String defaultValue) {
        Object val = map.get(key);
        if (val == null) return defaultValue;
        String str = val.toString();
        return str.isBlank() ? defaultValue : str;
    }

    /**
     * 为未选择标签的笔记自动建议唯一标签：优先复用标签索引中语义匹配的标签，
     * AI 不可用或解析失败时降级为"未分类"（若索引中已存在"未分类"则不重复写入说明，避免覆盖已有人工说明）。
     *
     * @param content 笔记正文
     * @param kind    笔记类型：quick_note / memo
     * @return 标签建议：name 为最终标签名；description 非 null 时表示这是一个需要写入标签索引的新标签
     */
    public NoteTagSuggestionResponse suggestSingleTag(String content, String kind) {
        List<NoteTagEntryResponse> existingTags = noteTagIndexService.listTags(kind);
        Set<String> existingNames = existingTags.stream()
                .map(NoteTagEntryResponse::getName)
                .collect(Collectors.toSet());

        if (!inboxSettingsService.isInboxAiAvailable()) {
            return fallbackTag(existingNames);
        }

        try {
            ChatLanguageModel model = llmConfigService.resolveModel("inbox");
            String prompt = buildSingleTagPrompt(content, kind, existingTags);
            String response = model.generate(prompt);

            String jsonStr = extractJson(response);
            Map<String, Object> result = objectMapper.readValue(jsonStr,
                    new TypeReference<Map<String, Object>>() {});

            String tagName = getString(result, "tag", null);
            if (tagName == null || tagName.isBlank()) {
                return fallbackTag(existingNames);
            }
            tagName = tagName.trim();

            NoteTagSuggestionResponse suggestion = new NoteTagSuggestionResponse();
            suggestion.setName(tagName);
            if (!existingNames.contains(tagName)) {
                String description = getString(result, "description", null);
                suggestion.setDescription(description != null ? description : "（待补充说明）");
            }
            return suggestion;
        } catch (Exception e) {
            log.warn("AI 自动打标签失败，降级为'未分类': {}", e.getMessage());
            return fallbackTag(existingNames);
        }
    }

    /** AI 不可用或解析失败时的降级标签："未分类"；索引中已存在则不重复写入说明 */
    private NoteTagSuggestionResponse fallbackTag(Set<String> existingNames) {
        NoteTagSuggestionResponse suggestion = new NoteTagSuggestionResponse();
        suggestion.setName("未分类");
        if (!existingNames.contains("未分类")) {
            suggestion.setDescription("AI 未启用或暂不可用时的默认分类，可手动整理");
        }
        return suggestion;
    }

    /**
     * 构建单标签建议的精简 Prompt：要求 AI 从已有标签索引中选择最匹配的 1 个，
     * 若都不适用则给出 1 个新标签及其范围说明。
     */
    private String buildSingleTagPrompt(String content, String kind, List<NoteTagEntryResponse> existingTags) {
        String tagIndexStr = existingTags.isEmpty()
                ? "（暂无已有标签）"
                : existingTags.stream()
                        .map(t -> "- " + t.getName() + ": " + t.getDescription())
                        .collect(Collectors.joining("\n"));

        return """
                你是一个个人知识管理助手。请为以下笔记内容选择唯一一个最合适的标签，返回严格的 JSON 格式（不要包含 markdown 代码块标记）。

                笔记内容：
                %s

                已有标签索引（请优先从中选择语义匹配的标签）：
                %s

                请返回 JSON：
                {
                  "tag": "标签名",
                  "description": "若该标签不在已有标签索引中，给出一句话范围说明；否则留空字符串"
                }

                要求：
                - 优先从"已有标签索引"中选择语义匹配的标签
                - 仅在确有必要且已有标签都不适用时才给出新标签
                """
                .formatted(content, tagIndexStr);
    }
}
