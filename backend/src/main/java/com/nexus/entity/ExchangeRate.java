package com.nexus.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** 各币种兑 CNY 实时汇率缓存，currency 为 ISO 4217 代码（如 USD），由外部汇率 API 每日刷新。 */
@Data
@TableName("exchange_rates")
public class ExchangeRate {
    @TableId(type = IdType.INPUT)
    private String currency;
    private BigDecimal rateToCny;
    private LocalDateTime updatedAt;
}
