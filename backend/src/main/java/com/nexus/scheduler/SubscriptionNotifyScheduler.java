package com.nexus.scheduler;

import com.nexus.entity.ApiKey;
import com.nexus.entity.Credential;
import com.nexus.entity.Subscription;
import com.nexus.integration.notification.NotificationEvent;
import com.nexus.integration.notification.NotificationService;
import com.nexus.mapper.SubscriptionMapper;
import com.nexus.service.ApiKeyService;
import com.nexus.service.CredentialService;
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
 * 定时扫描订阅到期状态、自动续费滚动、汇率刷新、API Key 余额同步/低余额/月消费重置、凭证到期提醒。
 * 到期提醒目前只 Telegram；新增提醒渠道（微信/短信）只需新增实现 NotificationService 的 @Component。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SubscriptionNotifyScheduler {

    private final SubscriptionMapper subscriptionMapper;
    private final SubscriptionService subscriptionService;
    private final ApiKeyService apiKeyService;
    private final CredentialService credentialService;
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
     * 每月 1 日 00:10 快照所有按量计费 Key 的当前余额到 monthStartBalance。
     * 月消费由公式 (monthStartBalance + 月充值 - 当前余额) 实时计算，无需手动清 monthlySpend。
     */
    @Scheduled(cron = "0 10 0 1 * *")
    public void snapshotMonthStartBalance() {
        int affected = apiKeyService.snapshotMonthStartBalance();
        log.info("API Key 月初余额快照完成，共 {} 条", affected);
    }

    /**
     * 每天 00:20 强制刷新当前所有币种的汇率缓存。
     */
    @Scheduled(cron = "0 20 0 * * *")
    public void syncExchangeRates() {
        exchangeRateService.refreshAll(subscriptionService.distinctActiveCurrencies());
        log.info("Subscription 汇率刷新完成");
    }

    /**
     * 每天 00:30 同步所有开启自动余额监控的 API Key（DeepSeek 等）。
     */
    @Scheduled(cron = "0 30 0 * * *")
    public void syncApiBalances() {
        int success = apiKeyService.syncAllEnabledBalances();
        log.info("API Key 余额同步完成，成功 {} 条", success);
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
     * 每天 09:00 检查 API Key 低余额并发送通知。
     */
    @Scheduled(cron = "0 0 9 * * *")
    public void checkLowBalance() {
        List<ApiKey> lowBalance = apiKeyService.findLowBalance();
        if (lowBalance.isEmpty()) return;

        lowBalance.forEach(k -> {
            Map<String, Object> payload = Map.of(
                    "name", k.getLabel(),
                    "remaining_balance", k.getRemainingBalance().toString(),
                    "threshold", k.getLowBalanceThreshold().toString()
            );
            notificationServices.forEach(svc -> {
                try {
                    svc.send(null, NotificationEvent.API_KEY_LOW_BALANCE, payload);
                } catch (Exception e) {
                    log.warn("发送低余额提醒失败 [{}]: {}", svc.channel(), e.getMessage());
                }
            });
        });
        log.info("API Key 低余额提醒发送完成，共 {} 条", lowBalance.size());
    }

    /**
     * 每天 09:00 检查凭证到期（7 天内）并发送通知。
     */
    @Scheduled(cron = "0 0 9 * * *")
    public void checkCredentialExpiry() {
        List<Credential> expiring = credentialService.findExpiringPasswords(7);
        if (expiring.isEmpty()) return;

        expiring.forEach(c -> {
            Map<String, Object> payload = Map.of(
                    "platform", c.getPlatform(),
                    "label", c.getLabel() != null ? c.getLabel() : c.getPlatform(),
                    "expire_date", c.getExpireDate().toString(),
                    "days_left", java.time.temporal.ChronoUnit.DAYS.between(LocalDate.now(), c.getExpireDate())
            );
            notificationServices.forEach(svc -> {
                try {
                    svc.send(null, NotificationEvent.CREDENTIAL_EXPIRING, payload);
                } catch (Exception e) {
                    log.warn("发送凭证到期提醒失败 [{}]: {}", svc.channel(), e.getMessage());
                }
            });
        });
        log.info("凭证到期提醒发送完成，共 {} 条", expiring.size());
    }

    /**
     * 每天 09:05 检查 API Key 套餐到期（7 天内）并发送通知。
     */
    @Scheduled(cron = "0 5 9 * * *")
    public void checkApiKeyPlanExpiry() {
        List<ApiKey> expiring = apiKeyService.findExpiringPlans(7);
        if (expiring.isEmpty()) return;

        expiring.forEach(k -> {
            Map<String, Object> payload = Map.of(
                    "name", k.getLabel(),
                    "expire_date", k.getPlanExpireDate().toString(),
                    "days_left", java.time.temporal.ChronoUnit.DAYS.between(LocalDate.now(), k.getPlanExpireDate())
            );
            notificationServices.forEach(svc -> {
                try {
                    svc.send(null, NotificationEvent.API_KEY_PLAN_EXPIRING, payload);
                } catch (Exception e) {
                    log.warn("发送 API Key 套餐到期提醒失败 [{}]: {}", svc.channel(), e.getMessage());
                }
            });
        });
        log.info("API Key 套餐到期提醒发送完成，共 {} 条", expiring.size());
    }
}
