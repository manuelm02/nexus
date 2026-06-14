package com.nexus.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.nexus.dto.request.SubscriptionCreateRequest;
import com.nexus.dto.request.SubscriptionUpdateRequest;
import com.nexus.dto.request.SubscriptionUsageRequest;
import com.nexus.dto.response.SubscriptionResponse;
import com.nexus.entity.Subscription;
import com.nexus.mapper.SubscriptionMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/** 管理订阅信息的生命周期、用量和到期提醒字段。 */
@Service
@RequiredArgsConstructor
public class SubscriptionService {

    private static final Set<String> ALLOWED_STATUSES = Set.of("active", "expired", "cancelled", "paused");

    private final SubscriptionMapper subscriptionMapper;

    /**
     * 按创建时间倒序列出订阅。
     *
     * @return 不暴露 api_* 休眠字段的订阅响应列表
     */
    public List<SubscriptionResponse> list() {
        return subscriptionMapper.selectList(new LambdaQueryWrapper<Subscription>()
                .orderByDesc(Subscription::getCreatedAt))
                .stream()
                .map(SubscriptionResponse::from)
                .collect(Collectors.toList());
    }

    /**
     * 创建订阅并填充 Phase 4 默认值。
     *
     * @param req 创建请求，name 必填，其余字段可选
     * @return 创建后的订阅响应
     */
    public SubscriptionResponse create(SubscriptionCreateRequest req) {
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
        return SubscriptionResponse.from(subscription);
    }

    /**
     * 更新订阅基础字段，status 只允许 Phase 4 定义的四种状态。
     *
     * @param id 订阅 ID
     * @param req 更新请求，null 字段表示不修改
     * @return 更新后的订阅响应
     */
    public SubscriptionResponse update(String id, SubscriptionUpdateRequest req) {
        Subscription subscription = getOrThrow(id);
        if (req.getName() != null) subscription.setName(req.getName());
        if (req.getCategory() != null) subscription.setCategory(req.getCategory());
        if (req.getPrice() != null) subscription.setPrice(req.getPrice());
        if (req.getCurrency() != null) subscription.setCurrency(req.getCurrency());
        if (req.getBillingType() != null) subscription.setBillingType(req.getBillingType());
        if (Boolean.TRUE.equals(req.getClearStartDate())) subscription.setStartDate(null);
        else if (req.getStartDate() != null) subscription.setStartDate(req.getStartDate());
        if (Boolean.TRUE.equals(req.getClearExpireDate())) subscription.setExpireDate(null);
        else if (req.getExpireDate() != null) subscription.setExpireDate(req.getExpireDate());
        if (Boolean.TRUE.equals(req.getClearNextBillingDate())) subscription.setNextBillingDate(null);
        else if (req.getNextBillingDate() != null) subscription.setNextBillingDate(req.getNextBillingDate());
        if (req.getUsageLimit() != null) subscription.setUsageLimit(req.getUsageLimit());
        if (req.getUsageUnit() != null) subscription.setUsageUnit(req.getUsageUnit());
        if (req.getUrl() != null) subscription.setUrl(req.getUrl());
        if (req.getNotes() != null) subscription.setNotes(req.getNotes());
        if (req.getStatus() != null) {
            validateStatus(req.getStatus());
            subscription.setStatus(req.getStatus());
        }
        if (req.getNotifyEnabled() != null) subscription.setNotifyEnabled(req.getNotifyEnabled());
        if (req.getNotifyDaysBefore() != null) subscription.setNotifyDaysBefore(req.getNotifyDaysBefore());
        subscriptionMapper.updateById(subscription);
        return SubscriptionResponse.from(subscription);
    }

    /**
     * 删除订阅。
     *
     * @param id 订阅 ID，不存在时抛出 IllegalArgumentException
     */
    public void delete(String id) {
        getOrThrow(id);
        subscriptionMapper.deleteById(id);
    }

    /**
     * 手动更新订阅用量。
     *
     * @param id 订阅 ID
     * @param req 用量请求，usageUsed 表示当前手工记录值
     * @return 更新后的订阅响应
     */
    public SubscriptionResponse updateUsage(String id, SubscriptionUsageRequest req) {
        Subscription subscription = getOrThrow(id);
        subscription.setUsageUsed(req.getUsageUsed());
        subscriptionMapper.updateById(subscription);
        return SubscriptionResponse.from(subscription);
    }

    /**
     * 将状态为 active 且已过期的订阅自动置为 expired。
     *
     * @return 本次自动置为 expired 的记录数，便于调度日志和测试断言
     */
    public int autoExpireOverdue() {
        return subscriptionMapper.update(null, new LambdaUpdateWrapper<Subscription>()
                .set(Subscription::getStatus, "expired")
                .eq(Subscription::getStatus, "active")
                .isNotNull(Subscription::getExpireDate)
                .lt(Subscription::getExpireDate, LocalDate.now()));
    }

    private Subscription getOrThrow(String id) {
        Subscription subscription = subscriptionMapper.selectById(id);
        if (subscription == null) throw new IllegalArgumentException("Subscription 不存在: " + id);
        return subscription;
    }

    private void validateStatus(String status) {
        if (!ALLOWED_STATUSES.contains(status)) {
            throw new IllegalArgumentException("Subscription 状态不合法: " + status);
        }
    }
}
