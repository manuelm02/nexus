package com.nexus.dto.response;

import lombok.Data;

/** 标签索引条目：标签名 + 适用范围说明。 */
@Data
public class NoteTagEntryResponse {
    private String name;
    private String description;
}
