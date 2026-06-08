package com.nexus.adapter.crawler;

import com.nexus.port.WebCrawlerPort;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

@Component
@Order(1)
public class XiaohongshuCrawler implements WebCrawlerPort {

    @Override
    public String name() {
        return "xiaohongshu";
    }

    @Override
    public boolean supports(String url) {
        return url.contains("xiaohongshu.com") || url.contains("xhslink.com");
    }

    @Override
    public CrawlResult crawl(CrawlRequest request) {
        return CrawlResult.failure("小红书爬取暂未实现");
    }
}
