package com.nexus.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.nexus.dto.request.TranslateRequest;
import com.nexus.entity.Translation;
import com.nexus.mapper.TranslationMapper;
import dev.langchain4j.model.chat.ChatLanguageModel;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

/** 调用统一 LLM 配置完成翻译并保存翻译历史。 */
@Service
@RequiredArgsConstructor
public class TranslateService {

    private final TranslationMapper translationMapper;
    private final LlmConfigService llmConfigService;

    public Translation translate(TranslateRequest req) {
        ChatLanguageModel model = llmConfigService.resolveModel("translate");

        String prompt = buildPrompt(req);
        String translated = model.generate(prompt);

        Translation t = new Translation();
        t.setSourceText(req.getSourceText());
        t.setTranslatedText(translated);
        t.setSourceLang(req.getSourceLang());
        t.setTargetLang(req.getTargetLang());
        t.setStyle(req.getStyle());
        translationMapper.insert(t);
        return t;
    }

    public List<Translation> history() {
        return translationMapper.selectList(new LambdaQueryWrapper<Translation>()
                .orderByDesc(Translation::getCreatedAt)
                .last("LIMIT 50"));
    }

    private String buildPrompt(TranslateRequest req) {
        StringBuilder sb = new StringBuilder();
        sb.append("请将以下文本翻译成").append(req.getTargetLang()).append("。\n");

        if (req.getSourceLang() != null && !req.getSourceLang().isBlank()) {
            sb.append("原文语言：").append(req.getSourceLang()).append("。\n");
        }
        if (req.getStyle() != null) {
            sb.append("风格：").append(switch (req.getStyle()) {
                case "formal" -> "正式";
                case "casual" -> "口语化";
                case "technical" -> "技术性";
                default -> req.getStyle();
            }).append("。\n");
        }
        sb.append("只输出翻译结果，不要任何解释。\n\n原文：\n").append(req.getSourceText());
        return sb.toString();
    }
}
