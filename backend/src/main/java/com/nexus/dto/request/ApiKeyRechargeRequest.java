package com.nexus.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

/** API Key 充值请求 */
@Data
public class ApiKeyRechargeRequest {
    @NotNull(message = "金额不能为空")
    @DecimalMin(value = "0.01", message = "金额必须大于 0")
    private BigDecimal amount;

    /** 充值日期，默认当天 */
    private LocalDate date;

    /** 备注 */
    private String note;
}
