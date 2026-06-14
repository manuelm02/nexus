package com.nexus.service;

import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.core.metadata.TableInfoHelper;
import com.nexus.dto.request.SubscriptionCreateRequest;
import com.nexus.dto.request.SubscriptionUpdateRequest;
import com.nexus.dto.request.SubscriptionUsageRequest;
import com.nexus.dto.response.SubscriptionResponse;
import com.nexus.entity.Subscription;
import com.nexus.mapper.SubscriptionMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.apache.ibatis.builder.MapperBuilderAssistant;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

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
    void updateShouldRejectInvalidStatus() {
        Subscription existing = buildSubscription("s1", "Old");
        when(subscriptionMapper.selectById("s1")).thenReturn(existing);

        SubscriptionUpdateRequest req = new SubscriptionUpdateRequest();
        req.setStatus("unknown");

        assertThatThrownBy(() -> subscriptionService.update("s1", req))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Subscription 状态不合法: unknown");
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
        req.setStatus("paused");
        req.setNotifyEnabled(false);
        req.setNotifyDaysBefore(3);

        SubscriptionResponse result = subscriptionService.update("s1", req);

        assertThat(result.getName()).isEqualTo("Claude");
        assertThat(result.getCurrency()).isEqualTo("USD");
        assertThat(result.getStatus()).isEqualTo("paused");
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
    void autoExpireOverdueShouldUpdateOnlyActiveExpiredItems() {
        // Mockito 单元测试不会启动 MyBatis 上下文，LambdaUpdateWrapper 需要手动注册实体列缓存。
        TableInfoHelper.initTableInfo(new MapperBuilderAssistant(new MybatisConfiguration(), ""), Subscription.class);
        when(subscriptionMapper.update(isNull(), any(LambdaUpdateWrapper.class))).thenReturn(2);

        int affected = subscriptionService.autoExpireOverdue();

        assertThat(affected).isEqualTo(2);
        ArgumentCaptor<LambdaUpdateWrapper<Subscription>> captor = ArgumentCaptor.forClass(LambdaUpdateWrapper.class);
        verify(subscriptionMapper).update(isNull(), captor.capture());
        String sqlSegment = captor.getValue().getSqlSegment();
        assertThat(sqlSegment).contains("status", "expire_date");
    }

    @Test
    void responseShouldNotExposeDormantApiFields() throws Exception {
        Subscription entity = buildSubscription("s1", "ChatGPT");
        entity.setApiProvider("openai");
        entity.setApiBalanceJson("{\"balance\":10}");

        SubscriptionResponse response = SubscriptionResponse.from(entity);
        ObjectMapper mapper = new ObjectMapper().registerModule(new JavaTimeModule());
        String json = mapper.writeValueAsString(response);

        assertThat(json).doesNotContain("apiProvider", "apiBalanceJson", "apiKeyMasked", "notionPageUrl", "taskId");
    }

    private Subscription buildSubscription(String id, String name) {
        Subscription subscription = new Subscription();
        subscription.setId(id);
        subscription.setName(name);
        subscription.setCurrency("CNY");
        subscription.setStatus("active");
        subscription.setUsageUsed(BigDecimal.ZERO);
        subscription.setNotifyEnabled(true);
        subscription.setNotifyDaysBefore(7);
        return subscription;
    }
}
