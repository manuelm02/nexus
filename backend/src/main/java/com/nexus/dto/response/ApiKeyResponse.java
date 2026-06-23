package com.nexus.dto.response;

import com.nexus.entity.ApiKey;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/** API Key 对外响应，用 maskedKey 替代 encryptedKey 保护密钥安全 */
@Data
public class ApiKeyResponse {
    private String id;
    private String label;
    private String provider;
    /** 打码后的 Key，如 sk-abc...wxyz */
    private String maskedKey;
    private String baseUrl;
    private String status;
    private String planName;
    private LocalDate planExpireDate;
    private String subscriptionId;
    private BigDecimal remainingBalance;
    private BigDecimal monthlySpend;
    private boolean lowBalanceNotify;
    private BigDecimal lowBalanceThreshold;
    private boolean apiFetchEnabled;
    private LocalDateTime apiLastFetchedAt;
    private Object apiBalanceJson;
    private String notes;
    private boolean archived;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    /**
     * 将数据库实体转换为响应对象，打码 Key 保护敏感信息。
     * @param entity API Key 实体
     * @param maskedKey 打码后的 Key（如 sk-abc...wxyz）
     * @return API Key 响应对象
     */
    public static ApiKeyResponse from(ApiKey entity, String maskedKey) {
        ApiKeyResponse r = new ApiKeyResponse();
        r.setId(entity.getId());
        r.setLabel(entity.getLabel());
        r.setProvider(entity.getProvider());
        r.setMaskedKey(maskedKey);
        r.setBaseUrl(entity.getBaseUrl());
        r.setStatus(entity.getStatus());
        r.setPlanName(entity.getPlanName());
        r.setPlanExpireDate(entity.getPlanExpireDate());
        r.setSubscriptionId(entity.getSubscriptionId());
        r.setRemainingBalance(entity.getRemainingBalance());
        r.setMonthlySpend(entity.getMonthlySpend());
        r.setLowBalanceNotify(entity.isLowBalanceNotify());
        r.setLowBalanceThreshold(entity.getLowBalanceThreshold());
        r.setApiFetchEnabled(entity.isApiFetchEnabled());
        r.setApiLastFetchedAt(entity.getApiLastFetchedAt());
        r.setApiBalanceJson(entity.getApiBalanceJson());
        r.setNotes(entity.getNotes());
        r.setArchived(entity.isArchived());
        r.setCreatedAt(entity.getCreatedAt());
        r.setUpdatedAt(entity.getUpdatedAt());
        return r;
    }
}
