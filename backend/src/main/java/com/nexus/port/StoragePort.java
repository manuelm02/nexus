package com.nexus.port;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 文件存储端口，隔离 MinIO 实现细节。Pipeline 和 Agent 通过此接口读写文件，
 * 不直接依赖 MinioService，便于后续替换为本地文件、S3 或其他对象存储。
 *
 * Key 命名约定：调用方传入完整 key（含 processed/ 或 originals/ 前缀及子目录）。
 * Adapter 不强制 prefix，由上层 Pipeline 决定 key 结构。
 */
public interface StoragePort {

    /**
     * 读取已转换的 Markdown 文件（位于 processed/ 前缀下）内容为字符串。
     *
     * @param key MinIO 对象 key
     * @return Markdown 文本
     */
    String readProcessed(String key);

    /**
     * 写入已处理的 Markdown 文件（位于 processed/ 前缀下）。
     *
     * @param key      MinIO 对象 key
     * @param markdown Markdown 文本内容
     */
    void putProcessed(String key, String markdown);

    /**
     * 写入原始文件（位于 originals/ 前缀下），由调用方提供二进制字节。
     *
     * @param key         MinIO 对象 key
     * @param data        原始字节
     * @param contentType MIME 类型
     */
    void putOriginal(String key, byte[] data, String contentType);

    /**
     * 删除指定文件。
     *
     * @param key MinIO 对象 key
     */
    void delete(String key);

    /**
     * 列出指定前缀下的文件元信息。
     *
     * @param prefix key 前缀（如 "processed/"），传 null 或空串表示全部
     * @return 文件列表
     */
    List<FileMeta> list(String prefix);

    /**
     * 文件元信息。
     *
     * @param key         完整 key
     * @param size        字节数
     * @param lastModified 最后修改时间
     */
    record FileMeta(String key, long size, LocalDateTime lastModified) {}
}
