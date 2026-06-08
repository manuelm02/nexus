package com.nexus.scheduler;

import com.nexus.entity.Ledger;
import com.nexus.integration.notification.NotificationEvent;
import com.nexus.integration.notification.NotificationService;
import com.nexus.mapper.LedgerMapper;
import com.nexus.service.SystemConfigService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class LedgerNotifyScheduler {

    private final LedgerMapper ledgerMapper;
    private final SystemConfigService systemConfigService;
    private final List<NotificationService> notificationServices;

    @Scheduled(cron = "0 0 9 * * *")
    public void checkLedgerExpiry() {
        int days = Integer.parseInt(systemConfigService.get("ledger.notify_days_before", "7"));
        LocalDate threshold = LocalDate.now().plusDays(days);
        List<Ledger> expiring = ledgerMapper.selectExpiringSoon(threshold);
        if (expiring.isEmpty()) return;

        expiring.forEach(l -> {
            Map<String, Object> payload = Map.of(
                    "name", l.getName(),
                    "expire_date", l.getExpireDate().toString(),
                    "days_left", java.time.temporal.ChronoUnit.DAYS.between(LocalDate.now(), l.getExpireDate())
            );
            notificationServices.forEach(svc -> {
                try {
                    svc.send(null, NotificationEvent.LEDGER_EXPIRING, payload);
                } catch (Exception e) {
                    log.warn("发送到期提醒失败 [{}]: {}", svc.channel(), e.getMessage());
                }
            });
        });
        log.info("Ledger 到期提醒发送完成，共 {} 条", expiring.size());
    }
}
