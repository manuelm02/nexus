package com.nexus.controller;

import com.nexus.dto.request.QaRequest;
import com.nexus.dto.response.ApiResponse;
import com.nexus.dto.response.QaResponse;
import com.nexus.entity.MindBankWorkspace;
import com.nexus.mapper.MindBankWorkspaceMapper;
import com.nexus.port.KnowledgeBaseAnswer;
import com.nexus.port.KnowledgeBasePort;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Mindbank Q&A 问答接口。
 * 当前为简单的单 Workspace RAG 查询，Phase 6.8 可升级为 Agent C agentic 检索。
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/mindbank/qa")
@RequiredArgsConstructor
public class MindBankQaController {

    private final KnowledgeBasePort knowledgeBasePort;
    private final MindBankWorkspaceMapper workspaceMapper;

    /**
     * 针对指定 Workspace 的知识库问答。
     * AnythingLLM 同步返回，非流式输出。
     */
    @PostMapping("/{workspaceId}/chat")
    public ApiResponse<QaResponse> chat(@PathVariable Long workspaceId, @RequestBody QaRequest req) {
        MindBankWorkspace workspace = workspaceMapper.selectById(workspaceId);
        if (workspace == null) return ApiResponse.error("Workspace 不存在");
        if (workspace.getAnythingllmSlug() == null) {
            return ApiResponse.error("该 Workspace 尚未完成知识库初始化");
        }

        KnowledgeBaseAnswer answer = knowledgeBasePort.query(workspace.getAnythingllmSlug(), req.question());
        return ApiResponse.ok(new QaResponse(answer.answer(), answer.sourceUrls()));
    }
}
