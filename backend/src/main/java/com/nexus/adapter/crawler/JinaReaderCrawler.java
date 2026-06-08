package com.nexus.adapter.crawler;

import com.nexus.port.WebCrawlerPort;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;
import java.util.Arrays;

@Slf4j
@Component
@Order(10)
public class JinaReaderCrawler implements WebCrawlerPort {

    private static final String JINA_BASE = "https://r.jina.ai/";

    @Value("${nexus.crawler.jina.api-key:}")
    private String jinaApiKey;

    @Override
    public String name() {
        return "jina-reader";
    }

    @Override
    public boolean supports(String url) {
        return !url.contains("xiaohongshu.com")
                && !url.contains("xhslink.com")
                && !url.contains("bilibili.com")
                && !url.contains("b23.tv");
    }

    @Override
    public CrawlResult crawl(CrawlRequest request) {
        try {
            var spec = WebClient.create().get()
                    .uri(JINA_BASE + request.url())
                    .header("Accept", "text/markdown")
                    .header("X-Return-Format", "markdown");
            if (!jinaApiKey.isBlank()) {
                spec = spec.header("Authorization", "Bearer " + jinaApiKey);
            }
            String md = spec.retrieve()
                    .bodyToMono(String.class)
                    .timeout(Duration.ofSeconds(30))
                    .block();
            return CrawlResult.success(md, extractTitle(md));
        } catch (Exception e) {
            log.error("Jina Reader 爬取失败: {}", e.getMessage());
            return CrawlResult.failure("Jina Reader 失败: " + e.getMessage());
        }
    }

    private String extractTitle(String markdown) {
        if (markdown == null) return "";
        return Arrays.stream(markdown.split("\n"))
                .filter(l -> l.startsWith("# "))
                .map(l -> l.substring(2).trim())
                .findFirst().orElse("");
    }
}
