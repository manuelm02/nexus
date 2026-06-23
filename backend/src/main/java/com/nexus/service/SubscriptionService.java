package com.nexus.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.nexus.dto.request.SubscriptionCreateRequest;
import com.nexus.dto.request.SubscriptionUpdateRequest;
import com.nexus.dto.request.SubscriptionUsageRequest;
import com.nexus.dto.response.SubscriptionResponse;
import com.nexus.dto.response.SubscriptionStatsResponse;
import com.nexus.entity.Subscription;
import com.nexus.mapper.SubscriptionMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

/** 管理订阅信息的生命周期、用量、到期提醒、自动续费滚动和统计。 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SubscriptionService {

    private final SubscriptionMapper subscriptionMapper;

    /**
     * 按创建时间倒序列出订阅。
     */
    public List<SubscriptionResponse> list() {
        return subscriptionMapper.selectList(new LambdaQueryWrapper<Subscription>()
                .orderByDesc(Subscription::getCreatedAt))
                .stream()
                .map(SubscriptionResponse::from)
                .collect(Collectors.toList());
    }

    /**
     * 创建订阅并填充默认值。
     */
    @Transactional
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
        subscription.setAutoRenew(req.isAutoRenew());
        subscription.setArchived(req.isArchived());
        subscription.setStatus("active");

        subscriptionMapper.insert(subscription);

        return SubscriptionResponse.from(subscription);
    }

    /**
     * 更新订阅基础字段；status 不再由前端传入，改为由 recomputeDateBasedStatuses 按日期自动重算。
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
        if (req.getNotifyEnabled() != null) subscription.setNotifyEnabled(req.getNotifyEnabled());
        if (req.getNotifyDaysBefore() != null) subscription.setNotifyDaysBefore(req.getNotifyDaysBefore());
        if (req.getAutoRenew() != null) subscription.setAutoRenew(req.getAutoRenew());
        if (req.getArchived() != null) subscription.setArchived(req.getArchived());
        subscriptionMapper.updateById(subscription);
        return SubscriptionResponse.from(subscription);
    }

    /**
     * 删除订阅。
     */
    public void delete(String id) {
        getOrThrow(id);
        subscriptionMapper.deleteById(id);
    }

    /**
     * 手动更新订阅用量。
     */
    public SubscriptionResponse updateUsage(String id, SubscriptionUsageRequest req) {
        Subscription subscription = getOrThrow(id);
        subscription.setUsageUsed(req.getUsageUsed());
        subscriptionMapper.updateById(subscription);
        return SubscriptionResponse.from(subscription);
    }

    /**
     * 按日期重算 monthly/yearly/one_time 订阅状态：
     * - expireDate 为空或 >= today → active
     * - expireDate < today 且超期 ≤ 7 天 → expired
     * - expireDate < today 且超期 > 7 天 → paused
     * autoRenew=true 的 monthly/yearly 由 rollAutoRenewals 保证 active，此处跳过。
     */
    public int recomputeDateBasedStatuses() {
        LocalDate today = LocalDate.now();
        List<Subscription> candidates = subscriptionMapper.selectList(new LambdaQueryWrapper<Subscription>()
                .eq(Subscription::isArchived, false)
                .in(Subscription::getBillingType, "monthly", "yearly", "one_time"));

        int count = 0;
        for (Subscription s : candidates) {
            if (s.isAutoRenew() && ("monthly".equals(s.getBillingType()) || "yearly".equals(s.getBillingType()))) {
                continue;
            }
            String newStatus = computeDateBasedStatus(s, today);
            if (newStatus != null && !newStatus.equals(s.getStatus())) {
                s.setStatus(newStatus);
                subscriptionMapper.updateById(s);
                count++;
            }
        }
        return count;
    }

    private String computeDateBasedStatus(Subscription s, LocalDate today) {
        LocalDate expireDate = s.getExpireDate();
        if (expireDate == null || !expireDate.isBefore(today)) {
            return "active";
        }
        long overdueDays = ChronoUnit.DAYS.between(expireDate, today);
        return overdueDays <= 7 ? "expired" : "paused";
    }

    /** 当前未归档订阅涉及的所有币种（用于汇率刷新范围），CNY 一定包含在内。 */
    public Set<String> distinctActiveCurrencies() {
        Set<String> currencies = subscriptionMapper.selectList(new LambdaQueryWrapper<Subscription>()
                .eq(Subscription::isArchived, false))
                .stream()
                .map(s -> s.getCurrency() == null ? "CNY" : s.getCurrency())
                .collect(Collectors.toSet());
        currencies.add("CNY");
        return currencies;
    }

    /**
     * 订阅统计：按币种分组的 activeCount / monthlyTotal / yearlyTotal / dueThisMonth。
     * 排除 archived 和非 active 状态的记录。
     */
    public SubscriptionStatsResponse stats() {
        List<Subscription> all = subscriptionMapper.selectList(null);
        LocalDate today = LocalDate.now();
        LocalDate monthEnd = today.withDayOfMonth(today.lengthOfMonth());

        int activeCount = 0;
        Map<String, BigDecimal> monthlyTotal = new HashMap<>();
        Map<String, BigDecimal> yearlyTotal = new HashMap<>();
        Map<String, BigDecimal> dueThisMonth = new HashMap<>();

        for (Subscription s : all) {
            if (s.isArchived() || !"active".equals(s.getStatus())) continue;
            activeCount++;

            String currency = s.getCurrency() != null ? s.getCurrency() : "CNY";
            BigDecimal price = s.getPrice() != null ? s.getPrice() : BigDecimal.ZERO;

            if ("monthly".equals(s.getBillingType())) {
                monthlyTotal.merge(currency, price, BigDecimal::add);
            } else if ("yearly".equals(s.getBillingType())) {
                yearlyTotal.merge(currency, price, BigDecimal::add);
            }

            if ("lifetime".equals(s.getBillingType())) continue;

            // dueThisMonth 计算
            LocalDate checkDate = null;
            if (s.isAutoRenew() && ("monthly".equals(s.getBillingType()) || "yearly".equals(s.getBillingType()))) {
                checkDate = s.getNextBillingDate();
            } else if ("monthly".equals(s.getBillingType()) || "yearly".equals(s.getBillingType()) || "one_time".equals(s.getBillingType())) {
                checkDate = s.getExpireDate();
            }

            if (checkDate != null && !checkDate.isBefore(today) && !checkDate.isAfter(monthEnd)) {
                dueThisMonth.merge(currency, price, BigDecimal::add);
            }
        }

        return SubscriptionStatsResponse.builder()
                .activeCount(activeCount)
                .monthlyTotal(monthlyTotal)
                .yearlyTotal(yearlyTotal)
                .dueThisMonth(dueThisMonth)
                .build();
    }

    /**
     * 自动续费滚动：对 active + autoRenew=true 的 monthly/yearly 过期记录，
     * 按周期前移 expireDate 和 nextBillingDate 直到 >= today，保持 active 不变。
     */
    public int rollAutoRenewals() {
        LocalDate today = LocalDate.now();
        List<Subscription> candidates = subscriptionMapper.selectList(new LambdaQueryWrapper<Subscription>()
                .eq(Subscription::getStatus, "active")
                .eq(Subscription::isAutoRenew, true)
                .in(Subscription::getBillingType, "monthly", "yearly")
                .isNotNull(Subscription::getExpireDate)
                .lt(Subscription::getExpireDate, today));

        int count = 0;
        for (Subscription s : candidates) {
            boolean changed = false;
            while (s.getExpireDate() != null && s.getExpireDate().isBefore(today)) {
                if ("monthly".equals(s.getBillingType())) {
                    s.setExpireDate(s.getExpireDate().plusMonths(1));
                    if (s.getNextBillingDate() != null) {
                        s.setNextBillingDate(s.getNextBillingDate().plusMonths(1));
                    }
                } else {
                    s.setExpireDate(s.getExpireDate().plusYears(1));
                    if (s.getNextBillingDate() != null) {
                        s.setNextBillingDate(s.getNextBillingDate().plusYears(1));
                    }
                }
                changed = true;
            }
            if (changed) {
                subscriptionMapper.updateById(s);
                count++;
            }
        }
        return count;
    }

    private Subscription getOrThrow(String id) {
        Subscription subscription = subscriptionMapper.selectById(id);
        if (subscription == null) throw new IllegalArgumentException("Subscription 不存在: " + id);
        return subscription;
    }
}
