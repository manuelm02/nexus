package com.nexus.dto.response;

import com.nexus.entity.Subscription;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/** Subscriptions Phase 4 对外响应，只暴露基础订阅管理所需字段。 */
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
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    /**
     * 将数据库实体转换为 Phase 4 响应对象。
     *
     * @param entity 订阅实体，包含数据库完整列
     * @return 不含 api_* 与 Notion 遗留字段的响应对象；API 余额字段留待后续阶段开放，避免当前前端误依赖未实现能力
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
        response.setCreatedAt(entity.getCreatedAt());
        response.setUpdatedAt(entity.getUpdatedAt());
        return response;
    }
}
