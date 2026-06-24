package com.nexus.config;

/**
 * SystemConfigKeys 集中维护 system_configs 的业务 key，避免不同模块手写字符串导致读写不一致。
 */
public final class SystemConfigKeys {
    private SystemConfigKeys() {}

    /** Notes 模块 Obsidian Vault 路径 */
    public static final String NOTES_OBSIDIAN_VAULT_PATH = "notes.obsidian.vault_path";

    /** Mindbank 模块 Obsidian 子文件夹 */
    public static final String MINDBANK_OBSIDIAN_SUB_FOLDER = "mindbank.obsidian.sub_folder";

    /** Panel Hub 订阅到期前提醒天数（默认 7 天，范围 1-90） */
    public static final String SUBSCRIPTION_NOTIFY_DAYS_BEFORE = "subscription.notify_days_before";
}
