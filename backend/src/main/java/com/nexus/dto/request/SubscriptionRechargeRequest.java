package com.nexus.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

/** 按量订阅充值请求：金额必填且大于 0，日期可空默认今天。 */
@Data
public class SubscriptionRechargeRequest {
    @NotNull(message = "充值金额不能为空")
    @DecimalMin(value = "0.01", message = "充值金额必须大于 0")
    private BigDecimal amount;

    private LocalDate date;

    private String note;
}
