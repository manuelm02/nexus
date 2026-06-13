package com.nexus.dto.request;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
public class LlmProviderUpdateRequest {
    private String name;
    private String provider;
    private String apiKey;
    private String baseUrl;
    private String model;
    /** 前端历史字段名是 isDefault，显式绑定避免 boolean isXxx 被 Jackson/Lombok 解析成 default。 */
    @JsonProperty("isDefault")
    private Boolean isDefault;
    private Boolean enabled;
}
