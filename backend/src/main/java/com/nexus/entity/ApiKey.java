package com.nexus.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.nexus.handler.JsonbTypeHandler;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/** API Key 实体，对应 api_keys 表，管理各平台 API 密钥的加密存储与状态 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@TableName(value = "api_keys", autoResultMap = true)
public class ApiKey {
    @TableId(type = IdType.ASSIGN_UUID)
    private String id;
    private String label;
    private String provider;
    /** 计费类型：pay_as_you_go(按量) / plan_based(套餐)，核心分类字段 */
    private String billingType;

    /** 月初余额快照，用于实时计算当月消费：月初余额 + 当月充值 - 当前余额（仅按量计费使用） */
    private BigDecimal monthStartBalance;

    private String encryptedKey;
    private String baseUrl;
    private String status;
    private String planName;
    private LocalDate planExpireDate;
    private String subscriptionId;
    private BigDecimal remainingBalance;
    private BigDecimal monthlySpend;

    @TableField("low_balance_notify")
    private boolean lowBalanceNotify;

    private BigDecimal lowBalanceThreshold;

    @TableField("api_fetch_enabled")
    private boolean apiFetchEnabled;

    private LocalDateTime apiLastFetchedAt;

    @TableField(typeHandler = JsonbTypeHandler.class)
    private Object apiBalanceJson;

    private String notes;

    @TableField("archived")
    private boolean archived;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
