package com.nexus.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.nexus.handler.JsonbTypeHandler;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** API Key 余额快照，每次手动/定时同步写入一条，供趋势图和额度分析使用 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@TableName(value = "api_key_balance_snapshots", autoResultMap = true)
public class ApiKeyBalanceSnapshot {
    @TableId(type = IdType.ASSIGN_UUID)
    private String id;
    private String apiKeyId;
    private BigDecimal balance;
    private String currency;

    @TableField(typeHandler = JsonbTypeHandler.class)
    private Object rawJson;

    private LocalDateTime snapshottedAt;
}
