package com.nexus.integration.minio;

import com.nexus.service.LlmConfigService;
import com.nexus.service.SystemConfigService;
import io.minio.GetObjectArgs;
import io.minio.ListObjectsArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.RemoveObjectArgs;
import io.minio.Result;
import io.minio.messages.Item;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/**
 * MinIO 对象存储服务封装，负责 Mindbank 原始文件和处理后 Markdown 的存取。
 * 服务地址、AccessKey、SecretKey 均从 SystemConfigService 动态读取，支持运行时通过 Settings 修改。
 * AccessKey/SecretKey 加密存储，读取后通过 LlmConfigService.decrypt() 解密。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MinioService {

    private static final String DEFAULT_ENDPOINT = "http://192.168.110.105:7001";
    private static final String CONFIG_URL = "mindbank.minio.url";
    private static final String CONFIG_ACCESS_KEY = "mindbank.minio.access_key";
    private static final String CONFIG_SECRET_KEY = "mindbank.minio.secret_key";

    private final SystemConfigService systemConfigService;
    private final LlmConfigService llmConfigService;

    /**
     * 启动时检查 MinIO 配置是否存在，缺失只记 warn 日志不抛异常，
     * 避免未配置 Mindbank 时影响整个应用启动。
     */
    @PostConstruct
    void checkConfig() {
        String accessKey = systemConfigService.get(CONFIG_ACCESS_KEY);
        String secretKey = systemConfigService.get(CONFIG_SECRET_KEY);
        if (accessKey == null || secretKey == null) {
            log.warn("MinIO 凭据未配置（mindbank.minio.access_key / secret_key），Mindbank 文件存储功能不可用");
        } else {
            log.info("MinIO 配置已就绪，endpoint={}", systemConfigService.get(CONFIG_URL, DEFAULT_ENDPOINT));
        }
    }

    /**
     * 每次调用时根据最新配置构造 MinioClient，确保 Settings 修改后立即生效。
     * 配置缺失时抛 IllegalStateException，由调用方决定如何处理（如 Pipeline 标记 failed）。
     */
    private MinioClient getClient() {
        String endpoint = systemConfigService.get(CONFIG_URL, DEFAULT_ENDPOINT);
        String accessKey = systemConfigService.get(CONFIG_ACCESS_KEY);
        String secretKey = systemConfigService.get(CONFIG_SECRET_KEY);
        if (accessKey == null || secretKey == null) {
            throw new IllegalStateException("MinIO 凭据未配置，请在 Settings → Mindbank 中填写 AccessKey/SecretKey");
        }
        return MinioClient.builder()
                .endpoint(endpoint)
                .credentials(llmConfigService.decrypt(accessKey), llmConfigService.decrypt(secretKey))
                .build();
    }

    /**
     * 上传文本内容到指定 bucket。
     *
     * @param bucket  存储桶名
     * @param key     对象 key
     * @param content 文本内容
     */
    public void uploadText(String bucket, String key, String content) {
        byte[] bytes = content.getBytes(StandardCharsets.UTF_8);
        uploadStream(bucket, key, new ByteArrayInputStream(bytes), bytes.length, "text/markdown; charset=utf-8");
    }

    /**
     * 以流方式上传文件，适用于大文件或二进制内容。
     *
     * @param bucket      存储桶名
     * @param key         对象 key
     * @param stream      输入流
     * @param size        内容字节数，未知时传 -1
     * @param contentType MIME 类型
     */
    public void uploadStream(String bucket, String key, InputStream stream, long size, String contentType) {
        try {
            getClient().putObject(
                    PutObjectArgs.builder()
                            .bucket(bucket)
                            .object(key)
                            .stream(stream, size, -1)
                            .contentType(contentType)
                            .build());
        } catch (Exception e) {
            throw new RuntimeException("MinIO 上传失败: bucket=" + bucket + " key=" + key, e);
        }
    }

    /**
     * 下载对象并转为 UTF-8 字符串，用于读取 processed Markdown。
     *
     * @param bucket 存储桶名
     * @param key    对象 key
     * @return 文本内容
     */
    public String downloadAsString(String bucket, String key) {
        try (InputStream is = getClient().getObject(
                GetObjectArgs.builder().bucket(bucket).object(key).build())) {
            return new String(is.readAllBytes(), StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new RuntimeException("MinIO 下载失败: bucket=" + bucket + " key=" + key, e);
        }
    }

    /**
     * 删除指定对象。
     *
     * @param bucket 存储桶名
     * @param key    对象 key
     */
    public void deleteFile(String bucket, String key) {
        try {
            getClient().removeObject(
                    RemoveObjectArgs.builder().bucket(bucket).object(key).build());
        } catch (Exception e) {
            throw new RuntimeException("MinIO 删除失败: bucket=" + bucket + " key=" + key, e);
        }
    }

    /**
     * 列出指定前缀下的对象元信息。
     *
     * @param bucket 存储桶名
     * @param prefix 对象 key 前缀，传 null 或空串则列出全部
     * @return 文件信息列表
     */
    public List<MinioFileInfo> listFiles(String bucket, String prefix) {
        List<MinioFileInfo> files = new ArrayList<>();
        try {
            Iterable<Result<Item>> results = getClient().listObjects(
                    ListObjectsArgs.builder()
                            .bucket(bucket)
                            .prefix(prefix == null ? "" : prefix)
                            .build());
            for (Result<Item> result : results) {
                Item item = result.get();
                files.add(new MinioFileInfo(item.objectName(), item.size(),
                        item.lastModified() != null ? item.lastModified().toString() : null));
            }
        } catch (Exception e) {
            throw new RuntimeException("MinIO 列举失败: bucket=" + bucket + " prefix=" + prefix, e);
        }
        return files;
    }
}
