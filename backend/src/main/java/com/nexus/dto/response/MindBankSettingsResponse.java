package com.nexus.dto.response;

import com.nexus.entity.LlmProvider;
import lombok.Data;

import java.util.List;

/**
 * Mindbank 设置响应，API Key 类字段仅返回是否已配置标记，不暴露实际值。
 * workflowModels 返回三个工作流当前的 providerId，供前端回显模型选择。
 */
@Data
public class MindBankSettingsResponse {
    // === 服务地址 ===
    private String anythingllmUrl;
    private String minioUrl;
    private String minioBucket;
    private String obsidianSubFolder;

    // === 认证（脱敏：仅告知是否已配置） ===
    private boolean anythingllmApiKeyConfigured;
    private boolean minioAccessKeyConfigured;
    private boolean minioSecretKeyConfigured;

    // === AI 模型（三个工作流的 providerId） ===
    private String mindbankClassifyProviderId;
    private String mindbankOrganizeProviderId;
    private String mindbankCondenseProviderId;

    // === 流水线行为 ===
    private boolean pipelineAutoSessionNote;

    /** 所有可用的 Provider 列表，供前端模型下拉选择 */
    private List<LlmProvider> providers;
}
