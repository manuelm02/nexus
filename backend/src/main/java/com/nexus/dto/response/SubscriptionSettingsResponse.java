package com.nexus.dto.response;

import lombok.Data;

/** SubscriptionSettingsResponse 返回 Panel Hub 中订阅提醒相关设置。 */
@Data
public class SubscriptionSettingsResponse {
    /** 到期前提醒天数，默认 7 */
    private int notifyDaysBefore;
}
