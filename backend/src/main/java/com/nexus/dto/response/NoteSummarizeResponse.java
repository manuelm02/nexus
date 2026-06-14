package com.nexus.dto.response;

import lombok.Data;

/** 笔记汇总响应：匹配到的笔记数量及 AI 生成的 Markdown 汇总。 */
@Data
public class NoteSummarizeResponse {
    /** 汇总后的 Markdown，无匹配时为 null */
    private String markdown;
    /** 匹配到的笔记数量 */
    private int matchedCount;
}
