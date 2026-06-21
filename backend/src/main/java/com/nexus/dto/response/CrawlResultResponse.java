package com.nexus.dto.response;

import lombok.Data;

/**
 * Crawl 操作结果（网页爬取或文件上传），返回文档 ID 和 Markdown 预览片段。
 */
@Data
public class CrawlResultResponse {
    private Long docId;
    private String processedMinioKey;
    /** Markdown 前 500 字预览，供前端即时展示 */
    private String markdownPreview;
}
