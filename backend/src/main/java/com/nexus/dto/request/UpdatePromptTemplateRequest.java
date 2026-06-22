package com.nexus.dto.request;

import lombok.Data;

/** 更新 Prompt 模板请求（PATCH 语义，仅更新非 null 字段） */
@Data
public class UpdatePromptTemplateRequest {
    private String name;
    private String content;
    private Boolean defaultFlag;
}
