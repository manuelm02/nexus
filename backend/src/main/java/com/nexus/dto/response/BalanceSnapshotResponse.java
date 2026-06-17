package com.nexus.dto.response;

import com.nexus.entity.SubscriptionBalanceSnapshot;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class BalanceSnapshotResponse {
    private BigDecimal balance;
    private String currency;
    private LocalDateTime snapshottedAt;

    public static BalanceSnapshotResponse from(SubscriptionBalanceSnapshot entity) {
        BalanceSnapshotResponse r = new BalanceSnapshotResponse();
        r.setBalance(entity.getBalance());
        r.setCurrency(entity.getCurrency());
        r.setSnapshottedAt(entity.getSnapshottedAt());
        return r;
    }
}
