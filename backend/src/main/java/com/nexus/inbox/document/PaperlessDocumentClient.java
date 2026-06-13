package com.nexus.inbox.document;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexus.config.InboxIntegrationProperties;
import com.nexus.dto.response.DocumentResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.client.HttpClientErrorException;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * paperless-ngx 客户端适配器，通过 REST API 访问 paperless-ngx 实例。
 * 文档事实源由 paperless-ngx 管理，Nexus 不新建本地 documents 表。
 * 配置缺失时抛出 IllegalStateException，由 Controller 层转换为 PAPERLESS_NOT_CONFIGURED 响应。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class PaperlessDocumentClient implements DocumentArchivePort {

    private final InboxIntegrationProperties properties;
    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public List<DocumentResponse> list(int page, int size) {
        checkConfigured();
        String url = properties.getPaperless().getBaseUrl() + "/api/documents/?page=" + page + "&page_size=" + size;
        try {
            ResponseEntity<String> resp = restTemplate.exchange(url, HttpMethod.GET, authHeaders(), String.class);
            JsonNode root = objectMapper.readTree(resp.getBody());
            List<DocumentResponse> results = new ArrayList<>();
            for (JsonNode node : root.get("results")) {
                results.add(mapDocument(node));
            }
            return results;
        } catch (HttpClientErrorException e) {
            throw new IllegalStateException("paperless-ngx 请求失败: " + e.getStatusCode(), e);
        } catch (Exception e) {
            throw new IllegalStateException("paperless-ngx 通信异常", e);
        }
    }

    @Override
    public DocumentResponse detail(String id) {
        checkConfigured();
        String url = properties.getPaperless().getBaseUrl() + "/api/documents/" + id + "/";
        try {
            ResponseEntity<String> resp = restTemplate.exchange(url, HttpMethod.GET, authHeaders(), String.class);
            return mapDocument(objectMapper.readTree(resp.getBody()));
        } catch (HttpClientErrorException.NotFound e) {
            throw new IllegalArgumentException("文档不存在: " + id);
        } catch (HttpClientErrorException e) {
            throw new IllegalStateException("paperless-ngx 请求失败: " + e.getStatusCode(), e);
        } catch (Exception e) {
            throw new IllegalStateException("paperless-ngx 通信异常", e);
        }
    }

    @Override
    public DocumentResponse upload(String fileName, byte[] fileBytes, String title, List<String> tags) {
        checkConfigured();
        String url = properties.getPaperless().getBaseUrl() + "/api/documents/post_document/";
        try {
            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            body.add("document", new ByteArrayResource(fileBytes) {
                @Override
                public String getFilename() {
                    return fileName;
                }
            });
            if (title != null && !title.isBlank()) body.add("title", title);
            if (tags != null) {
                // paperless-ngx 需要 JSON 字符串格式的 tags
                try {
                    body.add("tags", objectMapper.writeValueAsString(tags));
                } catch (Exception ignored) {
                }
            }
            // paperless-ngx 上传请求不使用 application/json，使用 multipart/form-data
            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", "Token " + properties.getPaperless().getToken());
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);
            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);
            ResponseEntity<String> resp = restTemplate.postForEntity(url, requestEntity, String.class);

            // paperless-ngx upload 成功返回 "OK"，不含文档 ID；需要通过其它方式获取
            // 第一版返回简化响应
            DocumentResponse docResp = new DocumentResponse();
            docResp.setTitle(title != null ? title : fileName);
            docResp.setOriginalFileName(fileName);
            docResp.setTags(tags != null ? tags : Collections.emptyList());
            return docResp;
        } catch (HttpClientErrorException e) {
            throw new IllegalStateException("paperless-ngx 上传失败: " + e.getStatusCode(), e);
        } catch (Exception e) {
            throw new IllegalStateException("paperless-ngx 上传通信异常", e);
        }
    }

    private void checkConfigured() {
        if (!properties.getPaperless().isConfigured()) {
            throw new IllegalStateException("paperless-ngx 未配置，请设置 PAPERLESS_BASE_URL 和 PAPERLESS_TOKEN 环境变量");
        }
    }

    private HttpEntity<Void> authHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", "Token " + properties.getPaperless().getToken());
        return new HttpEntity<>(headers);
    }

    private DocumentResponse mapDocument(JsonNode node) {
        DocumentResponse r = new DocumentResponse();
        r.setId(node.has("id") ? String.valueOf(node.get("id").asInt()) : null);
        r.setTitle(node.has("title") ? node.get("title").asText() : null);
        r.setOriginalFileName(node.has("original_file_name") ? node.get("original_file_name").asText() : null);
        r.setCreatedAt(node.has("created") ? node.get("created").asText() : null);
        r.setAddedAt(node.has("added") ? node.get("added").asText() : null);
        if (node.has("correspondent") && !node.get("correspondent").isNull()) {
            r.setCorrespondent(node.get("correspondent").asText());
        }
        if (node.has("document_type") && !node.get("document_type").isNull()) {
            r.setDocumentType(node.get("document_type").asText());
        }
        List<String> tagList = new ArrayList<>();
        if (node.has("tags") && node.get("tags").isArray()) {
            for (JsonNode tag : node.get("tags")) {
                tagList.add(tag.asText());
            }
        }
        r.setTags(tagList);
        // paperless-ngx 下载地址通常为 /api/documents/{id}/download/
        if (node.has("id")) {
            String baseUrl = properties.getPaperless().getBaseUrl();
            String docId = String.valueOf(node.get("id").asInt());
            r.setDownloadUrl(baseUrl + "/api/documents/" + docId + "/download/");
        }
        return r;
    }
}
