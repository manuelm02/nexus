package com.nexus.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;
import java.util.Map;

/** Quick Note / Memo 写入请求。content 必填，kind 允许 quick_note 或 memo。 */
@Data
public class QuickNoteRequest {
    /** 可选标题 */
    private String title;
    /** 必填内容 */
    @NotBlank(message = "笔记内容不能为空")
    private String content;
    /** 笔记类型：quick_note 或 memo，默认 quick_note */
    private String kind = "quick_note";
    /** 可选标签列表 */
    private List<String> tags;
    /** AI 本次分析新建的标签说明（仅在 tags 含新标签时提供），保存时写回标签索引 */
    private Map<String, String> newTagDescriptions;
}
