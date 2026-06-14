package com.nexus.scheduler;

import com.nexus.entity.Subscription;
import com.nexus.integration.notification.NotificationEvent;
import com.nexus.integration.notification.NotificationService;
import com.nexus.mapper.SubscriptionMapper;
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
 * 定时扫描订阅到期状态并通过配置的通知渠道发送提醒。
 * 到期提醒目前仅 Telegram；新增提醒渠道（微信/短信）只需新增实现 NotificationService 的 @Component，本类会按 List<NotificationService> 自动遍历。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SubscriptionNotifyScheduler {

    private final SubscriptionMapper subscriptionMapper;
    private final SubscriptionService subscriptionService;
    private final SystemConfigService systemConfigService;
    private final List<NotificationService> notificationServices;

    /**
     * 每天凌晨将已过期的 active 订阅标记为 expired，早于日间提醒任务执行。
     */
    @Scheduled(cron = "0 5 0 * * *")
    public void markExpiredSubscriptions() {
        int affected = subscriptionService.autoExpireOverdue();
        log.info("Subscription 自动过期扫描完成，共 {} 条置为 expired", affected);
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
}
