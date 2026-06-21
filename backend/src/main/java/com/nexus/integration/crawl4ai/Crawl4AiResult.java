package com.nexus.integration.crawl4ai;

/**
 * Crawl4AI 任务结果。
 *
 * @param status          任务状态：pending / processing / completed / failed
 * @param markdownContent 爬取的 Markdown 内容（status=completed 时非空）
 * @param rawHtml         原始 HTML（status=completed 时可能为空，取决于爬取配置）
 * @param errorMsg        失败时的错误信息
 */
public record Crawl4AiResult(String status, String markdownContent, String rawHtml, String errorMsg) {

    public static Crawl4AiResult pending() {
        return new Crawl4AiResult("pending", null, null, null);
    }

    public boolean isCompleted() {
        return "completed".equals(status);
    }

    public boolean isFailed() {
        return "failed".equals(status);
    }
}
