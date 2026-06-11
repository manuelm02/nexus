package com.nexus.translate;

import java.util.List;

/** TranslationResultPayload 是 provider 返回给服务层的结构化翻译结果。 */
public record TranslationResultPayload(
        String translatedText,
        String explanation,
        List<String> keywords,
        List<String> alternatives,
        String provider
) {
}
