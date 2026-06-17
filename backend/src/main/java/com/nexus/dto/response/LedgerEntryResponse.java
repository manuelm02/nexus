package com.nexus.dto.response;

import com.nexus.entity.SubscriptionLedgerEntry;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/** 充值/消费流水对外响应。 */
@Data
public class LedgerEntryResponse {
    private String id;
    private String type;
    private BigDecimal amount;
    private BigDecimal balanceAfter;
    private String note;
    private LocalDate occurredOn;
    private LocalDateTime createdAt;

    public static LedgerEntryResponse from(SubscriptionLedgerEntry entity) {
        LedgerEntryResponse response = new LedgerEntryResponse();
        response.setId(entity.getId());
        response.setType(entity.getEntryType());
        response.setAmount(entity.getAmount());
        response.setBalanceAfter(entity.getBalanceAfter());
        response.setNote(entity.getNote());
        response.setOccurredOn(entity.getOccurredOn());
        response.setCreatedAt(entity.getCreatedAt());
        return response;
    }
}
