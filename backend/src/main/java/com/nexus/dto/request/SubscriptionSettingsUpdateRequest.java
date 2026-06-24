package com.nexus.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/** SubscriptionSettingsUpdateRequest 用于更新订阅提醒策略，避免暴露原始 system_config key。 */
@Data
public class SubscriptionSettingsUpdateRequest {
    @NotNull
    @Min(1)
    @Max(90)
    private Integer notifyDaysBefore;
}
