package com.nexus.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class TranslateRequest {
    @NotBlank(message = "源文本不能为空")
    private String sourceText;

    @NotBlank(message = "目标语言不能为空")
    private String targetLang;

    private String sourceLang;

    private String style;  // formal|casual|technical
}
