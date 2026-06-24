package com.nexus.adapter.storage;

import com.nexus.integration.minio.MinioFileInfo;
import com.nexus.integration.minio.MinioService;
import com.nexus.port.StoragePort;
import com.nexus.port.StoragePort.FileMeta;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.util.List;

/**
 * StoragePort 的 MinIO 实现，委托已有 MinioService 完成实际操作。
 * bucket 从 SystemConfigService 读取 mindbank.minio.bucket，未配置时使用 "mindbank" 作为兜底。
 *
 * 不在此处重复 MinioClient 构造和加密凭据管理逻辑，全部复用 MinioService。
 */
@Service
@RequiredArgsConstructor
public class MinioStorageAdapter implements StoragePort {

    private static final String DEFAULT_BUCKET = "mindbank";

    private final MinioService minioService;
    private final com.nexus.service.SystemConfigService systemConfigService;

    private String getBucket() {
        return systemConfigService.get("mindbank.minio.bucket", DEFAULT_BUCKET);
    }

    @Override
    public String readProcessed(String key) {
        return minioService.downloadAsString(getBucket(), key);
    }

    @Override
    public void putProcessed(String key, String markdown) {
        minioService.uploadText(getBucket(), key, markdown);
    }

    @Override
    public void putOriginal(String key, byte[] data, String contentType) {
        minioService.uploadStream(getBucket(), key,
            new ByteArrayInputStream(data), data.length, contentType);
    }

    @Override
    public void delete(String key) {
        minioService.deleteFile(getBucket(), key);
    }

    @Override
    public List<FileMeta> list(String prefix) {
        return minioService.listFiles(getBucket(), prefix).stream()
            .map(MinioStorageAdapter::toFileMeta)
            .toList();
    }

    /**
     * MinioFileInfo → FileMeta 转换，统一时间戳为 LocalDateTime。
     * MinIO 返回的 lastModified 是 ISO-8601 字符串（如 "2024-01-15T10:30:00Z"），
     * 解析失败时使用 now() 兜底。
     */
    private static FileMeta toFileMeta(MinioFileInfo info) {
        LocalDateTime lastModified = parseLastModified(info.lastModified());
        return new FileMeta(info.key(), info.size(), lastModified);
    }

    private static LocalDateTime parseLastModified(String raw) {
        if (raw == null || raw.isBlank()) {
            return LocalDateTime.now();
        }
        try {
            return OffsetDateTime.parse(raw).toLocalDateTime();
        } catch (DateTimeParseException e) {
            return LocalDateTime.now();
        }
    }
}
