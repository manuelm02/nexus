package com.nexus.port;

/**
 * 知识库抽象端口，屏蔽底层 RAG 实现细节（当前实现为 AnythingLLM）。
 * 上层 Pipeline / Q&A 服务只依赖此接口，便于后续替换为自建向量库。
 */
public interface KnowledgeBasePort {

    /**
     * 创建知识库工作空间。
     *
     * @param name        工作空间名称
     * @param description 描述（可为 null）
     * @return 底层系统返回的 slug，用作后续操作的标识
     */
    String createWorkspace(String name, String description);

    /**
     * 上传文本文档到指定工作空间，触发 embedding。
     *
     * @param workspaceSlug 工作空间 slug
     * @param content       文档正文（纯文本或 Markdown）
     * @param filename      文件名，底层会据此推断扩展名
     * @return 底层文档 ID
     */
    String uploadDocument(String workspaceSlug, String content, String filename);

    /**
     * 删除已嵌入的文档（同时移除向量）。
     *
     * @param workspaceSlug 工作空间 slug
     * @param docId         uploadDocument 返回的文档 ID
     */
    void deleteDocument(String workspaceSlug, String docId);

    /**
     * 针对工作空间知识库提问。
     *
     * @param workspaceSlug 工作空间 slug
     * @param question      用户问题
     * @return 答案及引用来源 URL 列表
     */
    KnowledgeBaseAnswer query(String workspaceSlug, String question);
}
