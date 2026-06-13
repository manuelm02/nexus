package com.nexus.translate;

import com.nexus.dto.request.TranslateRequest;

import java.util.Optional;

/** FastTranslationProviderPort 定义专业翻译 API 的快速译文能力。 */
public interface FastTranslationProviderPort {

    /**
     * 尝试通过专业翻译 API 生成快速译文。
     *
     * @param request 用户输入和目标语言
     * @return 可用时返回快速译文，不可用或未配置时返回空
     */
    Optional<TranslationResultPayload> translateFast(TranslateRequest request);
}
