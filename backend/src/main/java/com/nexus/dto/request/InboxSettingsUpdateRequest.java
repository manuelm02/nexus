package com.nexus.dto.request;

import lombok.Data;

/**
 * Inbox 配置更新请求，所有字段可选（PATCH 语义）。
 * paperlessApiToken 特殊处理：null=不变，""=清除，非空=更新。
 */
@Data
public class InboxSettingsUpdateRequest {

    // ===== Paperless 配置 =====
    private Boolean paperlessEnabled;
    private String paperlessBaseUrl;
    /** API Token：null=不变，""=清除，非空=更新 */
    private String paperlessApiToken;
    private Boolean paperlessOpenInNewTab;
    private String paperlessDefaultUploadTags;

    // ===== Obsidian 配置 =====
    private Boolean obsidianEnabled;
    private String obsidianVaultPath;
    private String obsidianInboxDir;

    // ===== Bookmark 配置 =====
    private Boolean bookmarksAiAssistEnabled;
    private Boolean bookmarksBulkImportEnabled;
    private Boolean bookmarksStripTrackingParams;
    private Boolean bookmarksDefaultUnread;
    private Boolean bookmarksSmartGroupsEnabled;
}
