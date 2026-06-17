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
    private String billingType;  // monthly|yearly|per_token|lifetime|one_time
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
    private BigDecimal remainingBalance;
    private boolean lowBalanceNotify;
    private BigDecimal lowBalanceThreshold;

    /** 余额自动监控的 Provider 标识，目前仅支持 "deepseek"；为空表示不开启自动监控 */
    private String apiProvider;

    /** 创建时一次性传入的明文 API Key，仅在 apiProvider 非空时使用，落库前会加密 */
    private String apiKey;
}
