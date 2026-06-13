package com.nexus.dto.response;

import lombok.Data;

import java.util.List;

/** paperless-ngx 文档响应，仅包含元数据，不存储文档正文。 */
@Data
public class DocumentResponse {
    /** paperless-ngx 内部 ID */
    private String id;
    /** 文档标题 */
    private String title;
    /** 原始文件名 */
    private String originalFileName;
    /** paperless 创建时间 */
    private String createdAt;
    /** paperless 添加时间 */
    private String addedAt;
    /** 通信者/发送者 */
    private String correspondent;
    /** 文档类型 */
    private String documentType;
    /** 标签列表 */
    private List<String> tags;
    /** 文档下载链接 */
    private String downloadUrl;
    /** 预览链接（第一版暂不实现） */
    private String previewUrl;
}
