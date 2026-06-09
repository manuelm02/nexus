package com.nexus.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.nexus.dto.request.SubscriptionCreateRequest;
import com.nexus.dto.request.SubscriptionUpdateRequest;
import com.nexus.dto.request.SubscriptionUsageRequest;
import com.nexus.entity.Subscription;
import com.nexus.mapper.SubscriptionMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

/** 管理订阅信息的生命周期、用量和到期提醒字段。 */
@Service
@RequiredArgsConstructor
public class SubscriptionService {

    private final SubscriptionMapper subscriptionMapper;

    public List<Subscription> list() {
        return subscriptionMapper.selectList(new LambdaQueryWrapper<Subscription>()
                .orderByDesc(Subscription::getCreatedAt));
    }

    public Subscription create(SubscriptionCreateRequest req) {
        Subscription subscription = new Subscription();
        subscription.setName(req.getName());
        subscription.setCategory(req.getCategory());
        subscription.setPrice(req.getPrice());
        subscription.setCurrency(req.getCurrency() != null ? req.getCurrency() : "CNY");
        subscription.setBillingType(req.getBillingType());
        subscription.setStartDate(req.getStartDate());
        subscription.setExpireDate(req.getExpireDate());
        subscription.setNextBillingDate(req.getNextBillingDate());
        subscription.setUsageLimit(req.getUsageLimit());
        subscription.setUsageUnit(req.getUsageUnit());
        subscription.setUrl(req.getUrl());
        subscription.setNotes(req.getNotes());
        subscription.setNotifyEnabled(req.isNotifyEnabled());
        subscription.setNotifyDaysBefore(req.getNotifyDaysBefore());
        subscription.setStatus("active");
        subscriptionMapper.insert(subscription);
        return subscription;
    }

    public Subscription update(String id, SubscriptionUpdateRequest req) {
        Subscription subscription = getOrThrow(id);
        if (req.getName() != null) subscription.setName(req.getName());
        if (req.getCategory() != null) subscription.setCategory(req.getCategory());
        if (req.getPrice() != null) subscription.setPrice(req.getPrice());
        if (req.getCurrency() != null) subscription.setCurrency(req.getCurrency());
        if (req.getBillingType() != null) subscription.setBillingType(req.getBillingType());
        if (req.getStartDate() != null) subscription.setStartDate(req.getStartDate());
        if (req.getExpireDate() != null) subscription.setExpireDate(req.getExpireDate());
        if (req.getNextBillingDate() != null) subscription.setNextBillingDate(req.getNextBillingDate());
        if (req.getUsageLimit() != null) subscription.setUsageLimit(req.getUsageLimit());
        if (req.getUsageUnit() != null) subscription.setUsageUnit(req.getUsageUnit());
        if (req.getUrl() != null) subscription.setUrl(req.getUrl());
        if (req.getNotes() != null) subscription.setNotes(req.getNotes());
        if (req.getStatus() != null) subscription.setStatus(req.getStatus());
        if (req.getNotifyEnabled() != null) subscription.setNotifyEnabled(req.getNotifyEnabled());
        if (req.getNotifyDaysBefore() != null) subscription.setNotifyDaysBefore(req.getNotifyDaysBefore());
        subscriptionMapper.updateById(subscription);
        return subscription;
    }

    public void delete(String id) {
        getOrThrow(id);
        subscriptionMapper.deleteById(id);
    }

    public Subscription updateUsage(String id, SubscriptionUsageRequest req) {
        Subscription subscription = getOrThrow(id);
        subscription.setUsageUsed(req.getUsageUsed());
        subscriptionMapper.updateById(subscription);
        return subscription;
    }

    private Subscription getOrThrow(String id) {
        Subscription subscription = subscriptionMapper.selectById(id);
        if (subscription == null) throw new IllegalArgumentException("Subscription 不存在: " + id);
        return subscription;
    }
}
