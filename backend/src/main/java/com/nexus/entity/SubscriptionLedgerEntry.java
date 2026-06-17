package com.nexus.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/** 按量订阅充值/消费流水，按 subscription_id 关联 subscriptions 表，替代旧的 recharge_records JSONB。 */
@Data
@TableName("subscription_ledger_entries")
public class SubscriptionLedgerEntry {
    @TableId(type = IdType.ASSIGN_UUID)
    private String id;
    private String subscriptionId;
    /** recharge | consume */
    private String entryType;
    private BigDecimal amount;
    private BigDecimal balanceAfter;
    private String note;
    private LocalDate occurredOn;
    private LocalDateTime createdAt;
}
