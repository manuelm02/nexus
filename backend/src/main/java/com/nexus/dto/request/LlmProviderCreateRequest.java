package com.nexus.dto.request;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class LlmProviderCreateRequest {
    @NotBlank(message = "名称不能为空")
    private String name;

    @NotBlank(message = "provider 不能为空")
    private String provider;  // openai|anthropic|deepseek|gemini|ollama

    private String apiKey;
    private String baseUrl;
    private String model;
    /** 前端历史字段名是 isDefault，显式绑定避免 boolean isXxx 被 Jackson/Lombok 解析成 default。 */
    @JsonProperty("isDefault")
    private boolean isDefault = false;
    private boolean enabled = true;
}
