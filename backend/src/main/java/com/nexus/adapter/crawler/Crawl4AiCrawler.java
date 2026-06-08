package com.nexus.adapter.crawler;

import com.nexus.port.WebCrawlerPort;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;
import java.util.Map;

@Slf4j
@Component
@Order(20)
@ConditionalOnProperty(name = "nexus.crawler.crawl4ai.enabled", havingValue = "true")
public class Crawl4AiCrawler implements WebCrawlerPort {

    @Value("${nexus.crawler.crawl4ai.base-url:http://crawl4ai:11235}")
    private String baseUrl;

    @Override
    public String name() {
        return "crawl4ai";
    }

    @Override
    public boolean supports(String url) {
        return true;  // 兜底实现
    }

    @Override
    public CrawlResult crawl(CrawlRequest request) {
        try {
            Map<String, Object> body = Map.of("urls", request.url(), "crawler_params",
                    Map.of("headless", true));
            var response = WebClient.create(baseUrl).post()
                    .uri("/crawl")
                    .bodyValue(body)
                    .retrieve()
                    .bodyToMono(Map.class)
                    .timeout(Duration.ofSeconds(60))
                    .block();

            if (response != null && Boolean.TRUE.equals(response.get("success"))) {
                var result = (Map<?, ?>) ((java.util.List<?>) response.get("results")).get(0);
                String markdown = (String) result.get("markdown");
                return CrawlResult.success(markdown, "");
            }
            return CrawlResult.failure("Crawl4AI 返回失败");
        } catch (Exception e) {
            log.error("Crawl4AI 爬取失败: {}", e.getMessage());
            return CrawlResult.failure("Crawl4AI 失败: " + e.getMessage());
        }
    }
}
