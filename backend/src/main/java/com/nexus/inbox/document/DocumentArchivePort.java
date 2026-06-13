package com.nexus.inbox.document;

import com.nexus.dto.response.DocumentResponse;

import java.util.List;

/**
 * 文档归档端口——定义 Nexus 访问外部文档管理系统的契约。
 * 当前实现为 paperless-ngx 接入层，文档事实源始终在 paperless-ngx，不在 Nexus 本地落表。
 */
public interface DocumentArchivePort {

    /**
     * 获取文档列表。
     *
     * @param page 页码，从 1 开始
     * @param size 每页数量
     * @return 文档响应列表
     * @throws IllegalStateException 外部服务未配置
     */
    List<DocumentResponse> list(int page, int size);

    /**
     * 获取文档详情元数据。
     *
     * @param id 文档 ID
     * @return 文档详细信息
     */
    DocumentResponse detail(String id);

    /**
     * 上传文件到文档管理系统。
     *
     * @param fileName     原始文件名
     * @param fileBytes    文件字节内容
     * @param title        可选标题
     * @param tags         可选标签列表
     * @return 创建后的文档响应
     */
    DocumentResponse upload(String fileName, byte[] fileBytes, String title, List<String> tags);
}
