package com.nexus.adapter.crawler;

import com.nexus.port.WebCrawlerPort;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

@Component
@Order(2)
public class BiliBiliCrawler implements WebCrawlerPort {

    @Override
    public String name() {
        return "bilibili";
    }

    @Override
    public boolean supports(String url) {
        return url.contains("bilibili.com") || url.contains("b23.tv");
    }

    @Override
    public CrawlResult crawl(CrawlRequest request) {
        return CrawlResult.failure("B站爬取暂未实现");
    }
}
