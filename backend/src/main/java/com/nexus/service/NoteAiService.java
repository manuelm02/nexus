package com.nexus.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexus.dto.request.NoteAnalyzeRequest;
import com.nexus.dto.response.NoteAnalyzeResponse;
import com.nexus.dto.response.NoteAnalyzeResponse.ActionItem;
import dev.langchain4j.model.chat.ChatLanguageModel;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 笔记 AI 分析服务，调用 LLM 对笔记内容进行智能分析，
 * 生成建议标题、类型、标签、分类、文件夹、清洗后 Markdown 及待办项。
 * LLM 不可用时降级返回原始内容，不影响业务流程。
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class NoteAiService {

    private final LlmConfigService llmConfigService;
    private final InboxSettingsService inboxSettingsService;
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

        // 1. LLM 可用性检查
        if (!inboxSettingsService.isInboxAiAvailable()) {
            resp.setSuggestedTitle(req.getTitle());
            resp.setSuggestedKind(req.getKind());
            resp.setSuggestedTags(req.getTags());
            return resp;
        }

        // 2. 调用 LLM 分析
        try {
            ChatLanguageModel model = llmConfigService.resolveModel("inbox");
            String prompt = buildNoteAnalyzePrompt(req);
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

            // 解析 tags
            Object tagsObj = result.get("tags");
            if (tagsObj instanceof List<?> tagsList) {
                List<String> tags = new ArrayList<>();
                for (Object tag : tagsList) {
                    if (tag != null) tags.add(tag.toString());
                }
                resp.setSuggestedTags(tags.isEmpty() ? req.getTags() : tags);
            } else {
                resp.setSuggestedTags(req.getTags());
            }

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
            resp.setSuggestedTags(req.getTags());
        }

        return resp;
    }

    /**
     * 构建发送给 LLM 的笔记分析中文 Prompt。
     */
    private String buildNoteAnalyzePrompt(NoteAnalyzeRequest req) {
        String tagsStr = "";
        if (req.getTags() != null && !req.getTags().isEmpty()) {
            tagsStr = String.join(", ", req.getTags());
        }

        return """
                你是一个个人知识管理助手。请分析以下笔记内容，返回严格的 JSON 格式。

                笔记内容：
                %s

                已有标题：%s
                已有类型：%s
                已有标签：%s

                请返回 JSON（不要包含 markdown 代码块标记）：
                {
                  "title": "建议的标题",
                  "kind": "quick_note 或 memo",
                  "tags": ["标签1", "标签2"],
                  "category": "建议的分类（如 技术/阅读/生活/工作/学习）",
                  "folder": "建议的 Obsidian 子文件夹",
                  "cleaned_markdown": "整理后的 Markdown 内容",
                  "action_items": [
                    {"description": "行动项描述", "priority": "high|medium|low"}
                  ],
                  "confidence": "high|medium|low"
                }

                要求：
                - 标题简洁（不超过 30 字）
                - 标签优先使用中文，2-5 个为宜
                - cleaned_markdown 保留原文核心信息，提升格式和可读性
                - 行动项仅提取明确需要后续执行的内容
                """
                .formatted(req.getContent(),
                        req.getTitle() != null ? req.getTitle() : "",
                        req.getKind() != null ? req.getKind() : "",
                        tagsStr);
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
}
