package com.nexus.dto.response;

import lombok.Data;

/** Inbox 配置响应，包含 Paperless、Obsidian、Bookmark 及 LLM 可用性状态。 */
@Data
public class InboxSettingsResponse {

    // ===== Paperless 配置 =====
    private boolean paperlessEnabled;
    private String paperlessBaseUrl;
    /** API Token 是否已配置，不暴露实际值 */
    private boolean paperlessTokenConfigured;
    private boolean paperlessOpenInNewTab;
    private String paperlessDefaultUploadTags;

    // ===== Obsidian 配置 =====
    private boolean obsidianEnabled;
    private String obsidianVaultPath;
    private String obsidianInboxDir;
    private String obsidianMemoDir;
    private String obsidianFileNamingPattern;

    // ===== Bookmark 配置 =====
    private boolean bookmarksAiAssistEnabled;
    private boolean bookmarksBulkImportEnabled;
    private boolean bookmarksStripTrackingParams;
    private boolean bookmarksDefaultUnread;
    private boolean bookmarksSmartGroupsEnabled;

    // ===== LLM 状态 =====
    /** Inbox 模块 LLM 是否可用 */
    private boolean inboxAiAvailable;
}
