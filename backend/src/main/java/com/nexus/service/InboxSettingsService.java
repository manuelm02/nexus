package com.nexus.service;

import com.nexus.dto.request.InboxSettingsUpdateRequest;
import com.nexus.dto.response.InboxSettingsResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * Inbox 模块动态配置服务，将 Paperless、Obsidian、Bookmark 配置以 key-value 形式
 * 读写于 system_configs 表。paperless token 加密存储，对外仅透出"是否已配置"标记。
 * 同时提供 LLM 可用性检测，供前端判断 AI 辅助功能是否可用。
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class InboxSettingsService {

    private final SystemConfigService systemConfigService;
    private final LlmConfigService llmConfigService;

    /** paperless 配置键前缀 */
    private static final String P_PREFIX = "inbox.paperless.";
    /** obsidian 配置键前缀 */
    private static final String O_PREFIX = "inbox.obsidian.";
    /** bookmark 配置键前缀 */
    private static final String B_PREFIX = "inbox.bookmarks.";
    private static final String DEFAULT_INBOX_DIR = "Inbox";
    private static final String QUICK_NOTE_DIR = "Quick Note";
    private static final String MEMO_DIR = "Memo";
    private static final String CONSOLIDATED_DIR = "Consolidated";

    /**
     * 获取所有 Inbox 设置。token 字段仅返回是否已配置的标记，不暴露实际值。
     * 同时检查 LLM 对 inbox 工作流的可用性。
     */
    public InboxSettingsResponse getSettings() {
        InboxSettingsResponse resp = new InboxSettingsResponse();

        // === Paperless 配置 ===
        resp.setPaperlessEnabled(Boolean.parseBoolean(
                systemConfigService.get(P_PREFIX + "enabled", "false")));
        resp.setPaperlessBaseUrl(systemConfigService.get(P_PREFIX + "base_url"));
        // 仅告知前端 token 是否已配置，不返回实际值
        String tokenVal = systemConfigService.get(P_PREFIX + "api_token");
        resp.setPaperlessTokenConfigured(tokenVal != null && !tokenVal.isBlank());
        resp.setPaperlessOpenInNewTab(Boolean.parseBoolean(
                systemConfigService.get(P_PREFIX + "open_in_new_tab", "true")));
        resp.setPaperlessDefaultUploadTags(
                systemConfigService.get(P_PREFIX + "default_upload_tags"));

        // === Obsidian 配置 ===
        resp.setObsidianEnabled(Boolean.parseBoolean(
                systemConfigService.get(O_PREFIX + "enabled", "false")));
        resp.setObsidianVaultPath(systemConfigService.get(O_PREFIX + "vault_path"));
        String inboxDir = getObsidianInboxRootDir();
        resp.setObsidianInboxDir(inboxDir);
        resp.setObsidianMemoDir(resolveChildDir(inboxDir, MEMO_DIR));
        resp.setObsidianFileNamingPattern(null);
        resp.setObsidianConsolidationDir(resolveChildDir(inboxDir, CONSOLIDATED_DIR));

        // === Bookmark 配置 ===
        resp.setBookmarksAiAssistEnabled(Boolean.parseBoolean(
                systemConfigService.get(B_PREFIX + "ai_assist_enabled", "false")));
        resp.setBookmarksBulkImportEnabled(Boolean.parseBoolean(
                systemConfigService.get(B_PREFIX + "bulk_import_enabled", "false")));
        resp.setBookmarksStripTrackingParams(Boolean.parseBoolean(
                systemConfigService.get(B_PREFIX + "strip_tracking_params", "true")));
        resp.setBookmarksDefaultUnread(Boolean.parseBoolean(
                systemConfigService.get(B_PREFIX + "default_unread", "true")));
        resp.setBookmarksSmartGroupsEnabled(Boolean.parseBoolean(
                systemConfigService.get(B_PREFIX + "smart_groups_enabled", "false")));

        // === LLM 可用性 ===
        resp.setInboxAiAvailable(isInboxAiAvailable());

        return resp;
    }

    /**
     * PATCH 语义更新 Inbox 设置：仅处理请求中非 null 的字段。
     * paperlessApiToken 特殊处理——null=不变，""=清除，非空=加密后存储。
     *
     * @return 更新后的完整设置
     */
    public InboxSettingsResponse updateSettings(InboxSettingsUpdateRequest req) {
        // === Paperless 配置 ===
        if (req.getPaperlessEnabled() != null) {
            upsert(P_PREFIX + "enabled", req.getPaperlessEnabled().toString());
        }
        if (req.getPaperlessBaseUrl() != null) {
            upsert(P_PREFIX + "base_url", req.getPaperlessBaseUrl());
        }
        // paperlessApiToken 特殊处理
        if (req.getPaperlessApiToken() != null) {
            if (req.getPaperlessApiToken().isEmpty()) {
                // 空字符串 = 清除
                upsert(P_PREFIX + "api_token", "");
            } else {
                // 非空 = 加密后存储
                upsert(P_PREFIX + "api_token", llmConfigService.encrypt(req.getPaperlessApiToken()));
            }
        }
        if (req.getPaperlessOpenInNewTab() != null) {
            upsert(P_PREFIX + "open_in_new_tab", req.getPaperlessOpenInNewTab().toString());
        }
        if (req.getPaperlessDefaultUploadTags() != null) {
            upsert(P_PREFIX + "default_upload_tags", req.getPaperlessDefaultUploadTags());
        }

        // === Obsidian 配置 ===
        if (req.getObsidianEnabled() != null) {
            upsert(O_PREFIX + "enabled", req.getObsidianEnabled().toString());
        }
        if (req.getObsidianVaultPath() != null) {
            upsert(O_PREFIX + "vault_path", req.getObsidianVaultPath());
        }
        if (req.getObsidianInboxDir() != null) {
            upsert(O_PREFIX + "inbox_dir", req.getObsidianInboxDir());
        }

        // === Bookmark 配置 ===
        if (req.getBookmarksAiAssistEnabled() != null) {
            upsert(B_PREFIX + "ai_assist_enabled", req.getBookmarksAiAssistEnabled().toString());
        }
        if (req.getBookmarksBulkImportEnabled() != null) {
            upsert(B_PREFIX + "bulk_import_enabled", req.getBookmarksBulkImportEnabled().toString());
        }
        if (req.getBookmarksStripTrackingParams() != null) {
            upsert(B_PREFIX + "strip_tracking_params", req.getBookmarksStripTrackingParams().toString());
        }
        if (req.getBookmarksDefaultUnread() != null) {
            upsert(B_PREFIX + "default_unread", req.getBookmarksDefaultUnread().toString());
        }
        if (req.getBookmarksSmartGroupsEnabled() != null) {
            upsert(B_PREFIX + "smart_groups_enabled", req.getBookmarksSmartGroupsEnabled().toString());
        }

        return getSettings();
    }

    /**
     * 判断 paperless-ngx 集成是否已完整配置（启用 + 地址 + Token 均存在且非空）。
     */
    public boolean isPaperlessConfigured() {
        boolean enabled = Boolean.parseBoolean(
                systemConfigService.get(P_PREFIX + "enabled", "false"));
        String baseUrl = systemConfigService.get(P_PREFIX + "base_url");
        String token = systemConfigService.get(P_PREFIX + "api_token");
        return enabled && baseUrl != null && !baseUrl.isBlank()
                && token != null && !token.isBlank();
    }

    /**
     * 判断 Obsidian 集成是否已完整配置（启用 + Vault 路径存在且非空）。
     */
    public boolean isObsidianConfigured() {
        boolean enabled = Boolean.parseBoolean(
                systemConfigService.get(O_PREFIX + "enabled", "false"));
        String vaultPath = systemConfigService.get(O_PREFIX + "vault_path");
        return enabled && vaultPath != null && !vaultPath.isBlank();
    }

    /**
     * 读取单个配置值，供其他服务使用。
     *
     * @param key 配置键（完整 key，如 inbox.paperless.base_url）
     */
    public String get(String key) {
        return systemConfigService.get(key);
    }

    /**
     * 读取单个配置值，不存在时返回默认值。
     */
    public String get(String key, String defaultValue) {
        return systemConfigService.get(key, defaultValue);
    }

    /** Obsidian Inbox 根目录，相对于 Vault 根目录。 */
    public String getObsidianInboxRootDir() {
        return systemConfigService.get(O_PREFIX + "inbox_dir", DEFAULT_INBOX_DIR);
    }

    /** Quick Note 固定写入目录。目录名不可配置，避免后续迁移歧义。 */
    public String getObsidianQuickNoteDir() {
        return resolveChildDir(getObsidianInboxRootDir(), QUICK_NOTE_DIR);
    }

    /** Memo 固定写入目录。目录名不可配置，避免后续迁移歧义。 */
    public String getObsidianMemoDir() {
        return resolveChildDir(getObsidianInboxRootDir(), MEMO_DIR);
    }

    /** AI 整理后的固定输出目录。 */
    public String getObsidianConsolidationDir() {
        return resolveChildDir(getObsidianInboxRootDir(), CONSOLIDATED_DIR);
    }

    /**
     * 获取解密后的 paperless Token（仅供内部服务使用，不对外暴露）。
     * 若解密失败（如旧未加密数据），降级返回原文。
     */
    public String getPaperlessToken() {
        String encrypted = systemConfigService.get(P_PREFIX + "api_token");
        if (encrypted == null || encrypted.isBlank()) {
            return null;
        }
        try {
            return llmConfigService.decrypt(encrypted);
        } catch (Exception e) {
            log.warn("paperless token 解密失败，降级使用原文");
            return encrypted;
        }
    }

    /**
     * 判断 LLM 是否对 inbox 工作流可用。
     * 通过尝试 resolveModel("inbox") 检测，不抛出异常即视为可用。
     */
    public boolean isInboxAiAvailable() {
        try {
            llmConfigService.resolveModel("inbox");
            return true;
        } catch (Exception e) {
            log.debug("Inbox LLM 不可用: {}", e.getMessage());
            return false;
        }
    }

    /** 包装 SystemConfigService.upsert，description 为空 */
    private void upsert(String key, String val) {
        systemConfigService.upsert(key, val, null);
    }

    private String resolveChildDir(String baseDir, String childDir) {
        String base = (baseDir == null || baseDir.isBlank()) ? DEFAULT_INBOX_DIR : baseDir.trim();
        String normalizedBase = base.replaceAll("/+$", "");
        return normalizedBase + "/" + childDir;
    }
}
