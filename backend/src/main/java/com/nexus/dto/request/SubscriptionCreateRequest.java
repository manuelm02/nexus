package com.nexus.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class SubscriptionCreateRequest {
    @NotBlank(message = "名称不能为空")
    private String name;

    private String category;
    private BigDecimal price;
    private String currency = "CNY";
    private String billingType;  // monthly|yearly|lifetime|one_time
    private LocalDate startDate;
    private LocalDate expireDate;
    private LocalDate nextBillingDate;
    private BigDecimal usageLimit;
    private String usageUnit;
    private String url;
    private String notes;
    private boolean notifyEnabled = true;
    private int notifyDaysBefore = 7;
    private boolean autoRenew;
    private boolean archived;
}
