package com.nexus.scheduler;

import com.nexus.mapper.TaskMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

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
