package com.nexus.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;

/** 笔记汇总请求：按标题关键词和/或标签筛选笔记，AI 生成汇总 Markdown（不写入文件）。 */
@Data
public class NoteSummarizeRequest {
    /** 笔记类型：quick_note / memo，必填 */
    @NotBlank(message = "kind 不能为空")
    private String kind;
    /** 标题模糊匹配关键词，可选 */
    private String titleQuery;
    /** 标签筛选（与笔记标签取交集），可选 */
    private List<String> tags;
}
