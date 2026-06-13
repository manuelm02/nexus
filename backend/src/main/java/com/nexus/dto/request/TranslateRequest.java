package com.nexus.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/** TranslateRequest 承载翻译输入和可选上下文，供不同翻译 provider 生成结构化结果。 */
@Data
public class TranslateRequest {
    @NotBlank(message = "源文本不能为空")
    private String sourceText;

    @NotBlank(message = "目标语言不能为空")
    private String targetLang;

    private String sourceLang;

    private String style;  // formal|casual|technical

    /** 为 Phase 2 预留上下文，后续可用于术语或场景约束。 */
    private String context;
}
