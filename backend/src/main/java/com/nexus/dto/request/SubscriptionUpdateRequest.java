package com.nexus.dto.request;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class SubscriptionUpdateRequest {
    private String name;
    private String category;
    private BigDecimal price;
    private String currency;
    private String billingType;
    private LocalDate startDate;
    private LocalDate expireDate;
    private LocalDate nextBillingDate;
    /** PATCH 中 null 表示不修改，清空日期需使用显式 flag 与 ToDo 更新语义保持一致。 */
    private Boolean clearStartDate;
    private Boolean clearExpireDate;
    private Boolean clearNextBillingDate;
    private BigDecimal usageLimit;
    private String usageUnit;
    private String url;
    private String notes;
    private String status;  // active|expired|cancelled|paused
    private Boolean notifyEnabled;
    private Integer notifyDaysBefore;
}
