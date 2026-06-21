package com.nexus.integration.minio;

/**
 * MinIO 文件元信息，listFiles 返回的列表元素。
 *
 * @param key        对象 key（完整路径）
 * @param size       文件大小（字节）
 * @param lastModified 最后修改时间（ISO 格式字符串，MinIO 返回的原始值）
 */
public record MinioFileInfo(String key, long size, String lastModified) {
}
