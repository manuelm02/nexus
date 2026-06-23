package com.nexus.dto.request;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

/** PATCH 更新 API Key，全部字段 nullable，null 表示不更新 */
@Data
public class ApiKeyUpdateRequest {
    private String label;
    private String provider;
    /** 若提供则 Service 重新加密存储 */
    private String apiKey;
    private String baseUrl;
    private String status;
    private String planName;
    private LocalDate planExpireDate;
    private String subscriptionId;
    private Boolean lowBalanceNotify;
    private BigDecimal lowBalanceThreshold;
    private Boolean archived;
    private String notes;
}
