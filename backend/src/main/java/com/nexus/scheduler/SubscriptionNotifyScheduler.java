package com.nexus.scheduler;

import com.nexus.entity.Subscription;
import com.nexus.integration.notification.NotificationEvent;
import com.nexus.integration.notification.NotificationService;
import com.nexus.mapper.SubscriptionMapper;
import com.nexus.dto.response.SubscriptionResponse;
import com.nexus.service.ExchangeRateService;
import com.nexus.service.SubscriptionService;
import com.nexus.service.SystemConfigService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * 定时扫描订阅到期状态、自动续费滚动、月初消费重置、低余额提醒、汇率刷新和 API 余额同步。
 * 到期提醒目前只 Telegram；新增提醒渠道（微信/短信）只需新增实现 NotificationService 的 @Component。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SubscriptionNotifyScheduler {

    private final SubscriptionMapper subscriptionMapper;
    private final SubscriptionService subscriptionService;
    private final SystemConfigService systemConfigService;
    private final List<NotificationService> notificationServices;
    private final ExchangeRateService exchangeRateService;

    /**
     * 每天凌晨：先执行自动续费滚动，再按日期重算订阅状态。
     * 顺序很重要——autoRenew=true 的记录先滚动日期后才不会被误判为过期。
     */
    @Scheduled(cron = "0 5 0 * * *")
    public void markExpiredSubscriptions() {
        int rolled = subscriptionService.rollAutoRenewals();
        if (rolled > 0) {
            log.info("Subscription 自动续费滚动完成，共 {} 条", rolled);
        }
        int affected = subscriptionService.recomputeDateBasedStatuses();
        log.info("Subscription 状态重算完成，共 {} 条状态发生变更", affected);
    }

    /**
     * 每月 1 日 00:10 重置所有 per_token 类型订阅的当月消费。
     */
    @Scheduled(cron = "0 10 0 1 * *")
    public void resetMonthlySpend() {
        int affected = subscriptionService.resetMonthlySpend();
        log.info("Subscription 月初消费重置完成，共 {} 条 per_token 订阅", affected);
    }

    /**
     * 每天 00:20 强制刷新当前所有币种的汇率缓存，早于 00:30 的余额同步。
     */
    @Scheduled(cron = "0 20 0 * * *")
    public void syncExchangeRates() {
        exchangeRateService.refreshAll(subscriptionService.distinctActiveCurrencies());
        log.info("Subscription 汇率刷新完成");
    }

    /**
     * 每天 00:30 同步所有开启自动余额监控的账户（DeepSeek 等），晚于汇率刷新任务。
     */
    @Scheduled(cron = "0 30 0 * * *")
    public void syncApiBalances() {
        int success = subscriptionService.syncAllEnabledBalances();
        log.info("Subscription API 余额同步完成，成功 {} 条", success);
    }

    /**
     * 每天发送即将到期订阅提醒。
     */
    @Scheduled(cron = "0 0 9 * * *")
    public void checkSubscriptionExpiry() {
        int days = Integer.parseInt(systemConfigService.get("subscription.notify_days_before", "7"));
        LocalDate threshold = LocalDate.now().plusDays(days);
        List<Subscription> expiring = subscriptionMapper.selectExpiringSoon(threshold);
        if (expiring.isEmpty()) return;

        expiring.forEach(l -> {
            Map<String, Object> payload = Map.of(
                    "name", l.getName(),
                    "expire_date", l.getExpireDate().toString(),
                    "days_left", java.time.temporal.ChronoUnit.DAYS.between(LocalDate.now(), l.getExpireDate())
            );
            notificationServices.forEach(svc -> {
                try {
                    svc.send(null, NotificationEvent.SUBSCRIPTION_EXPIRING, payload);
                } catch (Exception e) {
                    log.warn("发送到期提醒失败 [{}]: {}", svc.channel(), e.getMessage());
                }
            });
        });
        log.info("Subscription 到期提醒发送完成，共 {} 条", expiring.size());
    }

    /**
     * 每天 09:00 检查按量订阅低余额并发送通知。
     */
    @Scheduled(cron = "0 0 9 * * *")
    public void checkLowBalance() {
        List<SubscriptionResponse> lowBalance = subscriptionService.findLowBalance();
        if (lowBalance.isEmpty()) return;

        lowBalance.forEach(s -> {
            Map<String, Object> payload = Map.of(
                    "name", s.getName(),
                    "remaining_balance", s.getRemainingBalance().toString(),
                    "threshold", s.getLowBalanceThreshold().toString()
            );
            notificationServices.forEach(svc -> {
                try {
                    svc.send(null, NotificationEvent.SUBSCRIPTION_LOW_BALANCE, payload);
                } catch (Exception e) {
                    log.warn("发送低余额提醒失败 [{}]: {}", svc.channel(), e.getMessage());
                }
            });
        });
        log.info("Subscription 低余额提醒发送完成，共 {} 条", lowBalance.size());
    }
}
