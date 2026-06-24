package com.nexus.integration.crawl4ai;

import com.nexus.service.SystemConfigService;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.net.Proxy;
import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * Crawl4AI 爬虫服务客户端，新版同步 API：POST /crawl 阻塞返回 results 数组。
 * 基础地址从 SystemConfigService 读取，默认 http://192.168.110.10:11235。
 * Crawl4AI 无需认证，URL 为公开配置项。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class Crawl4AiClient {

    private static final String DEFAULT_BASE_URL = "http://192.168.110.10:11235";
    private static final String CONFIG_URL = "crawl.crawl4ai.url";

    private final SystemConfigService systemConfigService;

    @PostConstruct
    void checkConfig() {
        log.info("Crawl4AI 配置：baseUrl={}", systemConfigService.get(CONFIG_URL, DEFAULT_BASE_URL));
    }

    /**
     * 构建 RestClient，同步 API 爬取耗时长，readTimeout 设为 120 秒。
     */
    /** Crawl4AI 部署在内网，必须绕过本地 HTTP 代理直连 */
    private RestClient client() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(10));
        factory.setReadTimeout(Duration.ofSeconds(120));
        factory.setProxy(Proxy.NO_PROXY);
        return RestClient.builder()
                .baseUrl(systemConfigService.get(CONFIG_URL, DEFAULT_BASE_URL))
                .defaultHeader("Accept", "application/json")
                .requestFactory(factory)
                .build();
    }

    /**
     * 同步爬取 URL，新版 API 直接阻塞返回结果，无需轮询。
     *
     * @param url 目标网页 URL
     * @return 爬取结果，包含 Markdown 和 HTML 内容
     */
    public Crawl4AiResult crawl(String url) {
        // 新版 API 请求体：urls 数组 + browser_config + crawler_config
        Map<String, Object> body = Map.of(
                "urls", List.of(url),
                "browser_config", Map.of(),
                "crawler_config", Map.of()
        );

        Map<?, ?> resp = client().post()
                .uri("/crawl")
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .body(Map.class);

        // 检查顶层 success 标志
        Boolean success = (Boolean) resp.get("success");
        if (!Boolean.TRUE.equals(success)) {
            throw new RuntimeException("Crawl4AI 爬取失败");
        }

        List<?> results = (List<?>) resp.get("results");
        if (results == null || results.isEmpty()) {
            throw new RuntimeException("Crawl4AI 返回空结果");
        }

        @SuppressWarnings("unchecked")
        Map<String, Object> first = (Map<String, Object>) results.get(0);

        // 检查单个结果的 success 标志
        Boolean resultSuccess = (Boolean) first.get("success");
        if (!Boolean.TRUE.equals(resultSuccess)) {
            String errorMsg = first.get("error_message") != null
                    ? String.valueOf(first.get("error_message")) : "未知错误";
            throw new RuntimeException("Crawl4AI 爬取失败: " + errorMsg);
        }

        // Markdown 在新版 API 中是嵌套对象，优先用 fit_markdown（智能过滤版），为空降级到 raw_markdown
        String markdown = null;
        Object markdownObj = first.get("markdown");
        if (markdownObj instanceof Map<?, ?> mdMap) {
            markdown = mdMap.get("fit_markdown") != null
                    ? String.valueOf(mdMap.get("fit_markdown"))
                    : String.valueOf(mdMap.get("raw_markdown"));
        } else if (markdownObj != null) {
            markdown = String.valueOf(markdownObj);
        }

        String html = first.get("html") != null ? String.valueOf(first.get("html")) : null;

        return new Crawl4AiResult("completed", markdown, html, null);
    }
}
