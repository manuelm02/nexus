package com.nexus.dto.request;

import lombok.Data;

@Data
public class LlmProviderUpdateRequest {
    private String name;
    private String provider;
    private String apiKey;
    private String baseUrl;
    private String model;
    private Boolean isDefault;
    private Boolean enabled;
}
