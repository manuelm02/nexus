package com.nexus.dto.request;

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
    private boolean isDefault = false;
    private boolean enabled = true;
}
