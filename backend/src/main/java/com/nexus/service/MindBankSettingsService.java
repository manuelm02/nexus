package com.nexus.service;

import com.nexus.config.SystemConfigKeys;
import com.nexus.dto.request.MindBankSettingsUpdateRequest;
import com.nexus.dto.response.MindBankSettingsResponse;
import com.nexus.entity.LlmProvider;
import com.nexus.entity.WorkflowLlmConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Objects;

/**
 * Mindbank 模块配置服务，所有 mindbank.* 配置以 key-value 形式读写于 system_configs 表。
 * API Key 类字段（AnythingLLM api_key、MinIO access_key/secret_key）加密存储，
 * 对外仅透出"是否已配置"标记，不暴露实际值。
 * AI 模型绑定复用 LlmConfigService 的 workflow 机制，三个 workflow type 对应 Pipeline 的三个步骤。
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MindBankSettingsService {

    private final SystemConfigService systemConfigService;
    private final LlmConfigService llmConfigService;

    // === 配置键常量 ===
    private static final String K_ANYTHINGLLM_URL = "mindbank.anythingllm.url";
    private static final String K_ANYTHINGLLM_API_KEY = "mindbank.anythingllm.api_key";
    private static final String K_MINIO_URL = "mindbank.minio.url";
    private static final String K_MINIO_ACCESS_KEY = "mindbank.minio.access_key";
    private static final String K_MINIO_SECRET_KEY = "mindbank.minio.secret_key";
    private static final String K_MINIO_BUCKET = "mindbank.minio.bucket";
    private static final String K_OBSIDIAN_SUB_FOLDER = SystemConfigKeys.MINDBANK_OBSIDIAN_SUB_FOLDER;
    private static final String K_PIPELINE_AUTO_SESSION_NOTE = "mindbank.pipeline.auto_session_note";

    // 默认值
    private static final String DEFAULT_ANYTHINGLLM_URL = "http://192.168.110.10:3001";
    private static final String DEFAULT_MINIO_URL = "http://192.168.110.105:7001";
    private static final String DEFAULT_MINIO_BUCKET = "mindbank";
    private static final String DEFAULT_OBSIDIAN_SUB_FOLDER = "Mindbank";
    private static final String DEFAULT_AUTO_SESSION_NOTE = "true";

    // Pipeline 三个步骤对应的 workflow type
    private static final String WF_CLASSIFY = "mindbank_classify";
    private static final String WF_ORGANIZE = "mindbank_organize";
    private static final String WF_CONDENSE = "mindbank_condense";

    /**
     * 读取所有 Mindbank 设置。API Key 类字段仅返回是否已配置，不返回实际值。
     */
    public MindBankSettingsResponse getSettings() {
        MindBankSettingsResponse resp = new MindBankSettingsResponse();

        // === 服务地址 ===
        resp.setAnythingllmUrl(systemConfigService.get(K_ANYTHINGLLM_URL, DEFAULT_ANYTHINGLLM_URL));
        resp.setMinioUrl(systemConfigService.get(K_MINIO_URL, DEFAULT_MINIO_URL));
        resp.setMinioBucket(systemConfigService.get(K_MINIO_BUCKET, DEFAULT_MINIO_BUCKET));
        resp.setObsidianSubFolder(systemConfigService.get(K_OBSIDIAN_SUB_FOLDER, DEFAULT_OBSIDIAN_SUB_FOLDER));

        // === 认证（脱敏） ===
        resp.setAnythingllmApiKeyConfigured(isConfigured(K_ANYTHINGLLM_API_KEY));
        resp.setMinioAccessKeyConfigured(isConfigured(K_MINIO_ACCESS_KEY));
        resp.setMinioSecretKeyConfigured(isConfigured(K_MINIO_SECRET_KEY));

        // === AI 模型 ===
        resp.setMindbankClassifyProviderId(getWorkflowProviderId(WF_CLASSIFY));
        resp.setMindbankOrganizeProviderId(getWorkflowProviderId(WF_ORGANIZE));
        resp.setMindbankCondenseProviderId(getWorkflowProviderId(WF_CONDENSE));
        resp.setProviders(llmConfigService.listProviders());

        // === 流水线行为 ===
        resp.setPipelineAutoSessionNote(Boolean.parseBoolean(
                systemConfigService.get(K_PIPELINE_AUTO_SESSION_NOTE, DEFAULT_AUTO_SESSION_NOTE)));

        return resp;
    }

    /**
     * PATCH 语义更新 Mindbank 设置：仅处理请求中非 null 的字段。
     * API Key 类字段：null=不变，空串=清除，非空=加密后存储。
     */
    public MindBankSettingsResponse updateSettings(MindBankSettingsUpdateRequest req) {
        // === 服务地址 ===
        if (req.getAnythingllmUrl() != null) {
            upsert(K_ANYTHINGLLM_URL, req.getAnythingllmUrl());
        }
        if (req.getMinioUrl() != null) {
            upsert(K_MINIO_URL, req.getMinioUrl());
        }
        if (req.getMinioBucket() != null) {
            upsert(K_MINIO_BUCKET, req.getMinioBucket());
        }
        if (req.getObsidianSubFolder() != null) {
            upsert(K_OBSIDIAN_SUB_FOLDER, req.getObsidianSubFolder());
        }

        // === 认证（加密存储） ===
        upsertSecret(K_ANYTHINGLLM_API_KEY, req.getAnythingllmApiKey());
        upsertSecret(K_MINIO_ACCESS_KEY, req.getMinioAccessKey());
        upsertSecret(K_MINIO_SECRET_KEY, req.getMinioSecretKey());

        // === AI 模型 ===
        updateWorkflowIfPresent(WF_CLASSIFY, req.getMindbankClassifyProviderId());
        updateWorkflowIfPresent(WF_ORGANIZE, req.getMindbankOrganizeProviderId());
        updateWorkflowIfPresent(WF_CONDENSE, req.getMindbankCondenseProviderId());

        // === 流水线行为 ===
        if (req.getPipelineAutoSessionNote() != null) {
            upsert(K_PIPELINE_AUTO_SESSION_NOTE, req.getPipelineAutoSessionNote().toString());
        }

        return getSettings();
    }

    // === 内部工具方法 ===

    /** 判断密钥类配置是否已设置（非 null 且非空） */
    private boolean isConfigured(String key) {
        String val = systemConfigService.get(key);
        return val != null && !val.isBlank();
    }

    /**
     * 密钥类字段 upsert：null=跳过，空串=清除（存空串），非空=加密后存储。
     * 与 InboxSettingsService 的 paperlessApiToken 处理逻辑保持一致。
     */
    private void upsertSecret(String key, String value) {
        if (value == null) return;
        if (value.isEmpty()) {
            upsert(key, "");
        } else {
            upsert(key, llmConfigService.encrypt(value));
        }
    }

    private void upsert(String key, String val) {
        systemConfigService.upsert(key, val, null);
    }

    /**
     * 更新工作流模型绑定：providerId 为 null 时跳过（PATCH 语义），
     * 空串时清除绑定（继承全局默认），非空时绑定到指定 Provider。
     */
    private void updateWorkflowIfPresent(String workflowType, String providerId) {
        if (providerId == null) return;
        llmConfigService.updateWorkflowConfig(workflowType,
                providerId.isBlank() ? null : providerId, null, null);
    }

    /** 查询工作流当前绑定的 providerId，未绑定或为 null 时返回空串 */
    private String getWorkflowProviderId(String workflowType) {
        List<WorkflowLlmConfig> configs = llmConfigService.listWorkflowConfigs();
        // 注意：providerId 可能为 null（workflow 存在但未绑定 provider），
        // stream 的 findFirst() 遇到 null 元素会抛 NPE（内部用 Optional.of 包装），
        // 必须用 filter(Objects::nonNull) 显式过滤。
        return configs.stream()
                .filter(c -> workflowType.equals(c.getWorkflowType()))
                .map(WorkflowLlmConfig::getProviderId)
                .filter(Objects::nonNull)
                .findFirst()
                .orElse("");
    }
}
