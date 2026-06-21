package com.nexus.controller;

import com.nexus.dto.request.CreateWorkspaceRequest;
import com.nexus.dto.request.UpdateWorkspaceRequest;
import com.nexus.dto.response.ApiResponse;
import com.nexus.dto.response.WorkspaceResponse;
import com.nexus.entity.MindBankWorkspace;
import com.nexus.service.MindBankWorkspaceService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Mindbank Workspace 完整 CRUD（Phase 6.5）。
 * 路径前缀 /api/v1/mindbank/workspaces，DTO 转换由 Service 完成后 Controller 只负责 HTTP 协议层。
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/mindbank/workspaces")
@RequiredArgsConstructor
public class MindBankWorkspaceController {

    private final MindBankWorkspaceService workspaceService;

    /**
     * 查询所有 Workspace，含 documentCount。
     */
    @GetMapping
    public ApiResponse<List<WorkspaceResponse>> list() {
        List<MindBankWorkspace> workspaces = workspaceService.list();
        List<WorkspaceResponse> responses = workspaces.stream()
            .map(w -> WorkspaceResponse.fromEntity(w, workspaceService.countDocuments(w.getId())))
            .toList();
        return ApiResponse.ok(responses);
    }

    /**
     * 新建 Workspace：DB 落库 + 联动 AnythingLLM（失败不阻断）。
     */
    @PostMapping
    public ApiResponse<WorkspaceResponse> create(@Valid @RequestBody CreateWorkspaceRequest req) {
        MindBankWorkspace created = workspaceService.create(req);
        return ApiResponse.ok(WorkspaceResponse.fromEntity(created, 0));
    }

    /**
     * 更新 Workspace 基础信息。
     */
    @PutMapping("/{id}")
    public ApiResponse<Void> update(@PathVariable Long id, @Valid @RequestBody UpdateWorkspaceRequest req) {
        workspaceService.update(id, req);
        return ApiResponse.ok();
    }

    /**
     * 删除 Workspace：仅删 DB 记录（AnythingLLM workspace 保留，便于恢复）。
     */
    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        workspaceService.delete(id);
        return ApiResponse.ok();
    }
}
