package com.nexus.scheduler;

import com.nexus.mapper.TaskMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 每日凌晨2点归档过期任务——属于后端基础设施，不依赖前台入口是否展示。
 * 仅清理未被标记为"永久保留"且已过期的任务记录。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class TaskCleanupScheduler {

    private final TaskMapper taskMapper;

    @Scheduled(cron = "0 0 2 * * *")
    public void cleanup() {
        int count = taskMapper.archiveExpired();
        log.info("Task Cleanup 完成，归档 {} 条过期任务", count);
    }
}
