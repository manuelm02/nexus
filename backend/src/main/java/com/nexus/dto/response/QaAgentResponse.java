package com.nexus.dto.response;

/**
 * Agent C Q&A 响应，包含答案和 agent task ID（供前端展示执行轨迹）。
 */
public record QaAgentResponse(String answer, Long agentTaskId) {}
