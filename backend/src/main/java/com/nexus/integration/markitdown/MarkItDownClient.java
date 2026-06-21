package com.nexus.integration.markitdown;

import com.nexus.service.SystemConfigService;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;

/**
 * MarkItDown 服务客户端，将 PDF/DOCX/PPT 等二进制文件转换为 Markdown。
 * 基础地址从 SystemConfigService 读取，默认 http://192.168.110.10:3004。
 * 通过 multipart/form-data 上传文件，返回纯文本 Markdown。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MarkItDownClient {

    private static final String DEFAULT_BASE_URL = "http://192.168.110.10:3004";
    private static final String CONFIG_URL = "crawl.markitdown.url";

    private final SystemConfigService systemConfigService;

    @PostConstruct
    void checkConfig() {
        log.info("MarkItDown 配置：baseUrl={}", systemConfigService.get(CONFIG_URL, DEFAULT_BASE_URL));
    }

    private RestClient client() {
        return RestClient.builder()
                .baseUrl(systemConfigService.get(CONFIG_URL, DEFAULT_BASE_URL))
                .build();
    }

    /**
     * 上传文件并转换为 Markdown 文本。
     *
     * @param file Spring MultipartFile，由 Controller 层传入
     * @return 转换后的 Markdown 内容
     */
    public String convert(MultipartFile file) {
        try {
            MultiValueMap<String, Object> parts = new LinkedMultiValueMap<>();
            parts.add("file", new ByteArrayResource(file.getBytes()) {
                @Override
                public String getFilename() {
                    return file.getOriginalFilename();
                }
            });
            Map<?, ?> resp = client().post()
                    .uri("/convert")
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .body(parts)
                    .retrieve()
                    .body(Map.class);
            Object markdown = resp != null ? resp.get("markdown") : null;
            if (markdown == null) {
                throw new RuntimeException("MarkItDown 转换失败: 响应缺少 markdown 字段");
            }
            return String.valueOf(markdown);
        } catch (IOException e) {
            throw new RuntimeException("MarkItDown 转换失败: 读取上传文件出错", e);
        }
    }
}
