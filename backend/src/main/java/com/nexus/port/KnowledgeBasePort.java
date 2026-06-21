package com.nexus.port;

import java.util.ArrayList;
import java.util.List;

/**
 * 知识库抽象端口，屏蔽底层 RAG实现细节（当前实现为 AnythingLLM）。
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

    /**
     * 跨多个 Workspace 检索，合并结果返回。
     * 供 Agent C（agentic Q&A）使用。默认实现：逐个调用 query() 后合并 answer 和 sourceUrls。
     * 任何工作空间查询失败不会中断整体流程，仅 log warn 后跳过该工作空间。
     *
     * @param workspaceSlugs 工作空间 slug 列表
     * @param question       用户问题
     * @return 合并后的答案及来源列表
     */
    default KnowledgeBaseAnswer queryMultiple(List<String> workspaceSlugs, String question) {
        if (workspaceSlugs == null || workspaceSlugs.isEmpty()) {
            return KnowledgeBaseAnswer.of("");
        }
        StringBuilder combinedAnswer = new StringBuilder();
        List<String> allSources = new ArrayList<>();
        for (String slug : workspaceSlugs) {
            try {
                KnowledgeBaseAnswer result = query(slug, question);
                if (result != null && result.answer() != null && !result.answer().isBlank()) {
                    if (combinedAnswer.length() > 0) combinedAnswer.append("\n\n---\n\n");
                    combinedAnswer.append(result.answer());
                    if (result.sourceUrls() != null) {
                        allSources.addAll(result.sourceUrls());
                    }
                }
            } catch (Exception e) {
                // 单 workspace 失败不阻断整体流程，便于降级到可用 workspace
                org.slf4j.LoggerFactory.getLogger(KnowledgeBasePort.class)
                    .warn("queryMultiple 跳过失败 workspace={}: {}", slug, e.getMessage());
            }
        }
        return new KnowledgeBaseAnswer(combinedAnswer.toString().trim(), allSources);
    }
}
