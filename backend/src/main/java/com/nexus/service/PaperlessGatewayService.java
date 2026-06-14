package com.nexus.service;

import com.nexus.config.InboxIntegrationProperties;
import com.nexus.dto.response.PaperlessGatewayStatusResponse;
import com.nexus.dto.response.PaperlessGatewayStatusResponse.EntryLink;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.net.HttpURLConnection;
import java.net.URI;
import java.util.ArrayList;
import java.util.List;

/**
 * paperless-ngx 网关服务，检查 paperless-ngx 实例的配置状态、可达性，
 * 并生成可直接跳转的快捷入口链接列表。
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PaperlessGatewayService {

    private final InboxSettingsService inboxSettingsService;
    private final InboxIntegrationProperties integrationProperties;

    /**
     * 获取 paperless 网关状态，包含配置状态、可达性和入口链接列表。
     * 优先使用 InboxSettingsService 的动态配置，InboxIntegrationProperties 作为 fallback。
     */
    public PaperlessGatewayStatusResponse getStatus() {
        // 1. 读取配置：优先 system_configs 动态配置，properties 作为 fallback
        boolean enabled = Boolean.parseBoolean(
                inboxSettingsService.get("inbox.paperless.enabled", "false"));
        String baseUrl = inboxSettingsService.get("inbox.paperless.base_url");
        boolean tokenConfigured = inboxSettingsService.get("inbox.paperless.api_token") != null;

        // application properties fallback
        if (baseUrl == null && integrationProperties.getPaperless().getBaseUrl() != null) {
            baseUrl = integrationProperties.getPaperless().getBaseUrl();
        }
        if (!tokenConfigured && integrationProperties.getPaperless().getToken() != null) {
            tokenConfigured = true;
        }

        // 2. 生成入口链接
        List<EntryLink> entryLinks = buildEntryLinks(baseUrl);

        // 3. 测试连通性
        String status = "not_configured";
        String message = "尚未配置 paperless-ngx 连接";
        boolean reachable = false;

        if (enabled && baseUrl != null && !baseUrl.isBlank() && tokenConfigured) {
            try {
                status = checkReachability(baseUrl);
                reachable = "connected".equals(status);
                message = getStatusMessage(status);
            } catch (Exception e) {
                log.warn("paperless-ngx 连通性检查异常: {}", e.getMessage());
                status = "error";
                message = "连接测试失败: " + e.getMessage();
            }
        }

        // 4. 组装响应
        PaperlessGatewayStatusResponse resp = new PaperlessGatewayStatusResponse();
        resp.setConfigured(enabled && baseUrl != null && !baseUrl.isBlank() && tokenConfigured);
        resp.setReachable(reachable);
        resp.setStatus(status);
        resp.setMessage(message);
        resp.setEntryLinks(entryLinks);
        return resp;
    }

    /**
     * 构建 paperless-ngx 8 个快捷入口链接。
     * baseUrl 为空时返回不含 URL 仅有标签的占位列表。
     */
    private List<EntryLink> buildEntryLinks(String baseUrl) {
        List<EntryLink> links = new ArrayList<>();

        links.add(createLink("documents", "文档", "浏览所有已归档文档", baseUrl, "/documents/"));
        links.add(createLink("inbox", "收件箱", "查看待处理的文档收件箱", baseUrl, "/inbox/"));
        links.add(createLink("tags", "标签", "管理文档标签", baseUrl, "/tags/"));
        links.add(createLink("correspondents", "通信者", "管理通信者（发件人）", baseUrl, "/correspondents/"));
        links.add(createLink("document_types", "文档类型", "管理文档类型分类", baseUrl, "/document_types/"));
        links.add(createLink("saved_views", "已保存视图", "访问已保存的筛选视图", baseUrl, "/saved_views/"));
        links.add(createLink("tasks", "任务", "查看和处理任务", baseUrl, "/tasks/"));
        links.add(createLink("settings", "设置", "管理 paperless-ngx 设置", baseUrl, "/settings/"));

        return links;
    }

    private EntryLink createLink(String key, String label, String description,
                                  String baseUrl, String path) {
        EntryLink link = new EntryLink();
        link.setKey(key);
        link.setLabel(label);
        link.setDescription(description);
        if (baseUrl != null && !baseUrl.isBlank()) {
            // 确保 baseUrl 结尾无多余斜杠
            String cleanUrl = baseUrl.replaceAll("/+$", "");
            link.setUrl(cleanUrl + path);
        }
        return link;
    }

    /**
     * 通过 HTTP GET {baseUrl}/api/ 检测 paperless-ngx 实例可达性。
     * 使用标准 HttpURLConnection，不引入额外依赖。
     *
     * @return connected / unauthorized / unreachable
     */
    private String checkReachability(String baseUrl) {
        try {
            String cleanUrl = baseUrl.replaceAll("/+$", "");
            URI uri = URI.create(cleanUrl + "/api/");
            HttpURLConnection conn = (HttpURLConnection) uri.toURL().openConnection();
            conn.setConnectTimeout(5000);
            conn.setReadTimeout(5000);
            conn.setRequestMethod("GET");
            conn.connect();

            int code = conn.getResponseCode();
            conn.disconnect();

            if (code == 200) {
                return "connected";
            } else if (code == 401 || code == 403) {
                return "unauthorized";
            } else {
                log.debug("paperless-ngx 返回非预期状态码: {}", code);
                return "unreachable";
            }
        } catch (java.net.ConnectException e) {
            log.debug("paperless-ngx 无法连接: {}", e.getMessage());
            return "unreachable";
        } catch (Exception e) {
            log.debug("paperless-ngx 连通性检查失败: {}", e.getMessage());
            return "unreachable";
        }
    }

    /** 将状态码映射为人类可读信息 */
    private String getStatusMessage(String status) {
        return switch (status) {
            case "connected" -> "paperless-ngx 服务连接正常";
            case "unauthorized" -> "paperless-ngx 服务可达但 API Token 无效";
            case "unreachable" -> "paperless-ngx 服务无法访问，请检查地址和网络";
            case "error" -> "连接测试过程中发生异常";
            default -> "尚未配置 paperless-ngx 连接";
        };
    }
}
