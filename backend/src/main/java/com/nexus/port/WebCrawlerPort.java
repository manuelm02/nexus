package com.nexus.port;

import java.util.List;
import java.util.Map;

public interface WebCrawlerPort {
    String name();
    boolean supports(String url);
    CrawlResult crawl(CrawlRequest request);

    record CrawlRequest(String url, Map<String, String> options) {
        public CrawlRequest(String url) {
            this(url, Map.of());
        }
    }

    record CrawlResult(
            boolean success,
            String markdown,
            String title,
            String author,
            List<String> imageUrls,
            String errorMsg
    ) {
        public static CrawlResult success(String markdown, String title) {
            return new CrawlResult(true, markdown, title, null, List.of(), null);
        }

        public static CrawlResult failure(String msg) {
            return new CrawlResult(false, null, null, null, List.of(), msg);
        }
    }
}
