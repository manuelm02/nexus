package com.nexus.translate;

import com.nexus.dto.request.TranslateRequest;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

/** ConfiguredFastTranslationProvider 从 Spring 配置读取腾讯云凭据，调用 SDK 生成低延迟初稿。 */
@Slf4j
@Component
public class ConfiguredFastTranslationProvider implements FastTranslationProviderPort {

    private final TencentMachineTranslationClient tencentClient;
    private final String secretId;
    private final String secretKey;

    public ConfiguredFastTranslationProvider(
            TencentMachineTranslationClient tencentClient,
            @Value("${nexus.translate.tencent.secret-id:}") String secretId,
            @Value("${nexus.translate.tencent.secret-key:}") String secretKey) {
        this.tencentClient = tencentClient;
        this.secretId = secretId;
        this.secretKey = secretKey;
    }

    /** 启动时打印腾讯云翻译配置状态，便于排查密钥是否加载。 */
    @PostConstruct
    void logConfig() {
        boolean hasId = !secretId.isBlank();
        boolean hasKey = !secretKey.isBlank();
        if (hasId && hasKey) {
            log.info("腾讯云机器翻译已配置: secretId={}***{} secretKey=****", secretId.substring(0, Math.min(6, secretId.length())), secretId.substring(Math.max(0, secretId.length() - 4)));
        } else {
            log.warn("腾讯云机器翻译未配置（missing: {}{}），快速初稿将跳过", hasId ? "" : "secret-id ", hasKey ? "" : "secret-key");
        }
    }

    @Override
    public Optional<TranslationResultPayload> translateFast(TranslateRequest request) {
        if (secretId.isBlank() || secretKey.isBlank()) {
            log.debug("跳过腾讯云快速翻译：缺少 secret-id 或 secret-key");
            return Optional.empty();
        }
        try {
            String targetLangCode = tencentLanguageCode(request.getTargetLang());
            log.debug("调用腾讯云机器翻译: sourceText={} target={}", request.getSourceText().substring(0, Math.min(20, request.getSourceText().length())), targetLangCode);
            String translatedText = tencentClient.translate(secretId, secretKey, request.getSourceText(), targetLangCode);
            if (translatedText == null || translatedText.isBlank()) {
                log.warn("腾讯云机器翻译返回空结果");
                return Optional.empty();
            }
            log.info("腾讯云机器翻译成功: {} -> {}", request.getSourceText().substring(0, Math.min(20, request.getSourceText().length())), translatedText.substring(0, Math.min(20, translatedText.length())));
            return Optional.of(new TranslationResultPayload(translatedText, null, List.of(), List.of(), "tencent"));
        } catch (Exception e) {
            log.error("腾讯云机器翻译调用失败: {}", e.toString());
            return Optional.empty();
        }
    }

    private String tencentLanguageCode(String targetLang) {
        return switch (targetLang) {
            case "中文" -> "zh";
            case "日文" -> "ja";
            case "韩文" -> "ko";
            case "法文" -> "fr";
            case "德文" -> "de";
            case "西班牙文" -> "es";
            default -> "en";
        };
    }
}
