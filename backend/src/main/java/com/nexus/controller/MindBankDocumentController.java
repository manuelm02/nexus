package com.nexus.controller;

import com.nexus.dto.request.RetryStepRequest;
import com.nexus.dto.response.ApiResponse;
import com.nexus.dto.response.MindBankDocumentResponse;
import com.nexus.entity.MindBankDocument;
import com.nexus.service.MindBankDocumentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Mindbank 文档查询与状态管理接口。
 * 路径前缀 /api/v1/mindbank/documents。
 *
 * 文档创建（上传/爬取/导入到 workspace）由 CrawlController 负责，不在本 Controller 重复。
 * 文档删除同样在 CrawlController.deleteFile() 中处理（同时清 MinIO 和 DB），
 * 不在本 Controller 重复以保持唯一删除入口便于维护 MinIO 同步。
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/mindbank/documents")
@RequiredArgsConstructor
public class MindBankDocumentController {

    private final MindBankDocumentService documentService;

    /**
     * 查询指定 workspace 的文档列表。
     */
    @GetMapping
    public ApiResponse<List<MindBankDocumentResponse>> listByWorkspace(@RequestParam Long workspaceId) {
        List<MindBankDocument> docs = documentService.listByWorkspace(workspaceId);
        return ApiResponse.ok(docs.stream().map(MindBankDocumentResponse::fromEntity).toList());
    }

    /**
     * 查询单个文档的完整状态（5 步流水线），前端用于轮询 Pipeline 进度。
     */
    @GetMapping("/{id}/status")
    public ApiResponse<MindBankDocumentResponse> getStatus(@PathVariable Long id) {
        return ApiResponse.ok(MindBankDocumentResponse.fromEntity(documentService.getStatus(id)));
    }

    /**
     * 重置指定步骤及后续步骤状态为 pending。Phase 6.6 接入 Pipeline 后会触发实际重跑。
     */
    @PostMapping("/{id}/retry-step")
    public ApiResponse<Void> retryStep(@PathVariable Long id, @Valid @RequestBody RetryStepRequest req) {
        documentService.retryStep(id, req.getStep());
        return ApiResponse.ok();
    }
}
