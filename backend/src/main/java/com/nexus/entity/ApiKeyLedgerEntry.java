package com.nexus.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/** API Key 流水记录，记录充值和消费明细 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@TableName("api_key_ledger_entries")
public class ApiKeyLedgerEntry {
    @TableId(type = IdType.ASSIGN_UUID)
    private String id;
    private String apiKeyId;
    /** recharge | consume */
    private String entryType;
    private BigDecimal amount;
    private BigDecimal balanceAfter;
    private String note;
    private LocalDate occurredOn;
    private LocalDateTime createdAt;
}
