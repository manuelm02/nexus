package com.nexus.service;

import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
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
import org.apache.ibatis.builder.MapperBuilderAssistant;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SubscriptionServiceTest {

    @Mock
    private SubscriptionMapper subscriptionMapper;

    @Mock
    private SubscriptionLedgerEntryMapper ledgerMapper;

    @Mock
    private SubscriptionBalanceSnapshotMapper balanceSnapshotMapper;

    @Mock
    private LlmConfigService llmConfigService;

    @Mock
    private DeepSeekBalanceClient deepSeekBalanceClient;

    @InjectMocks
    private SubscriptionService subscriptionService;

    @Test
    void createShouldDefaultStatusAndCurrency() {
        SubscriptionCreateRequest req = new SubscriptionCreateRequest();
        req.setName("ChatGPT");
        req.setCurrency(null);

        SubscriptionResponse result = subscriptionService.create(req);

        assertThat(result.getStatus()).isEqualTo("active");
        assertThat(result.getCurrency()).isEqualTo("CNY");
        verify(subscriptionMapper).insert(any(Subscription.class));
    }

    @Test
    void updateShouldWriteEditableFields() {
        Subscription existing = buildSubscription("s1", "Old");
        when(subscriptionMapper.selectById("s1")).thenReturn(existing);

        SubscriptionUpdateRequest req = new SubscriptionUpdateRequest();
        req.setName("Claude");
        req.setCategory("AI");
        req.setPrice(new BigDecimal("20.00"));
        req.setCurrency("USD");
        req.setBillingType("monthly");
        req.setStartDate(LocalDate.of(2026, 1, 1));
        req.setExpireDate(LocalDate.of(2026, 12, 31));
        req.setNextBillingDate(LocalDate.of(2026, 7, 1));
        req.setUsageLimit(new BigDecimal("1000"));
        req.setUsageUnit("tokens");
        req.setUrl("https://example.com");
        req.setNotes("team plan");
        req.setNotifyEnabled(false);
        req.setNotifyDaysBefore(3);

        SubscriptionResponse result = subscriptionService.update("s1", req);

        assertThat(result.getName()).isEqualTo("Claude");
        assertThat(result.getCurrency()).isEqualTo("USD");
        assertThat(result.getStatus()).isEqualTo("active");
        assertThat(result.getExpireDate()).isEqualTo(LocalDate.of(2026, 12, 31));
        assertThat(result.getUsageLimit()).isEqualByComparingTo("1000");
        assertThat(result.isNotifyEnabled()).isFalse();
        assertThat(result.getNotifyDaysBefore()).isEqualTo(3);
        verify(subscriptionMapper).updateById(existing);
    }

    @Test
    void updateUsageShouldWriteUsageUsed() {
        Subscription existing = buildSubscription("s1", "ChatGPT");
        when(subscriptionMapper.selectById("s1")).thenReturn(existing);

        SubscriptionUsageRequest req = new SubscriptionUsageRequest();
        req.setUsageUsed(new BigDecimal("42"));

        SubscriptionResponse result = subscriptionService.updateUsage("s1", req);

        assertThat(result.getUsageUsed()).isEqualByComparingTo("42");
        verify(subscriptionMapper).updateById(existing);
    }

    @Test
    void recomputeDateBasedStatuses_shouldApplyRulesAndSkipAutoRenew() {
        LocalDate today = LocalDate.now();

        Subscription activeNoExpire = buildSubscription("s1", "NoExpire", "monthly");
        activeNoExpire.setExpireDate(null);

        Subscription activeFuture = buildSubscription("s2", "Future", "yearly");
        activeFuture.setExpireDate(today.plusDays(3));
        activeFuture.setStatus("paused");

        Subscription expiredWithin7 = buildSubscription("s3", "Expired7", "monthly");
        expiredWithin7.setExpireDate(today.minusDays(5));
        expiredWithin7.setStatus("active");

        Subscription pausedOver7 = buildSubscription("s4", "PausedOver7", "one_time");
        pausedOver7.setExpireDate(today.minusDays(10));
        pausedOver7.setStatus("active");

        Subscription autoRenew = buildSubscription("s5", "AutoRenew", "monthly");
        autoRenew.setAutoRenew(true);
        autoRenew.setExpireDate(today.minusDays(1));
        autoRenew.setStatus("active");

        when(subscriptionMapper.selectList(any(LambdaQueryWrapper.class)))
                .thenReturn(List.of(activeNoExpire, activeFuture, expiredWithin7, pausedOver7, autoRenew));

        int affected = subscriptionService.recomputeDateBasedStatuses();

        assertThat(affected).isEqualTo(3);
        assertThat(activeNoExpire.getStatus()).isEqualTo("active");
        assertThat(activeFuture.getStatus()).isEqualTo("active");
        assertThat(expiredWithin7.getStatus()).isEqualTo("expired");
        assertThat(pausedOver7.getStatus()).isEqualTo("paused");
        assertThat(autoRenew.getStatus()).isEqualTo("active");
    }

    @Test
    void responseShouldExposeApiFieldsWhenEnabled() throws Exception {
        Subscription entity = buildSubscription("s1", "DeepSeek");
        entity.setApiProvider("deepseek");
        entity.setApiFetchEnabled(true);
        entity.setApiLastFetchedAt(LocalDateTime.of(2026, 6, 16, 0, 30));
        entity.setApiBalanceJson("{\"balance\":10}");

        SubscriptionResponse response = SubscriptionResponse.from(entity);

        assertThat(response.getApiProvider()).isEqualTo("deepseek");
        assertThat(response.isApiFetchEnabled()).isTrue();
        assertThat(response.getApiLastFetchedAt()).isEqualTo(LocalDateTime.of(2026, 6, 16, 0, 30));
    }

    // ========== Subscriptions UI 重构测试 ==========

    /** 按量充值：验证余额累加、写入 recharge 流水。 */
    @Test
    void recharge_balanceAndLedgerEntry() {
        Subscription sub = buildSubscription("s1", "GPT-API", "per_token");
        sub.setRemainingBalance(BigDecimal.ZERO);
        when(subscriptionMapper.selectById("s1")).thenReturn(sub);

        SubscriptionRechargeRequest req1 = new SubscriptionRechargeRequest();
        req1.setAmount(new BigDecimal("50"));
        SubscriptionResponse r1 = subscriptionService.recharge("s1", req1);
        assertThat(r1.getRemainingBalance()).isEqualByComparingTo("50");

        SubscriptionRechargeRequest req2 = new SubscriptionRechargeRequest();
        req2.setAmount(new BigDecimal("30"));
        SubscriptionResponse r2 = subscriptionService.recharge("s1", req2);
        assertThat(r2.getRemainingBalance()).isEqualByComparingTo("80");

        ArgumentCaptor<SubscriptionLedgerEntry> captor = ArgumentCaptor.forClass(SubscriptionLedgerEntry.class);
        verify(ledgerMapper, times(2)).insert(captor.capture());

        SubscriptionLedgerEntry first = captor.getAllValues().get(0);
        assertThat(first.getSubscriptionId()).isEqualTo("s1");
        assertThat(first.getEntryType()).isEqualTo("recharge");
        assertThat(first.getAmount()).isEqualByComparingTo("50");
        assertThat(first.getBalanceAfter()).isEqualByComparingTo("50");

        SubscriptionLedgerEntry second = captor.getAllValues().get(1);
        assertThat(second.getAmount()).isEqualByComparingTo("30");
        assertThat(second.getBalanceAfter()).isEqualByComparingTo("80");
    }

    /** 非按量订阅充值应抛异常。 */
    @Test
    void recharge_nonPerToken_throws() {
        Subscription sub = buildSubscription("s1", "ChatGPT", "monthly");
        when(subscriptionMapper.selectById("s1")).thenReturn(sub);

        SubscriptionRechargeRequest req = new SubscriptionRechargeRequest();
        req.setAmount(new BigDecimal("50"));

        assertThatThrownBy(() -> subscriptionService.recharge("s1", req))
                .isInstanceOf(IllegalArgumentException.class);
    }

    /** 按量消费：验证余额扣减（可为负）、月消费累加、写入 consume 流水。 */
    @Test
    void consume_balanceAndSpend() {
        Subscription sub = buildSubscription("s1", "GPT-API", "per_token");
        sub.setRemainingBalance(new BigDecimal("100"));
        sub.setMonthlySpend(BigDecimal.ZERO);
        when(subscriptionMapper.selectById("s1")).thenReturn(sub);

        SubscriptionConsumeRequest req1 = new SubscriptionConsumeRequest();
        req1.setAmount(new BigDecimal("30"));
        SubscriptionResponse r1 = subscriptionService.consume("s1", req1);

        assertThat(r1.getRemainingBalance()).isEqualByComparingTo("70");
        assertThat(r1.getMonthlySpend()).isEqualByComparingTo("30");

        SubscriptionConsumeRequest req2 = new SubscriptionConsumeRequest();
        req2.setAmount(new BigDecimal("80"));
        SubscriptionResponse r2 = subscriptionService.consume("s1", req2);

        assertThat(r2.getRemainingBalance()).isEqualByComparingTo("-10");

        ArgumentCaptor<SubscriptionLedgerEntry> captor = ArgumentCaptor.forClass(SubscriptionLedgerEntry.class);
        verify(ledgerMapper, times(2)).insert(captor.capture());

        SubscriptionLedgerEntry first = captor.getAllValues().get(0);
        assertThat(first.getEntryType()).isEqualTo("consume");
        assertThat(first.getAmount()).isEqualByComparingTo("30");
        assertThat(first.getBalanceAfter()).isEqualByComparingTo("70");

        SubscriptionLedgerEntry second = captor.getAllValues().get(1);
        assertThat(second.getBalanceAfter()).isEqualByComparingTo("-10");
    }

    /** 非按量订阅消费应抛异常。 */
    @Test
    void consume_nonPerToken_throws() {
        Subscription sub = buildSubscription("s1", "ChatGPT", "yearly");
        when(subscriptionMapper.selectById("s1")).thenReturn(sub);

        SubscriptionConsumeRequest req = new SubscriptionConsumeRequest();
        req.setAmount(new BigDecimal("30"));

        assertThatThrownBy(() -> subscriptionService.consume("s1", req))
                .isInstanceOf(IllegalArgumentException.class);
    }

    /** 获取流水：按 selectRecent 返回顺序映射为响应列表。 */
    @Test
    void getLedger_returnsMappedEntries() {
        Subscription sub = buildSubscription("s1", "GPT-API", "per_token");
        when(subscriptionMapper.selectById("s1")).thenReturn(sub);

        SubscriptionLedgerEntry entry = new SubscriptionLedgerEntry();
        entry.setId("e1");
        entry.setSubscriptionId("s1");
        entry.setEntryType("consume");
        entry.setAmount(new BigDecimal("12.50"));
        entry.setBalanceAfter(new BigDecimal("87.50"));
        entry.setOccurredOn(LocalDate.now());
        when(ledgerMapper.selectRecent("s1", 20)).thenReturn(List.of(entry));

        List<LedgerEntryResponse> result = subscriptionService.getLedger("s1", 20);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getId()).isEqualTo("e1");
        assertThat(result.get(0).getType()).isEqualTo("consume");
        assertThat(result.get(0).getAmount()).isEqualByComparingTo("12.50");
        assertThat(result.get(0).getBalanceAfter()).isEqualByComparingTo("87.50");
    }

    /** 自动续费滚动：monthly + autoRenew + 已过期 → expireDate 前移到 >= today。 */
    @Test
    void rollAutoRenewals_monthly() {
        TableInfoHelper.initTableInfo(new MapperBuilderAssistant(new MybatisConfiguration(), ""), Subscription.class);
        Subscription sub = buildSubscription("s1", "ChatGPT", "monthly");
        sub.setAutoRenew(true);
        sub.setExpireDate(LocalDate.now().minusMonths(2));
        sub.setNextBillingDate(LocalDate.now().minusMonths(2));
        when(subscriptionMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of(sub));

        int count = subscriptionService.rollAutoRenewals();

        assertThat(count).isEqualTo(1);
        assertThat(sub.getExpireDate()).isAfterOrEqualTo(LocalDate.now());
        assertThat(sub.getStatus()).isEqualTo("active");
        verify(subscriptionMapper).updateById(sub);
    }

    /** autoRenew=false 的订阅不触发自动续费滚动（DB 查询会过滤掉，模拟返回空列表）。 */
    @Test
    void rollAutoRenewals_autoRenewFalse_noChange() {
        TableInfoHelper.initTableInfo(new MapperBuilderAssistant(new MybatisConfiguration(), ""), Subscription.class);
        when(subscriptionMapper.selectList(any(LambdaQueryWrapper.class))).thenReturn(List.of());

        int count = subscriptionService.rollAutoRenewals();

        assertThat(count).isZero();
    }

    /** 月初重置所有 per_token 订阅的 monthlySpend。 */
    @Test
    void resetMonthlySpend() {
        TableInfoHelper.initTableInfo(new MapperBuilderAssistant(new MybatisConfiguration(), ""), Subscription.class);
        when(subscriptionMapper.update(isNull(), any(LambdaUpdateWrapper.class))).thenReturn(2);

        int count = subscriptionService.resetMonthlySpend();

        assertThat(count).isEqualTo(2);
    }

    /** 统计：activeCount / monthlyTotal / yearlyTotal 正确计算，排除 archived 和非 active 状态。 */
    @Test
    void stats_activeCountAndTotals() {
        Subscription activeMonthly = buildSubscription("s1", "ChatGPT", "monthly");
        activeMonthly.setPrice(new BigDecimal("20"));
        activeMonthly.setArchived(false);

        Subscription activeYearly = buildSubscription("s2", "iCloud", "yearly");
        activeYearly.setPrice(new BigDecimal("100"));
        activeYearly.setArchived(false);

        Subscription archivedMonthly = buildSubscription("s3", "OldSub", "monthly");
        archivedMonthly.setPrice(new BigDecimal("10"));
        archivedMonthly.setArchived(true);

        Subscription pausedMonthly = buildSubscription("s4", "Paused", "monthly");
        pausedMonthly.setPrice(new BigDecimal("15"));
        pausedMonthly.setStatus("paused");
        pausedMonthly.setArchived(false);

        when(subscriptionMapper.selectList(isNull())).thenReturn(
                List.of(activeMonthly, activeYearly, archivedMonthly, pausedMonthly));

        SubscriptionStatsResponse stats = subscriptionService.stats();

        assertThat(stats.getActiveCount()).isEqualTo(2);
        assertThat(stats.getMonthlyTotal().get("CNY")).isEqualByComparingTo("20");
        assertThat(stats.getYearlyTotal().get("CNY")).isEqualByComparingTo("100");
    }

    // ========== 余额同步测试 ==========

    /** 创建带 DeepSeek Provider 的账户：加密 Key、同步余额、写入快照。 */
    @Test
    void create_withDeepSeekProvider_encryptsKeyAndSyncsBalance() {
        when(llmConfigService.encrypt("sk-test")).thenReturn("encrypted-key");
        when(llmConfigService.decrypt("encrypted-key")).thenReturn("sk-test");
        when(deepSeekBalanceClient.fetchBalance("sk-test"))
                .thenReturn(new ProviderBalanceResult(new BigDecimal("99.50"), "CNY", "{\"balance\":99.50}"));

        SubscriptionCreateRequest req = new SubscriptionCreateRequest();
        req.setName("个人 DeepSeek");
        req.setBillingType("per_token");
        req.setApiProvider("deepseek");
        req.setApiKey("sk-test");

        SubscriptionResponse result = subscriptionService.create(req);

        assertThat(result.isApiFetchEnabled()).isTrue();
        assertThat(result.getApiProvider()).isEqualTo("deepseek");
        assertThat(result.getRemainingBalance()).isEqualByComparingTo("99.50");

        ArgumentCaptor<Subscription> subCaptor = ArgumentCaptor.forClass(Subscription.class);
        verify(subscriptionMapper).insert(subCaptor.capture());
        assertThat(subCaptor.getValue().getApiKeyMasked()).isEqualTo("encrypted-key");
        assertThat(subCaptor.getValue().getApiKeyMasked()).isNotEqualTo("sk-test");

        verify(balanceSnapshotMapper).insert(any(SubscriptionBalanceSnapshot.class));
    }

    /** 创建带 DeepSeek Provider 但同步失败时，整体抛出异常（事务回滚）。 */
    @Test
    void create_withDeepSeekProvider_syncFailure_throws() {
        when(llmConfigService.encrypt("sk-bad")).thenReturn("encrypted-bad");
        when(llmConfigService.decrypt("encrypted-bad")).thenReturn("sk-bad");
        when(deepSeekBalanceClient.fetchBalance("sk-bad"))
                .thenThrow(new IllegalStateException("DeepSeek 账户当前不可用或 API Key 无效"));

        SubscriptionCreateRequest req = new SubscriptionCreateRequest();
        req.setName("Bad DeepSeek");
        req.setBillingType("per_token");
        req.setApiProvider("deepseek");
        req.setApiKey("sk-bad");

        assertThatThrownBy(() -> subscriptionService.create(req))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("DeepSeek");
    }

    /** 非 apiFetchEnabled 账户调用 syncBalance 应抛异常。 */
    @Test
    void syncBalance_notEnabled_throws() {
        Subscription sub = buildSubscription("s1", "Manual", "per_token");
        sub.setApiFetchEnabled(false);
        when(subscriptionMapper.selectById("s1")).thenReturn(sub);

        assertThatThrownBy(() -> subscriptionService.syncBalance("s1"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("未开启");
    }

    /** 余额历史：返回快照列表。 */
    @Test
    void getBalanceHistory_returnsSnapshotsInRange() {
        SubscriptionBalanceSnapshot snapshot = new SubscriptionBalanceSnapshot();
        snapshot.setBalance(new BigDecimal("50.00"));
        snapshot.setCurrency("CNY");
        snapshot.setSnapshottedAt(LocalDateTime.now());
        when(balanceSnapshotMapper.selectRecent("s1", 30)).thenReturn(List.of(snapshot));

        List<BalanceSnapshotResponse> result = subscriptionService.getBalanceHistory("s1", 30);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getBalance()).isEqualByComparingTo("50.00");
    }

    /** apiFetchEnabled 账户充值不改变 remainingBalance（余额由 API 同步决定）。 */
    @Test
    void recharge_apiFetchEnabled_doesNotChangeBalance() {
        Subscription sub = buildSubscription("s1", "DeepSeek", "per_token");
        sub.setApiFetchEnabled(true);
        sub.setRemainingBalance(new BigDecimal("100"));
        when(subscriptionMapper.selectById("s1")).thenReturn(sub);

        SubscriptionRechargeRequest req = new SubscriptionRechargeRequest();
        req.setAmount(new BigDecimal("50"));

        SubscriptionResponse result = subscriptionService.recharge("s1", req);

        // remainingBalance 保持不变
        assertThat(result.getRemainingBalance()).isEqualByComparingTo("100");
        // 流水仍然写入
        verify(ledgerMapper).insert(any(SubscriptionLedgerEntry.class));
    }

    private Subscription buildSubscription(String id, String name) {
        return buildSubscription(id, name, "monthly");
    }

    private Subscription buildSubscription(String id, String name, String billingType) {
        Subscription subscription = new Subscription();
        subscription.setId(id);
        subscription.setName(name);
        subscription.setCurrency("CNY");
        subscription.setStatus("active");
        subscription.setBillingType(billingType);
        subscription.setUsageUsed(BigDecimal.ZERO);
        subscription.setNotifyEnabled(true);
        subscription.setNotifyDaysBefore(7);
        return subscription;
    }
}
