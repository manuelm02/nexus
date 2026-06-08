package com.nexus.dto.request;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class LedgerUpdateRequest {
    private String name;
    private String category;
    private BigDecimal price;
    private String currency;
    private String billingType;
    private LocalDate startDate;
    private LocalDate expireDate;
    private LocalDate nextBillingDate;
    private BigDecimal usageLimit;
    private String usageUnit;
    private String url;
    private String notes;
    private String status;  // active|expired|cancelled|paused
    private Boolean notifyEnabled;
    private Integer notifyDaysBefore;
}
