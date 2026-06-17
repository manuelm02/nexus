package com.nexus.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.nexus.handler.JsonbTypeHandler;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** API 余额监控历史快照，每次手动/定时同步写入一条，供卡片内趋势图使用。 */
@Data
@TableName(value = "subscription_balance_snapshots", autoResultMap = true)
public class SubscriptionBalanceSnapshot {
    @TableId(type = IdType.ASSIGN_UUID)
    private String id;
    private String subscriptionId;
    private BigDecimal balance;
    private String currency;
    @TableField(typeHandler = JsonbTypeHandler.class)
    private Object rawJson;
    private LocalDateTime snapshottedAt;
}
