package com.nexus.dto.request;

import lombok.Data;

/**
 * Mindbank 设置更新请求，PATCH 语义：仅非 null 字段被更新。
 * API Key 类字段：null=不变，空串=清除，非空=加密后存储。
 */
@Data
public class MindBankSettingsUpdateRequest {
    // === 服务地址 ===
    private String anythingllmUrl;
    private String minioUrl;
    private String minioBucket;
    private String obsidianSubFolder;

    // === 认证（null=不变，""=清除，非空=加密存储） ===
    private String anythingllmApiKey;
    private String minioAccessKey;
    private String minioSecretKey;

    // === AI 模型（空串=清除绑定，继承全局默认） ===
    private String mindbankClassifyProviderId;
    private String mindbankOrganizeProviderId;
    private String mindbankCondenseProviderId;

    // === 流水线行为 ===
    private Boolean pipelineAutoSessionNote;
}
