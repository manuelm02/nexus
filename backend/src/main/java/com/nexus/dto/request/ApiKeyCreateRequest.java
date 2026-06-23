package com.nexus.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

/** 创建 API Key 请求，传入明文 Key 由 Service 加密存储 */
@Data
public class ApiKeyCreateRequest {
    @NotBlank(message = "标签不能为空")
    private String label;

    @NotBlank(message = "平台不能为空")
    private String provider;

    @NotBlank(message = "API Key 不能为空")
    private String apiKey;

    private String baseUrl;
    private String planName;
    private LocalDate planExpireDate;
    private String subscriptionId;
    private Boolean lowBalanceNotify;
    private BigDecimal lowBalanceThreshold;
    private String notes;
}
