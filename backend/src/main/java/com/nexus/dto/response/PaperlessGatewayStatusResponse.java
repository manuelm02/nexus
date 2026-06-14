package com.nexus.dto.response;

import lombok.Data;

import java.util.List;

/** Paperless-ngx 网关状态响应，含连接状态和快捷入口链接列表。 */
@Data
public class PaperlessGatewayStatusResponse {
    /** 服务是否已配置 */
    private boolean configured;
    /** 服务是否可达 */
    private boolean reachable;
    /** 连接状态：connected / not_configured / unauthorized / unreachable / error */
    private String status;
    /** 人类可读状态信息 */
    private String message;
    /** Paperless-ngx 快捷入口链接列表 */
    private List<EntryLink> entryLinks;

    /** Paperless-ngx 快捷入口 */
    @Data
    public static class EntryLink {
        /** 入口标识：documents / inbox / tags / correspondents / document_types / saved_views / tasks / settings */
        private String key;
        /** 中文标签 */
        private String label;
        /** 简短描述 */
        private String description;
        /** 完整跳转 URL */
        private String url;
    }
}
