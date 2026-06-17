package com.nexus.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexus.dto.request.SubscriptionCategorySuggestRequest;
import com.nexus.dto.response.SubscriptionCategorySuggestResponse;
import dev.langchain4j.model.chat.ChatLanguageModel;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 订阅分类 AI 识别服务：根据订阅名称和备注，在现有分类中选择最匹配的或生成新分类。
 * 参照 BookmarkAiService 的降级原则：LLM 调用失败时返回降级结果，不抛异常。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SubscriptionCategoryAiService {

    private final LlmConfigService llmConfigService;
    private final SubscriptionCategoryService categoryService;
    private final ObjectMapper objectMapper;

    /**
     * AI 分类识别：
     * 1. 分类表为空 -> AI 生成新分类名并持久化
     * 2. 分类表非空 -> AI 在现有分类中选最匹配的，或生成新分类
     * 3. LLM 异常 -> 降级返回"未分类"
     */
    public SubscriptionCategorySuggestResponse suggest(SubscriptionCategorySuggestRequest req) {
        List<String> existingNames = categoryService.listNames();

        try {
            ChatLanguageModel model = llmConfigService.resolveModel("subscriptions");
            String prompt = buildPrompt(req, existingNames);
            String response = model.generate(prompt);
            String jsonStr = stripCodeFence(response);
            JsonNode json = objectMapper.readTree(jsonStr);

            String category = json.has("category") && !json.get("category").isNull()
                    ? json.get("category").asText() : null;
            boolean isNew = json.has("is_new") && json.get("is_new").asBoolean(false);

            if (category == null || category.isBlank()) {
                return fallbackResponse();
            }

            category = category.trim();
            if (category.length() > 64) {
                category = category.substring(0, 64);
            }

            if (isNew || !existingNames.contains(category)) {
                categoryService.create(category);
                return SubscriptionCategorySuggestResponse.builder()
                        .category(category)
                        .isNew(true)
                        .build();
            }

            return SubscriptionCategorySuggestResponse.builder()
                    .category(category)
                    .isNew(false)
                    .build();

        } catch (Exception e) {
            log.warn("订阅分类 AI 识别失败，降级返回: {}", e.getMessage());
            return fallbackResponse();
        }
    }

    private String buildPrompt(SubscriptionCategorySuggestRequest req, List<String> existingNames) {
        StringBuilder sb = new StringBuilder();
        sb.append("你是一个订阅分类助手。请根据订阅名称判断它属于哪个分类。\n\n");
        sb.append("订阅名称：").append(req.getName()).append("\n");
        if (req.getNotes() != null && !req.getNotes().isBlank()) {
            sb.append("备注：").append(req.getNotes()).append("\n");
        }

        if (existingNames.isEmpty()) {
            sb.append("\n当前没有任何已有分类。请根据订阅名称生成一个简短的中文分类名（2-6个字），");
            sb.append("例如：AI 工具、云服务、流媒体、开发工具、音乐、游戏、办公、设计、通讯、存储。\n");
            sb.append("\n返回 JSON 格式：{\"category\": \"分类名\", \"is_new\": true}\n");
        } else {
            sb.append("\n现有分类列表：").append(String.join("、", existingNames)).append("\n");
            sb.append("\n请从现有分类列表中选择最合适的一个。如果都不合适，生成一个新的分类名。\n");
            sb.append("返回 JSON 格式：{\"category\": \"分类名\", \"is_new\": true/false}\n");
            sb.append("is_new 为 true 表示生成了新分类，false 表示选择了已有分类。\n");
        }

        sb.append("\n只输出 JSON，不要 Markdown 代码块包裹，不要额外说明。");
        return sb.toString();
    }

    private SubscriptionCategorySuggestResponse fallbackResponse() {
        return SubscriptionCategorySuggestResponse.builder()
                .category("未分类")
                .isNew(false)
                .build();
    }

    private String stripCodeFence(String output) {
        String trimmed = output == null ? "" : output.trim();
        if (trimmed.startsWith("```")) {
            return trimmed.replaceFirst("^```(?:json)?\\s*", "").replaceFirst("\\s*```$", "");
        }
        return trimmed;
    }
}
