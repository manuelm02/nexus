package com.nexus.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class SubscriptionUsageRequest {
    @NotNull(message = "用量不能为空")
    private BigDecimal usageUsed;
}
