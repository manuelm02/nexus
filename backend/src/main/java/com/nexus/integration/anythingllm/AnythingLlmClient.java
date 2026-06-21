package com.nexus.integration.anythingllm;

import com.nexus.port.KnowledgeBaseAnswer;
import com.nexus.port.KnowledgeBasePort;
import com.nexus.service.LlmConfigService;
import com.nexus.service.SystemConfigService;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * AnythingLLM REST API 客户端，实现 KnowledgeBasePort。
 * 负责 Workspace 创建、文本文档上传/embedding、文档删除、基于知识库的问答。
 * Bearer Token 加密存储，读取后通过 LlmConfigService.decrypt() 解密。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AnythingLlmClient implements KnowledgeBasePort {

    private static final String DEFAULT_BASE_URL = "http://192.168.110.10:3001";
    private static final String CONFIG_URL = "mindbank.anythingllm.url";
    private static final String CONFIG_API_KEY = "mindbank.anythingllm.api_key";

    private final SystemConfigService systemConfigService;
    private final LlmConfigService llmConfigService;

    /**
     * 启动时检查 API Key 是否已配置，缺失只记 warn 日志不抛异常，
     * 避免未配置 Mindbank 时影响整个应用启动。
     */
    @PostConstruct
    void checkConfig() {
        String apiKey = systemConfigService.get(CONFIG_API_KEY);
        if (apiKey == null) {
            log.warn("AnythingLLM API Key 未配置（mindbank.anythingllm.api_key），知识库功能不可用");
        } else {
            log.info("AnythingLLM 配置已就绪，baseUrl={}", systemConfigService.get(CONFIG_URL, DEFAULT_BASE_URL));
        }
    }

    /** 每次调用时根据最新配置构造 RestClient，Bearer Token 动态解密 */
    private RestClient client() {
        String baseUrl = systemConfigService.get(CONFIG_URL, DEFAULT_BASE_URL);
        String apiKey = systemConfigService.get(CONFIG_API_KEY);
        if (apiKey == null) {
            throw new IllegalStateException("AnythingLLM API Key 未配置，请在 Settings → Mindbank 中填写");
        }
        return RestClient.builder()
                .baseUrl(baseUrl)
                .defaultHeader("Authorization", "Bearer " + llmConfigService.decrypt(apiKey))
                .defaultHeader("Accept", "application/json")
                .build();
    }

    @Override
    public String createWorkspace(String name, String description) {
        Map<String, Object> body = description != null
                ? Map.of("name", name, "description", description)
                : Map.of("name", name);
        Map<?, ?> resp = client().post()
                .uri("/api/v1/workspaces")
                .body(body)
                .retrieve()
                .body(Map.class);
        Map<?, ?> workspace = (Map<?, ?>) resp.get("workspace");
        if (workspace == null) {
            throw new RuntimeException("AnythingLLM 创建 workspace 失败: 响应缺少 workspace 字段");
        }
        return (String) workspace.get("slug");
    }

    @Override
    public String uploadDocument(String workspaceSlug, String content, String filename) {
        Map<String, Object> body = Map.of(
                "name", filename,
                "text", content);
        Map<?, ?> resp = client().post()
                .uri("/api/v1/workspace/{slug}/upload-text", workspaceSlug)
                .body(body)
                .retrieve()
                .body(Map.class);
        List<?> documents = (List<?>) resp.get("documents");
        if (documents == null || documents.isEmpty()) {
            throw new RuntimeException("AnythingLLM 上传文档失败: 响应缺少 documents 字段");
        }
        Map<?, ?> doc = (Map<?, ?>) documents.get(0);
        return String.valueOf(doc.get("id"));
    }

    @Override
    public void deleteDocument(String workspaceSlug, String docId) {
        client().delete()
                .uri("/api/v1/workspace/{slug}/remove-embedded/{docId}", workspaceSlug, docId)
                .retrieve()
                .toBodilessEntity();
    }

    @Override
    @SuppressWarnings("unchecked")
    public KnowledgeBaseAnswer query(String workspaceSlug, String question) {
        Map<String, Object> body = Map.of(
                "message", question,
                "mode", "chat");
        Map<String, Object> resp = client().post()
                .uri("/api/v1/workspace/{slug}/chat", workspaceSlug)
                .body(body)
                .retrieve()
                .body(Map.class);
        String answer = String.valueOf(resp.get("textResponse"));
        List<String> sourceUrls = new ArrayList<>();
        List<Map<String, Object>> sources = (List<Map<String, Object>>) resp.get("sources");
        if (sources != null) {
            for (Map<String, Object> source : sources) {
                Object title = source.get("title");
                if (title != null) {
                    sourceUrls.add(String.valueOf(title));
                }
            }
        }
        return new KnowledgeBaseAnswer(answer, sourceUrls);
    }
}
