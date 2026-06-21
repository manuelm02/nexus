package com.nexus.integration.crawl4ai;

import com.nexus.service.SystemConfigService;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.Map;

/**
 * Crawl4AI 爬虫服务客户端，支持异步提交 URL 爬取任务并轮询结果。
 * 基础地址从 SystemConfigService 读取，默认 http://192.168.110.10:3003。
 * Crawl4AI 无需认证，URL 为公开配置项。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class Crawl4AiClient {

    private static final String DEFAULT_BASE_URL = "http://192.168.110.10:3003";
    private static final String CONFIG_URL = "crawl.crawl4ai.url";

    private final SystemConfigService systemConfigService;

    @PostConstruct
    void checkConfig() {
        log.info("Crawl4AI 配置：baseUrl={}", systemConfigService.get(CONFIG_URL, DEFAULT_BASE_URL));
    }

    private RestClient client() {
        return RestClient.builder()
                .baseUrl(systemConfigService.get(CONFIG_URL, DEFAULT_BASE_URL))
                .defaultHeader("Accept", "application/json")
                .build();
    }

    /**
     * 提交 URL 爬取任务，Crawl4AI 异步处理。
     *
     * @param url 目标网页 URL
     * @return 任务 ID，用于后续 getResult 轮询
     */
    public String submitCrawl(String url) {
        Map<String, Object> body = Map.of("url", url);
        Map<?, ?> resp = client().post()
                .uri("/crawl")
                .body(body)
                .retrieve()
                .body(Map.class);
        Object taskId = resp.get("task_id");
        if (taskId == null) {
            throw new RuntimeException("Crawl4AI 提交任务失败: 响应缺少 task_id 字段");
        }
        return String.valueOf(taskId);
    }

    /**
     * 查询任务状态和结果，前端或 Pipeline 据此轮询直到 completed/failed。
     *
     * @param taskId submitCrawl 返回的任务 ID
     * @return 任务结果，包含状态和爬取内容
     */
    @SuppressWarnings("unchecked")
    public Crawl4AiResult getResult(String taskId) {
        Map<String, Object> resp = client().get()
                .uri("/task/{taskId}", taskId)
                .retrieve()
                .body(Map.class);
        String status = String.valueOf(resp.get("status"));
        String errorMsg = resp.get("error") != null ? String.valueOf(resp.get("error")) : null;

        if ("completed".equals(status)) {
            Map<String, Object> result = (Map<String, Object>) resp.get("result");
            if (result != null) {
                String markdown = result.get("markdown") != null ? String.valueOf(result.get("markdown")) : null;
                String html = result.get("html") != null ? String.valueOf(result.get("html")) : null;
                return new Crawl4AiResult(status, markdown, html, null);
            }
        }
        return new Crawl4AiResult(status, null, null, errorMsg);
    }
}
