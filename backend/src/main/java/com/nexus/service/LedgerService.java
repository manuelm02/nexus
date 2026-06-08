package com.nexus.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.nexus.dto.request.LedgerCreateRequest;
import com.nexus.dto.request.LedgerUpdateRequest;
import com.nexus.dto.request.LedgerUsageRequest;
import com.nexus.entity.Ledger;
import com.nexus.mapper.LedgerMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class LedgerService {

    private final LedgerMapper ledgerMapper;

    public List<Ledger> list() {
        return ledgerMapper.selectList(new LambdaQueryWrapper<Ledger>()
                .orderByDesc(Ledger::getCreatedAt));
    }

    public Ledger create(LedgerCreateRequest req) {
        Ledger ledger = new Ledger();
        ledger.setName(req.getName());
        ledger.setCategory(req.getCategory());
        ledger.setPrice(req.getPrice());
        ledger.setCurrency(req.getCurrency() != null ? req.getCurrency() : "CNY");
        ledger.setBillingType(req.getBillingType());
        ledger.setStartDate(req.getStartDate());
        ledger.setExpireDate(req.getExpireDate());
        ledger.setNextBillingDate(req.getNextBillingDate());
        ledger.setUsageLimit(req.getUsageLimit());
        ledger.setUsageUnit(req.getUsageUnit());
        ledger.setUrl(req.getUrl());
        ledger.setNotes(req.getNotes());
        ledger.setNotifyEnabled(req.isNotifyEnabled());
        ledger.setNotifyDaysBefore(req.getNotifyDaysBefore());
        ledger.setStatus("active");
        ledgerMapper.insert(ledger);
        return ledger;
    }

    public Ledger update(String id, LedgerUpdateRequest req) {
        Ledger ledger = getOrThrow(id);
        if (req.getName() != null) ledger.setName(req.getName());
        if (req.getCategory() != null) ledger.setCategory(req.getCategory());
        if (req.getPrice() != null) ledger.setPrice(req.getPrice());
        if (req.getCurrency() != null) ledger.setCurrency(req.getCurrency());
        if (req.getBillingType() != null) ledger.setBillingType(req.getBillingType());
        if (req.getStartDate() != null) ledger.setStartDate(req.getStartDate());
        if (req.getExpireDate() != null) ledger.setExpireDate(req.getExpireDate());
        if (req.getNextBillingDate() != null) ledger.setNextBillingDate(req.getNextBillingDate());
        if (req.getUsageLimit() != null) ledger.setUsageLimit(req.getUsageLimit());
        if (req.getUsageUnit() != null) ledger.setUsageUnit(req.getUsageUnit());
        if (req.getUrl() != null) ledger.setUrl(req.getUrl());
        if (req.getNotes() != null) ledger.setNotes(req.getNotes());
        if (req.getStatus() != null) ledger.setStatus(req.getStatus());
        if (req.getNotifyEnabled() != null) ledger.setNotifyEnabled(req.getNotifyEnabled());
        if (req.getNotifyDaysBefore() != null) ledger.setNotifyDaysBefore(req.getNotifyDaysBefore());
        ledgerMapper.updateById(ledger);
        return ledger;
    }

    public void delete(String id) {
        getOrThrow(id);
        ledgerMapper.deleteById(id);
    }

    public Ledger updateUsage(String id, LedgerUsageRequest req) {
        Ledger ledger = getOrThrow(id);
        ledger.setUsageUsed(req.getUsageUsed());
        ledgerMapper.updateById(ledger);
        return ledger;
    }

    private Ledger getOrThrow(String id) {
        Ledger ledger = ledgerMapper.selectById(id);
        if (ledger == null) throw new IllegalArgumentException("Ledger 不存在: " + id);
        return ledger;
    }
}
