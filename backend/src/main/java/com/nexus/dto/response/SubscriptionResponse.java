package com.nexus.dto.response;

import com.nexus.entity.Subscription;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/** Subscriptions 对外响应，包含基础订阅管理和 UI 重构新增的自动续费/归档/按量字段。 */
@Data
public class SubscriptionResponse {
    private String id;
    private String name;
    private String category;
    private BigDecimal price;
    private String currency;
    private String billingType;
    private LocalDate startDate;
    private LocalDate expireDate;
    private LocalDate nextBillingDate;
    private BigDecimal usageLimit;
    private BigDecimal usageUsed;
    private String usageUnit;
    private String url;
    private String notes;
    private String status;
    private boolean notifyEnabled;
    private int notifyDaysBefore;
    private boolean autoRenew;
    private boolean archived;
    private BigDecimal remainingBalance;
    private BigDecimal monthlySpend;
    private boolean lowBalanceNotify;
    private BigDecimal lowBalanceThreshold;
    private String apiProvider;
    private boolean apiFetchEnabled;
    private LocalDateTime apiLastFetchedAt;
    private Object apiBalanceJson;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    /**
     * 将数据库实体转换为响应对象。
     * 完整映射实体字段到 API 响应，api_key_masked 等敏感字段不暴露。
     */
    public static SubscriptionResponse from(Subscription entity) {
        SubscriptionResponse response = new SubscriptionResponse();
        response.setId(entity.getId());
        response.setName(entity.getName());
        response.setCategory(entity.getCategory());
        response.setPrice(entity.getPrice());
        response.setCurrency(entity.getCurrency());
        response.setBillingType(entity.getBillingType());
        response.setStartDate(entity.getStartDate());
        response.setExpireDate(entity.getExpireDate());
        response.setNextBillingDate(entity.getNextBillingDate());
        response.setUsageLimit(entity.getUsageLimit());
        response.setUsageUsed(entity.getUsageUsed());
        response.setUsageUnit(entity.getUsageUnit());
        response.setUrl(entity.getUrl());
        response.setNotes(entity.getNotes());
        response.setStatus(entity.getStatus());
        response.setNotifyEnabled(entity.isNotifyEnabled());
        response.setNotifyDaysBefore(entity.getNotifyDaysBefore());
        response.setAutoRenew(entity.isAutoRenew());
        response.setArchived(entity.isArchived());
        response.setRemainingBalance(entity.getRemainingBalance());
        response.setMonthlySpend(entity.getMonthlySpend());
        response.setLowBalanceNotify(entity.isLowBalanceNotify());
        response.setLowBalanceThreshold(entity.getLowBalanceThreshold());
        response.setApiProvider(entity.getApiProvider());
        response.setApiFetchEnabled(entity.isApiFetchEnabled());
        response.setApiLastFetchedAt(entity.getApiLastFetchedAt());
        response.setApiBalanceJson(entity.getApiBalanceJson());
        response.setCreatedAt(entity.getCreatedAt());
        response.setUpdatedAt(entity.getUpdatedAt());
        return response;
    }
}
