package com.nexus.service;

import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.nexus.dto.request.SubscriptionCreateRequest;
import com.nexus.dto.request.SubscriptionUpdateRequest;
import com.nexus.dto.request.SubscriptionUsageRequest;
import com.nexus.dto.response.SubscriptionResponse;
import com.nexus.dto.response.SubscriptionStatsResponse;
import com.nexus.entity.Subscription;
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
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SubscriptionServiceTest {

    @Mock
    private SubscriptionMapper subscriptionMapper;

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
