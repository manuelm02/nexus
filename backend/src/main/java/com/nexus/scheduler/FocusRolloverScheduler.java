package com.nexus.scheduler;

import com.nexus.mapper.FocusMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;

@Slf4j
@Component
@RequiredArgsConstructor
public class FocusRolloverScheduler {

    private final FocusMapper focusMapper;

    @Scheduled(cron = "0 5 0 * * *")
    public void rollover() {
        int count = focusMapper.rolloverUnfinished(LocalDate.now());
        log.info("Focus Rollover 完成，滚动 {} 条未完成任务到今天", count);
    }
}
