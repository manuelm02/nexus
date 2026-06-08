package com.nexus.adapter.crawler;

import com.nexus.port.WebCrawlerPort;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

@Slf4j
@Service
public class WebCrawlerDispatcher {

    private final List<WebCrawlerPort> crawlers;

    public WebCrawlerDispatcher(List<WebCrawlerPort> crawlers) {
        this.crawlers = crawlers;
    }

    public WebCrawlerPort.CrawlResult crawl(String url) {
        return crawlers.stream()
                .filter(c -> c.supports(url))
                .findFirst()
                .map(c -> {
                    log.debug("使用 {} 爬取: {}", c.name(), url);
                    return c.crawl(new WebCrawlerPort.CrawlRequest(url));
                })
                .orElse(WebCrawlerPort.CrawlResult.failure("没有可用的爬虫实现"));
    }
}
