package com.nexus.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.nexus.dto.request.SubscriptionConsumeRequest;
import com.nexus.dto.request.SubscriptionCreateRequest;
import com.nexus.dto.request.SubscriptionRechargeRequest;
import com.nexus.dto.request.SubscriptionUpdateRequest;
import com.nexus.dto.request.SubscriptionUsageRequest;
import com.nexus.dto.response.BalanceSnapshotResponse;
import com.nexus.dto.response.LedgerEntryResponse;
import com.nexus.dto.response.SubscriptionResponse;
import com.nexus.dto.response.SubscriptionStatsResponse;
import com.nexus.entity.Subscription;
import com.nexus.entity.SubscriptionBalanceSnapshot;
import com.nexus.entity.SubscriptionLedgerEntry;
import com.nexus.integration.balance.DeepSeekBalanceClient;
import com.nexus.integration.balance.ProviderBalanceResult;
import com.nexus.mapper.SubscriptionBalanceSnapshotMapper;
import com.nexus.mapper.SubscriptionLedgerEntryMapper;
import com.nexus.mapper.SubscriptionMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

/** 管理订阅信息的生命周期、用量、到期提醒、自动续费滚动、按量充值/消费、余额同步和统计。 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SubscriptionService {

    private final SubscriptionMapper subscriptionMapper;
    private final SubscriptionLedgerEntryMapper ledgerMapper;
    private final SubscriptionBalanceSnapshotMapper balanceSnapshotMapper;
    private final LlmConfigService llmConfigService;
    private final DeepSeekBalanceClient deepSeekBalanceClient;

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
     * 创建订阅并填充默认值。apiProvider 非空时加密 Key 并立即同步余额，失败则整体回滚。
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
        subscription.setRemainingBalance(req.getRemainingBalance());
        subscription.setMonthlySpend(BigDecimal.ZERO);
        subscription.setLowBalanceNotify(req.isLowBalanceNotify());
        subscription.setLowBalanceThreshold(req.getLowBalanceThreshold());
        subscription.setStatus("active");

        // apiProvider 非空且提供了 apiKey 时，开启自动余额监控：加密存储 Key 并立即同步一次余额
        if (req.getApiProvider() != null && !req.getApiProvider().isBlank()) {
            if (req.getApiKey() == null || req.getApiKey().isBlank()) {
                throw new IllegalArgumentException("开启自动余额监控需要提供 API Key");
            }
            subscription.setApiProvider(req.getApiProvider());
            subscription.setApiKeyMasked(llmConfigService.encrypt(req.getApiKey()));
            subscription.setApiFetchEnabled(true);
        }

        subscriptionMapper.insert(subscription);

        if (subscription.isApiFetchEnabled()) {
            // 创建即同步一次，失败则直接抛出（事务回滚，避免用户拿到一个"余额未知"的账户）
            syncBalanceInternal(subscription);
        }

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
        if (req.getLowBalanceNotify() != null) subscription.setLowBalanceNotify(req.getLowBalanceNotify());
        if (req.getLowBalanceThreshold() != null) subscription.setLowBalanceThreshold(req.getLowBalanceThreshold());
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

    /**
     * 按量订阅充值：余额累加，并写入一条 recharge 流水。仅适用于 per_token 类型。
     * apiFetchEnabled 账户的 remainingBalance 不受充值影响（以 API 同步为真值），仅写入流水用于记账。
     */
    public SubscriptionResponse recharge(String id, SubscriptionRechargeRequest req) {
        Subscription subscription = getOrThrow(id);
        if (!"per_token".equals(subscription.getBillingType())) {
            throw new IllegalArgumentException("仅按量类型订阅支持充值");
        }
        BigDecimal currentBalance = subscription.getRemainingBalance() != null ? subscription.getRemainingBalance() : BigDecimal.ZERO;

        // apiFetchEnabled 账户的余额由 API 同步决定，充值仅作为记账备注，不修改 remainingBalance
        if (!subscription.isApiFetchEnabled()) {
            BigDecimal newBalance = currentBalance.add(req.getAmount());
            subscription.setRemainingBalance(newBalance);
            subscriptionMapper.updateById(subscription);
            writeLedgerEntry(id, "recharge", req.getAmount(), newBalance, req.getNote(), req.getDate() != null ? req.getDate() : LocalDate.now());
        } else {
            subscriptionMapper.updateById(subscription);
            BigDecimal balanceAfter = currentBalance.add(req.getAmount());
            writeLedgerEntry(id, "recharge", req.getAmount(), balanceAfter, req.getNote(), req.getDate() != null ? req.getDate() : LocalDate.now());
        }

        return SubscriptionResponse.from(subscription);
    }

    /**
     * 按量订阅消费记录：余额扣减（可为负），月消费累加，并写入一条 consume 流水。仅适用于 per_token 类型。
     * apiFetchEnabled 账户的 remainingBalance 不受消费影响（以 API 同步为真值），仅写入流水用于记账。
     */
    public SubscriptionResponse consume(String id, SubscriptionConsumeRequest req) {
        Subscription subscription = getOrThrow(id);
        if (!"per_token".equals(subscription.getBillingType())) {
            throw new IllegalArgumentException("仅按量类型订阅支持消费记录");
        }
        BigDecimal currentBalance = subscription.getRemainingBalance() != null ? subscription.getRemainingBalance() : BigDecimal.ZERO;

        BigDecimal currentSpend = subscription.getMonthlySpend() != null ? subscription.getMonthlySpend() : BigDecimal.ZERO;
        subscription.setMonthlySpend(currentSpend.add(req.getAmount()));

        if (!subscription.isApiFetchEnabled()) {
            BigDecimal newBalance = currentBalance.subtract(req.getAmount());
            subscription.setRemainingBalance(newBalance);
            subscriptionMapper.updateById(subscription);
            writeLedgerEntry(id, "consume", req.getAmount(), newBalance, req.getNote(), LocalDate.now());
        } else {
            subscriptionMapper.updateById(subscription);
            BigDecimal balanceAfter = currentBalance.subtract(req.getAmount());
            writeLedgerEntry(id, "consume", req.getAmount(), balanceAfter, req.getNote(), LocalDate.now());
        }

        return SubscriptionResponse.from(subscription);
    }

    private void writeLedgerEntry(String subscriptionId, String entryType, BigDecimal amount, BigDecimal balanceAfter, String note, LocalDate occurredOn) {
        SubscriptionLedgerEntry entry = new SubscriptionLedgerEntry();
        entry.setSubscriptionId(subscriptionId);
        entry.setEntryType(entryType);
        entry.setAmount(amount);
        entry.setBalanceAfter(balanceAfter);
        entry.setNote(note);
        entry.setOccurredOn(occurredOn);
        ledgerMapper.insert(entry);
    }

    /**
     * 获取按量订阅最近的充值/消费流水，按时间倒序。
     */
    public List<LedgerEntryResponse> getLedger(String id, int limit) {
        getOrThrow(id);
        return ledgerMapper.selectRecent(id, limit).stream()
                .map(LedgerEntryResponse::from)
                .collect(Collectors.toList());
    }

    /**
     * 手动刷新指定订阅的 API 余额。仅 apiFetchEnabled=true 的订阅可调用。
     */
    @Transactional
    public SubscriptionResponse syncBalance(String id) {
        Subscription subscription = getOrThrow(id);
        if (!subscription.isApiFetchEnabled()) {
            throw new IllegalStateException("该账户未开启自动余额监控");
        }
        syncBalanceInternal(subscription);
        return SubscriptionResponse.from(subscription);
    }

    /**
     * 实际执行余额同步：解密 Key → 调用 Provider → 覆盖 remainingBalance/apiBalanceJson/apiLastFetchedAt → 写入快照。
     * apiFetchEnabled 账户的 remainingBalance 以 Provider 返回值为唯一真值，不与流水累加结果叠加。
     */
    private void syncBalanceInternal(Subscription subscription) {
        String apiKey = llmConfigService.decrypt(subscription.getApiKeyMasked());
        ProviderBalanceResult result = switch (subscription.getApiProvider()) {
            case "deepseek" -> deepSeekBalanceClient.fetchBalance(apiKey);
            default -> throw new IllegalStateException("未知的余额监控 Provider: " + subscription.getApiProvider());
        };

        subscription.setRemainingBalance(result.balance());
        subscription.setApiBalanceJson(result.raw());
        subscription.setApiLastFetchedAt(LocalDateTime.now());
        subscriptionMapper.updateById(subscription);

        SubscriptionBalanceSnapshot snapshot = new SubscriptionBalanceSnapshot();
        snapshot.setSubscriptionId(subscription.getId());
        snapshot.setBalance(result.balance());
        snapshot.setCurrency(result.currency());
        snapshot.setRawJson(result.raw());
        snapshot.setSnapshottedAt(LocalDateTime.now());
        balanceSnapshotMapper.insert(snapshot);
    }

    /**
     * 返回最近 N 天的余额快照（升序），用于卡片内迷你趋势图。
     */
    public List<BalanceSnapshotResponse> getBalanceHistory(String id, int days) {
        return balanceSnapshotMapper.selectRecent(id, days)
                .stream()
                .map(BalanceSnapshotResponse::from)
                .collect(Collectors.toList());
    }

    /**
     * 每日定时同步所有开启了自动余额监控的订阅；单个账户失败不影响其余账户。
     */
    public int syncAllEnabledBalances() {
        List<Subscription> targets = subscriptionMapper.selectList(new LambdaQueryWrapper<Subscription>()
                .eq(Subscription::isApiFetchEnabled, true)
                .eq(Subscription::isArchived, false));
        int success = 0;
        for (Subscription s : targets) {
            try {
                syncBalanceInternal(s);
                success++;
            } catch (Exception e) {
                log.warn("订阅 [{}] 余额同步失败: {}", s.getName(), e.getMessage());
            }
        }
        return success;
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

            if ("lifetime".equals(s.getBillingType()) || "per_token".equals(s.getBillingType())) continue;

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

    /**
     * 月初重置所有 per_token 类型订阅的当月消费为 0。
     */
    public int resetMonthlySpend() {
        return subscriptionMapper.update(null, new LambdaUpdateWrapper<Subscription>()
                .set(Subscription::getMonthlySpend, BigDecimal.ZERO)
                .eq(Subscription::getBillingType, "per_token"));
    }

    /**
     * 查找低余额按量订阅：per_token + lowBalanceNotify=true + remainingBalance < lowBalanceThreshold + !archived。
     */
    public List<SubscriptionResponse> findLowBalance() {
        List<Subscription> all = subscriptionMapper.selectList(new LambdaQueryWrapper<Subscription>()
                .eq(Subscription::getBillingType, "per_token")
                .eq(Subscription::isLowBalanceNotify, true)
                .eq(Subscription::isArchived, false));

        return all.stream()
                .filter(s -> s.getRemainingBalance() != null
                        && s.getLowBalanceThreshold() != null
                        && s.getRemainingBalance().compareTo(s.getLowBalanceThreshold()) < 0)
                .map(SubscriptionResponse::from)
                .collect(Collectors.toList());
    }

    private Subscription getOrThrow(String id) {
        Subscription subscription = subscriptionMapper.selectById(id);
        if (subscription == null) throw new IllegalArgumentException("Subscription 不存在: " + id);
        return subscription;
    }
}
