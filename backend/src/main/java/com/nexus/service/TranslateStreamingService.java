package com.nexus.service;

import com.nexus.dto.request.TranslateRequest;
import com.nexus.translate.FastTranslationProviderPort;
import com.nexus.translate.TranslationProviderPort;
import com.nexus.translate.TranslationResultPayload;
import dev.langchain4j.data.message.AiMessage;
import dev.langchain4j.model.StreamingResponseHandler;
import dev.langchain4j.model.chat.StreamingChatLanguageModel;
import dev.langchain4j.model.output.Response;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CountDownLatch;
import java.util.function.Consumer;

/** TranslateStreamingService 编排快速翻译初稿 + LLM 流式润色 + 结构化元数据，通过 SSE 逐事件推送。 */
@Slf4j
@Service
public class TranslateStreamingService {

    private final FastTranslationProviderPort fastProvider;
    private final TranslationProviderPort llmProvider;
    private final LlmConfigService llmConfigService;

    public TranslateStreamingService(FastTranslationProviderPort fastProvider,
                                     TranslationProviderPort llmProvider,
                                     LlmConfigService llmConfigService) {
        this.fastProvider = fastProvider;
        this.llmProvider = llmProvider;
        this.llmConfigService = llmConfigService;
    }

    /** 非流式版本，保留给测试使用。 */
    public List<TranslateStreamEvent> translate(TranslateRequest request) {
        List<TranslateStreamEvent> events = new ArrayList<>();
        translate(request, events::add);
        return events;
    }

    /**
     * 兼容旧版同步回调接口，内部委托到流式实现。
     * 调用方应注意：draft/ enhanced/done 事件通过 eventConsumer 回调，但令牌流式输出不走此路径。
     */
    public void translate(TranslateRequest request, Consumer<TranslateStreamEvent> eventConsumer) {
        // Phase 1: 快速翻译初稿
        Optional<TranslationResultPayload> draft = fastProvider.translateFast(request);
        draft.ifPresent(payload -> eventConsumer.accept(new TranslateStreamEvent("draft", payload)));

        // Phase 2: 非流式 LLM 增强（原有逻辑，供非 SSE 路径使用）
        TranslateRequest enhancedRequest = copyForEnhancement(request, draft.orElse(null));
        TranslationResultPayload enhanced = llmProvider.translate(enhancedRequest);
        eventConsumer.accept(new TranslateStreamEvent("enhanced", enhanced));
        eventConsumer.accept(new TranslateStreamEvent("done", enhanced));
    }

    /**
     * 流式翻译编排：快速初稿 → LLM 逐令牌润色 → 结构化元数据 → 完成。
     * StreamingResponseBody lambda 内调用，会阻塞直到 LLM 流结束。
     */
    public void translateStreaming(TranslateRequest request, Consumer<TranslateStreamEvent> eventConsumer) {
        // Phase 1: 快速翻译初稿（同步，不阻塞）
        Optional<TranslationResultPayload> draft = fastProvider.translateFast(request);
        draft.ifPresent(payload -> eventConsumer.accept(new TranslateStreamEvent("draft", payload)));

        // Phase 2: LLM 流式润色译文
        StreamingChatLanguageModel streamingModel = llmConfigService.resolveStreamingModel("translate");
        String translationPrompt = buildStreamingPrompt(request, draft.orElse(null));

        CountDownLatch latch = new CountDownLatch(1);
        StringBuilder translatedText = new StringBuilder();

        streamingModel.generate(translationPrompt, new StreamingResponseHandler<AiMessage>() {
            @Override
            public void onNext(String token) {
                translatedText.append(token);
                // token 事件只需携带当前累计文本，前端逐字追加显示
                eventConsumer.accept(new TranslateStreamEvent("token", new TranslationResultPayload(
                        translatedText.toString(), null, List.of(), List.of(), "llm"
                )));
            }

            @Override
            public void onComplete(Response<AiMessage> response) {
                String finalTranslation = translatedText.toString().trim();
                // Phase 3: 非流式生成解释、关键词、备选译文
                TranslationResultPayload enhanced = generateMetadata(request, draft.orElse(null), finalTranslation);
                eventConsumer.accept(new TranslateStreamEvent("enhanced", enhanced));
                eventConsumer.accept(new TranslateStreamEvent("done", enhanced));
                latch.countDown();
            }

            @Override
            public void onError(Throwable error) {
                log.warn("LLM 流式翻译失败，降级为同步完整翻译", error);
                // 降级：使用非流式 LLM 提供完整结果
                try {
                    TranslateRequest fallbackRequest = copyForEnhancement(request, draft.orElse(null));
                    TranslationResultPayload fallback = llmProvider.translate(fallbackRequest);
                    eventConsumer.accept(new TranslateStreamEvent("enhanced", fallback));
                    eventConsumer.accept(new TranslateStreamEvent("done", fallback));
                } catch (Exception e) {
                    eventConsumer.accept(new TranslateStreamEvent("error", null));
                }
                latch.countDown();
            }
        });

        try {
            latch.await();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            eventConsumer.accept(new TranslateStreamEvent("error", null));
        }
    }

    /** 流式翻译提示词：只输出译文，不给额外解释或格式。 */
    private String buildStreamingPrompt(TranslateRequest req, TranslationResultPayload draft) {
        StringBuilder sb = new StringBuilder();
        sb.append("请将以下文本翻译成").append(req.getTargetLang()).append("。\n");
        if (req.getStyle() != null && !req.getStyle().isBlank()) {
            sb.append("风格：").append(styleLabel(req.getStyle())).append("。\n");
        }
        if (draft != null) {
            sb.append("参考初稿：").append(draft.translatedText()).append("。\n");
        }
        sb.append("只输出译文本身，不要任何额外说明或格式。\n\n原文：\n").append(req.getSourceText());
        return sb.toString();
    }

    /** 元数据提示词：基于流式译文生成结构化 JSON。 */
    private String buildMetadataPrompt(TranslateRequest req, TranslationResultPayload draft, String streamedTranslation) {
        StringBuilder sb = new StringBuilder();
        sb.append("原文：").append(req.getSourceText()).append("\n");
        sb.append("译文：").append(streamedTranslation).append("\n");
        if (req.getStyle() != null && !req.getStyle().isBlank()) {
            sb.append("风格：").append(styleLabel(req.getStyle())).append("。\n");
        }
        if (draft != null) {
            sb.append("快速初稿：").append(draft.translatedText()).append("（仅供参考）\n");
        }
        sb.append("\n请以合法 JSON 格式输出以下内容：\n");
        sb.append("- translatedText: 最终译文\n");
        sb.append("- explanation: 翻译解释\n");
        sb.append("- keywords: 原文关键术语数组\n");
        sb.append("- alternatives: 备选译文数组\n");
        sb.append("只输出 JSON，不要 Markdown 代码块。");
        return sb.toString();
    }

    /** 调用非流式 LLM 生成结构化元数据。 */
    private TranslationResultPayload generateMetadata(TranslateRequest req, TranslationResultPayload draft, String streamedTranslation) {
        try {
            com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            dev.langchain4j.model.chat.ChatLanguageModel model = llmConfigService.resolveModel("translate");
            String prompt = buildMetadataPrompt(req, draft, streamedTranslation);
            String output = model.generate(prompt);
            // 尝试解析 JSON，失败则保留流式译文作为最终结果
            try {
                com.fasterxml.jackson.databind.JsonNode root = mapper.readTree(stripCodeFence(output));
                String translatedText = text(root, "translatedText", streamedTranslation);
                String explanation = text(root, "explanation", null);
                List<String> keywords = stringArray(mapper, root.get("keywords"));
                List<String> alternatives = stringArray(mapper, root.get("alternatives"));
                return new TranslationResultPayload(translatedText, explanation, keywords, alternatives, "llm");
            } catch (Exception e) {
                return new TranslationResultPayload(streamedTranslation, null, List.of(), List.of(), "llm");
            }
        } catch (Exception e) {
            // LLM 调用完全失败，返回流式译文作为最终结果
            return new TranslationResultPayload(streamedTranslation, null, List.of(), List.of(), "llm");
        }
    }

    private String stripCodeFence(String output) {
        String trimmed = output == null ? "" : output.trim();
        if (trimmed.startsWith("```")) {
            return trimmed.replaceFirst("^```(?:json)?\\s*", "").replaceFirst("\\s*```$", "");
        }
        return trimmed;
    }

    private String text(com.fasterxml.jackson.databind.JsonNode root, String field, String fallback) {
        com.fasterxml.jackson.databind.JsonNode value = root.get(field);
        return value == null || value.isNull() ? fallback : value.asText();
    }

    private List<String> stringArray(com.fasterxml.jackson.databind.ObjectMapper mapper, com.fasterxml.jackson.databind.JsonNode node) {
        if (node == null || !node.isArray()) return List.of();
        List<String> values = new ArrayList<>();
        node.forEach(item -> {
            if (!item.isNull() && !item.asText().isBlank()) values.add(item.asText());
        });
        return values;
    }

    private TranslateRequest copyForEnhancement(TranslateRequest request, TranslationResultPayload draft) {
        TranslateRequest copy = new TranslateRequest();
        copy.setSourceText(request.getSourceText());
        copy.setSourceLang(request.getSourceLang());
        copy.setTargetLang(request.getTargetLang());
        copy.setStyle(request.getStyle());
        String context = request.getContext() == null ? "" : request.getContext() + "\n";
        if (draft != null) {
            context += "翻译 API 初稿：" + draft.translatedText() + "。请判断它是否准确；如果更好再修正主译文，否则保留并补充解释、关键词和备选表达。";
        }
        copy.setContext(context);
        return copy;
    }

    private String styleLabel(String style) {
        return switch (style) {
            case "formal" -> "正式";
            case "casual" -> "口语化";
            case "technical" -> "技术性";
            default -> style;
        };
    }

    public record TranslateStreamEvent(String type, TranslationResultPayload payload) {}
}
