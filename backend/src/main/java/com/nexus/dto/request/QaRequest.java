package com.nexus.dto.request;

/**
 * Mindbank Q&A 问答请求。
 *
 * @param question   用户问题
 * @param agentMode  是否启用 Agent 模式（Agent C agentic 检索）；null 或 false 走简单 RAG
 */
public record QaRequest(String question, Boolean agentMode) {

    /** 兼容只传 question 的旧调用 */
    public QaRequest(String question) {
        this(question, null);
    }
}
