package com.nexus.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@TableName(value = "ledger", autoResultMap = true)
public class Subscription {
    @TableId(type = IdType.ASSIGN_UUID)
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
    private String apiProvider;
    private String apiKeyMasked;
    private boolean apiFetchEnabled;
    private LocalDateTime apiLastFetchedAt;
    @TableField(typeHandler = JacksonTypeHandler.class)
    private Object apiBalanceJson;
    private boolean notifyEnabled;
    private int notifyDaysBefore;
    private String url;
    private String notes;
    private String status;
    private String notionPageUrl;
    private boolean notionSynced;
    private String taskId;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
