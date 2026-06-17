package com.nexus.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

/** 按量订阅消费记录请求：金额必填且大于 0。 */
@Data
public class SubscriptionConsumeRequest {
    @NotNull(message = "消费金额不能为空")
    @DecimalMin(value = "0.01", message = "消费金额必须大于 0")
    private BigDecimal amount;

    private String note;
}
