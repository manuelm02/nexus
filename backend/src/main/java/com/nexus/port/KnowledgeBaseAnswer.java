package com.nexus.port;

import java.util.List;

/**
 * 知识库问答结果载体。
 *
 * @param answer     生成的回答文本
 * @param sourceUrls 引用来源 URL 列表，底层 RAG 可能不返回来源，此时为空列表
 */
public record KnowledgeBaseAnswer(String answer, List<String> sourceUrls) {
    public static KnowledgeBaseAnswer of(String answer) {
        return new KnowledgeBaseAnswer(answer, List.of());
    }
}
