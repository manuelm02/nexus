package com.nexus.integration.balance;

import java.math.BigDecimal;

/** Provider 余额查询结果，currency/raw 用于落库 subscription_balance_snapshots.raw_json。 */
public record ProviderBalanceResult(BigDecimal balance, String currency, Object raw) {
}
