package com.nexus.translate;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexus.dto.request.TranslateRequest;
import com.nexus.service.LlmConfigService;
import dev.langchain4j.model.chat.ChatLanguageModel;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/** LlmTranslationProvider 使用统一 LLM 配置生成 Translate Phase 2 结构化结果。 */
@Component
@RequiredArgsConstructor
public class LlmTranslationProvider implements TranslationProviderPort {

    private final LlmConfigService llmConfigService;
    private final ObjectMapper objectMapper;

    /**
     * 调用 translate 工作流绑定的 LLM 并尽量解析为结构化结果。
     *
     * @param request 用户输入、目标语言、风格和可选上下文
     * @return LLM 生成的分层翻译结果，解析失败时保留主译文避免丢失可用输出
     */
    @Override
    public TranslationResultPayload translate(TranslateRequest request) {
        ChatLanguageModel model = llmConfigService.resolveModel("translate");
        String output = model.generate(buildPrompt(request));
        return parseOutput(output);
    }

    private String buildPrompt(TranslateRequest req) {
        StringBuilder sb = new StringBuilder();
        sb.append("请将以下文本翻译成").append(req.getTargetLang()).append("，并只输出合法 JSON。\n");
        sb.append("JSON 字段必须包含 translatedText、explanation、keywords、alternatives。\n");
        if (req.getSourceLang() != null && !req.getSourceLang().isBlank()) {
            sb.append("原文语言：").append(req.getSourceLang()).append("。\n");
        }
        if (req.getStyle() != null && !req.getStyle().isBlank()) {
            sb.append("风格：").append(styleLabel(req.getStyle())).append("。\n");
        }
        if (req.getContext() != null && !req.getContext().isBlank()) {
            sb.append("上下文约束：").append(req.getContext()).append("。\n");
        }
        sb.append("keywords 和 alternatives 使用字符串数组。不要输出 Markdown 代码块。\n\n原文：\n")
                .append(req.getSourceText());
        return sb.toString();
    }

    private String styleLabel(String style) {
        return switch (style) {
            case "formal" -> "正式";
            case "casual" -> "口语化";
            case "technical" -> "技术性";
            default -> style;
        };
    }

    private TranslationResultPayload parseOutput(String output) {
        try {
            JsonNode root = objectMapper.readTree(stripCodeFence(output));
            return new TranslationResultPayload(
                    text(root, "translatedText", output),
                    text(root, "explanation", null),
                    stringArray(root.get("keywords")),
                    stringArray(root.get("alternatives")),
                    "llm"
            );
        } catch (Exception ignored) {
            // LLM 可能返回非 JSON；此时保留主译文，让用户仍能获得核心翻译结果。
            return new TranslationResultPayload(output, null, List.of(), List.of(), "llm");
        }
    }

    private String stripCodeFence(String output) {
        String trimmed = output == null ? "" : output.trim();
        if (trimmed.startsWith("```")) {
            return trimmed.replaceFirst("^```(?:json)?\\s*", "").replaceFirst("\\s*```$", "");
        }
        return trimmed;
    }

    private String text(JsonNode root, String field, String fallback) {
        JsonNode value = root.get(field);
        return value == null || value.isNull() ? fallback : value.asText();
    }

    private List<String> stringArray(JsonNode node) {
        if (node == null || !node.isArray()) return List.of();
        List<String> values = new ArrayList<>();
        node.forEach(item -> {
            if (!item.isNull() && !item.asText().isBlank()) values.add(item.asText());
        });
        return values;
    }
}
