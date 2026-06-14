package com.nexus.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Inbox 外部集成配置。
 * paperless-ngx 和 Obsidian 均为可选集成，配置缺失时不能导致应用启动失败，
 * 前端应展示 scoped empty state 而非全页报错。
 */
@Data
@Component
@ConfigurationProperties(prefix = "nexus.inbox")
public class InboxIntegrationProperties {

    private final Paperless paperless = new Paperless();
    private final Obsidian obsidian = new Obsidian();

    @Data
    public static class Paperless {
        /** paperless-ngx 服务地址，如 http://localhost:8000 */
        private String baseUrl;
        /** paperless-ngx API Token */
        private String token;

        public boolean isConfigured() {
            return baseUrl != null && !baseUrl.isBlank() && token != null && !token.isBlank();
        }
    }

    @Data
    public static class Obsidian {
        /** Obsidian Vault 根目录绝对路径 */
        private String vaultPath;
        /** 笔记写入子目录，默认 Inbox */
        private String inboxDir = "Inbox";
        /** Memo 写入子目录，默认 Memo */
        private String memoDir = "Memo";

        public boolean isConfigured() {
            return vaultPath != null && !vaultPath.isBlank();
        }
    }
}
