package com.nexus.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/** 创建 Prompt 模板请求 */
@Data
public class CreatePromptTemplateRequest {
    @NotBlank(message = "模板名称不能为空")
    private String name;
    @NotBlank(message = "模板类型不能为空")
    private String promptType;
    @NotBlank(message = "模板内容不能为空")
    private String content;
    private Boolean defaultFlag;
}
