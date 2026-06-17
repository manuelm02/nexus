package com.nexus.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.Map;

/** 订阅统计响应：按币种分组的订阅中数量、月度/年度/本月待支付总额。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SubscriptionStatsResponse {
    private int activeCount;
    private Map<String, BigDecimal> monthlyTotal;
    private Map<String, BigDecimal> yearlyTotal;
    private Map<String, BigDecimal> dueThisMonth;
}
