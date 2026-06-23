package com.nexus.controller;

import com.nexus.dto.request.QaRequest;
import com.nexus.dto.response.ApiResponse;
import com.nexus.dto.response.QaAgentResponse;
import com.nexus.dto.response.QaResponse;
import com.nexus.entity.MindBankWorkspace;
import com.nexus.mapper.MindBankWorkspaceMapper;
import com.nexus.port.KnowledgeBaseAnswer;
import com.nexus.port.KnowledgeBasePort;
import com.nexus.service.MindBankQaAgent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

/**
 * Mindbank Q&A 问答接口。
 * 支持两种模式：
 * - 简单模式（默认）：固定单 Workspace RAG 查询，AnythingLLM 同步返回
 * - Agent 模式（agentMode=true）：Agent C 自主检索多个 Workspace，多轮检索后综合回答
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/mindbank/qa")
@RequiredArgsConstructor
public class MindBankQaController {

    private final KnowledgeBasePort knowledgeBasePort;
    private final MindBankWorkspaceMapper workspaceMapper;
    private final MindBankQaAgent qaAgent;

    /**
     * 针对指定 Workspace 的知识库问答。
     * agentMode=true 时走 Agent C agentic 检索，否则走简单 RAG。
     * 两种模式返回结构统一为 { answer, sources?, agentTaskId?, mode }。
     */
    @PostMapping("/{workspaceId}/chat")
    public ApiResponse<Map<String, Object>> chat(@PathVariable Long workspaceId, @RequestBody QaRequest req) {
        MindBankWorkspace workspace = workspaceMapper.selectById(workspaceId);
        if (workspace == null) return ApiResponse.error("Workspace 不存在");

        // Agent 模式：走 Agent C agentic 检索
        if (req.agentMode() != null && req.agentMode()) {
            try {
                QaAgentResponse result = qaAgent.ask(req.question(), workspaceId);
                Map<String, Object> data = new HashMap<>();
                data.put("answer", result.answer());
                data.put("agentTaskId", result.agentTaskId());
                data.put("mode", "agent");
                return ApiResponse.ok(data);
            } catch (Exception e) {
                log.error("Agent C Q&A 失败，workspaceId={}: {}", workspaceId, e.getMessage());
                return ApiResponse.error("Agent 模式查询失败：" + e.getMessage());
            }
        }

        // 简单模式：走固定单 Workspace RAG
        if (workspace.getAnythingllmSlug() == null) {
            return ApiResponse.error("该 Workspace 尚未完成知识库初始化");
        }
        KnowledgeBaseAnswer answer = knowledgeBasePort.query(workspace.getAnythingllmSlug(), req.question());
        Map<String, Object> data = new HashMap<>();
        data.put("answer", answer.answer());
        data.put("sources", answer.sourceUrls());
        data.put("mode", "simple");
        return ApiResponse.ok(data);
    }
}
