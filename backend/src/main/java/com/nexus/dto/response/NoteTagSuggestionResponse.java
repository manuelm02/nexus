package com.nexus.dto.response;

import lombok.Data;

/** 单标签建议：AI 为缺少标签的笔记自动建议的标签名及（若为新标签）说明。 */
@Data
public class NoteTagSuggestionResponse {
    private String name;
    /** 非 null 表示该标签不在现有索引中，需要随保存写回标签索引 */
    private String description;
}
