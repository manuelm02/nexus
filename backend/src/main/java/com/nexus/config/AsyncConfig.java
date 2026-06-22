package com.nexus.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;

@Configuration
@EnableAsync
public class AsyncConfig {

    @Bean(name = "workflowExecutor")
    public Executor workflowExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(4);
        executor.setMaxPoolSize(16);
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("workflow-");
        executor.initialize();
        return executor;
    }

    /** Mindbank 5 步入库 Pipeline 专用线程池，core=2 / max=5 / queue=20，控制并发避免 LLM 过载 */
    @Bean(name = "mindBankPipelineExecutor")
    public Executor mindBankPipelineExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(2);
        executor.setMaxPoolSize(5);
        executor.setQueueCapacity(20);
        executor.setThreadNamePrefix("mindbank-pipeline-");
        executor.initialize();
        return executor;
    }
}
