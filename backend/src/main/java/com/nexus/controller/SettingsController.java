package com.nexus.controller;

import com.nexus.dto.request.*;
import com.nexus.dto.response.ApiResponse;
import com.nexus.dto.response.InboxSettingsResponse;
import com.nexus.dto.response.PaperlessGatewayStatusResponse;
import com.nexus.entity.LlmProvider;
import com.nexus.entity.WorkflowLlmConfig;
import com.nexus.service.InboxSettingsService;
import com.nexus.service.LlmConfigService;
import com.nexus.service.PaperlessGatewayService;
import com.nexus.service.SystemConfigService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/** SettingsController 提供 LLM 配置、系统配置和 Inbox 集成配置的管理接口。 */
@Slf4j
@RestController
@RequestMapping("/api/v1/settings")
@RequiredArgsConstructor
public class SettingsController {

    private final LlmConfigService llmConfigService;
    private final SystemConfigService systemConfigService;
    private final InboxSettingsService inboxSettingsService;
    private final PaperlessGatewayService paperlessGatewayService;

    @GetMapping("/llm/providers")
    public ApiResponse<List<LlmProvider>> listProviders() {
        return ApiResponse.ok(llmConfigService.listProviders());
    }

    @PostMapping("/llm/providers")
    public ApiResponse<LlmProvider> createProvider(@Valid @RequestBody LlmProviderCreateRequest req) {
        LlmProvider provider = new LlmProvider();
        provider.setName(req.getName());
        provider.setProvider(req.getProvider());
        provider.setApiKey(req.getApiKey() != null ? llmConfigService.encrypt(req.getApiKey()) : null);
        provider.setBaseUrl(req.getBaseUrl());
        provider.setModel(req.getModel());
        provider.setDefaultProvider(req.isDefault());
        provider.setEnabled(req.isEnabled());
        return ApiResponse.ok(llmConfigService.createProvider(provider));
    }

    @PatchMapping("/llm/providers/{id}")
    public ApiResponse<LlmProvider> updateProvider(@PathVariable String id,
                                                   @RequestBody LlmProviderUpdateRequest req) {
        LlmProvider patch = new LlmProvider();
        patch.setName(req.getName());
        patch.setProvider(req.getProvider());
        // 仅当 apiKey 非空时才覆盖，避免空串将已有 key 意外清空
        String rawKey = req.getApiKey();
        patch.setApiKey(rawKey != null && !rawKey.isBlank() ? rawKey : null);
        patch.setBaseUrl(req.getBaseUrl());
        patch.setModel(req.getModel());
        if (Boolean.TRUE.equals(req.getIsDefault())) patch.setDefaultProvider(true);
        if (Boolean.TRUE.equals(req.getEnabled()))   patch.setEnabled(true);
        return ApiResponse.ok(llmConfigService.updateProvider(id, patch));
    }

    @DeleteMapping("/llm/providers/{id}")
    public ApiResponse<Void> deleteProvider(@PathVariable String id) {
        llmConfigService.deleteProvider(id);
        return ApiResponse.ok();
    }

    @GetMapping("/llm/workflows")
    public ApiResponse<List<WorkflowLlmConfig>> listWorkflows() {
        return ApiResponse.ok(llmConfigService.listWorkflowConfigs());
    }

    @PatchMapping("/llm/workflows/{type}")
    public ApiResponse<Void> updateWorkflow(@PathVariable String type,
                                            @RequestBody WorkflowLlmConfigRequest req) {
        llmConfigService.updateWorkflowConfig(type, req.getProviderId(), req.getModelOverride(), req.getTemperature());
        return ApiResponse.ok();
    }

    @GetMapping("/system")
    public ApiResponse<Map<String, String>> getSystemConfig() {
        return ApiResponse.ok(systemConfigService.getAll());
    }

    @PatchMapping("/system")
    public ApiResponse<Void> updateSystemConfig(@Valid @RequestBody SystemConfigUpdateRequest req) {
        systemConfigService.updateAll(req.getConfigs());
        return ApiResponse.ok();
    }

    // ==================== Inbox 集成配置 ====================

    /** 获取所有 Inbox 集成设置（paperless token 不回显） */
    @GetMapping("/inbox")
    public ApiResponse<InboxSettingsResponse> getInboxSettings() {
        return ApiResponse.ok(inboxSettingsService.getSettings());
    }

    /** PATCH 语义更新 Inbox 设置，paperlessApiToken 加密存储 */
    @PatchMapping("/inbox")
    public ApiResponse<InboxSettingsResponse> updateInboxSettings(@RequestBody InboxSettingsUpdateRequest req) {
        return ApiResponse.ok(inboxSettingsService.updateSettings(req));
    }

    /** 测试 paperless-ngx 连接 */
    @PostMapping("/inbox/paperless/test")
    public ApiResponse<PaperlessGatewayStatusResponse> testPaperlessConnection() {
        return ApiResponse.ok(paperlessGatewayService.getStatus());
    }

    /** 测试 Obsidian Vault 连接（检测路径可写性，不保留文件） */
    @PostMapping("/inbox/obsidian/test")
    public ApiResponse<Map<String, Object>> testObsidianConnection() {
        try {
            boolean configured = inboxSettingsService.isObsidianConfigured();
            String vaultPath = inboxSettingsService.get("inbox.obsidian.vault_path");
            String inboxDir = inboxSettingsService.getObsidianInboxRootDir();
            String memoDir = inboxSettingsService.getObsidianMemoDir();
            
            Map<String, Object> result = new java.util.HashMap<>();
            result.put("configured", configured);
            
            if (!configured) {
                result.put("status", "not_configured");
                result.put("message", "Obsidian Vault 未配置");
                return ApiResponse.ok(result);
            }
            
            // 检测路径是否存在且可写
            java.nio.file.Path fullPath = java.nio.file.Paths.get(vaultPath, inboxDir);
            boolean exists = java.nio.file.Files.exists(fullPath);
            boolean writable = exists && java.nio.file.Files.isWritable(fullPath);
            
            result.put("status", writable ? "connected" : (exists ? "not_writable" : "not_found"));
            result.put("vaultPath", vaultPath);
            result.put("inboxDir", inboxDir);
            result.put("memoDir", memoDir);
            result.put("fullPath", fullPath.toString());
            result.put("message", writable ? "Obsidian Vault 连接正常" : "目录不存在或不可写");
            
            return ApiResponse.ok(result);
        } catch (Exception e) {
            log.error("Obsidian 连接测试失败", e);
            return ApiResponse.error("TEST_FAILED", "Obsidian 连接测试失败: " + e.getMessage());
        }
    }

    // ==================== Crawl 配置 ====================

    private static final String K_CRAWL4AI_URL = "crawl.crawl4ai.url";
    private static final String K_MARKITDOWN_URL = "crawl.markitdown.url";
    private static final String DEFAULT_CRAWL4AI_URL = "http://192.168.110.10:3003";
    private static final String DEFAULT_MARKITDOWN_URL = "http://192.168.110.10:3004";

    /** 获取 Crawl 相关服务地址配置 */
    @GetMapping("/crawl")
    public ApiResponse<Map<String, String>> getCrawlSettings() {
        return ApiResponse.ok(Map.of(
                K_CRAWL4AI_URL, systemConfigService.get(K_CRAWL4AI_URL, DEFAULT_CRAWL4AI_URL),
                K_MARKITDOWN_URL, systemConfigService.get(K_MARKITDOWN_URL, DEFAULT_MARKITDOWN_URL)
        ));
    }

    /** 保存 Crawl 相关服务地址配置 */
    @PutMapping("/crawl")
    public ApiResponse<Void> saveCrawlSettings(@RequestBody Map<String, String> body) {
        if (body.containsKey(K_CRAWL4AI_URL)) {
            systemConfigService.upsert(K_CRAWL4AI_URL, body.get(K_CRAWL4AI_URL), null);
        }
        if (body.containsKey(K_MARKITDOWN_URL)) {
            systemConfigService.upsert(K_MARKITDOWN_URL, body.get(K_MARKITDOWN_URL), null);
        }
        return ApiResponse.ok();
    }

    // ==================== Notes 配置 ====================

    private static final String K_NOTES_VAULT_PATH = "notes.obsidian.vault_path";

    /** 获取 Notes 配置（Obsidian vault 路径） */
    @GetMapping("/notes")
    public ApiResponse<Map<String, String>> getNotesSettings() {
        String vaultPath = systemConfigService.get(K_NOTES_VAULT_PATH);
        return ApiResponse.ok(Map.of(
                K_NOTES_VAULT_PATH, vaultPath != null ? vaultPath : ""
        ));
    }

    /** 保存 Notes 配置 */
    @PutMapping("/notes")
    public ApiResponse<Void> saveNotesSettings(@RequestBody Map<String, String> body) {
        if (body.containsKey(K_NOTES_VAULT_PATH)) {
            systemConfigService.upsert(K_NOTES_VAULT_PATH, body.get(K_NOTES_VAULT_PATH), null);
        }
        return ApiResponse.ok();
    }
}
