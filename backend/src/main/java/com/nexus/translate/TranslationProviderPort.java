package com.nexus.translate;

import com.nexus.dto.request.TranslateRequest;

/** TranslationProviderPort 定义翻译能力边界，后续专业翻译 API 可通过该端口接入。 */
public interface TranslationProviderPort {

    /**
     * 根据翻译请求生成结构化翻译结果。
     *
     * @param request 用户输入、目标语言、风格和可选上下文
     * @return 包含主译文、解释、关键词、备选表达和 provider 标识的结果
     */
    TranslationResultPayload translate(TranslateRequest request);
}
