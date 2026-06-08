package com.nexus.dto.request;

import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.Map;

@Data
public class SystemConfigUpdateRequest {
    @NotEmpty(message = "配置项不能为空")
    private Map<String, String> configs;
}
