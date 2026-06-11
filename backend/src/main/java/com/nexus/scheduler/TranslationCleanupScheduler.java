package com.nexus.scheduler;

import com.nexus.service.TranslateService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** TranslationCleanupScheduler 每天凌晨 3 点清理超过 30 天的翻译历史。 */
@Slf4j
@Component
@RequiredArgsConstructor
public class TranslationCleanupScheduler {

    private static final int RETENTION_DAYS = 30;

    private final TranslateService translateService;

    @Scheduled(cron = "0 0 3 * * *")
    public void cleanup() {
        int count = translateService.cleanupStale(RETENTION_DAYS);
        if (count > 0) log.info("翻译历史老化清理完成，删除 {} 条记录（超过 {} 天）", count, RETENTION_DAYS);
    }
}
