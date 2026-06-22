package com.nexus.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.nexus.dto.request.CreateWorkspaceRequest;
import com.nexus.dto.request.UpdateWorkspaceRequest;
import com.nexus.dto.response.ApiResponse;
import com.nexus.dto.response.MasterNoteResponse;
import com.nexus.dto.response.SessionNoteResponse;
import com.nexus.dto.response.WorkspaceResponse;
import com.nexus.entity.MindBankDocument;
import com.nexus.entity.MindBankWorkspace;
import com.nexus.mapper.MindBankDocumentMapper;
import com.nexus.port.NotePort;
import com.nexus.service.MindBankWorkspaceService;
import com.nexus.service.SystemConfigService;
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

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

/**
 * Mindbank Workspace 完整 CRUD（Phase 6.5）及笔记查看接口（Phase 6.6）。
 * 路径前缀 /api/v1/mindbank/workspaces，DTO 转换由 Service 完成后 Controller 只负责 HTTP 协议层。
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/mindbank/workspaces")
@RequiredArgsConstructor
public class MindBankWorkspaceController {

    private final MindBankWorkspaceService workspaceService;
    private final NotePort notePort;
    private final MindBankDocumentMapper documentMapper;
    private final SystemConfigService systemConfigService;

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

    /** 读取 Workspace 的 Master Note 内容，供前端笔记查看器使用 */
    @GetMapping("/{id}/master-note")
    public ApiResponse<MasterNoteResponse> getMasterNote(@PathVariable Long id) {
        MindBankWorkspace workspace = workspaceService.list().stream()
            .filter(w -> w.getId().equals(id)).findFirst().orElse(null);
        if (workspace == null) return ApiResponse.error("Workspace 不存在");

        String content = notePort.readMaster(workspace.getName());
        if (content == null) return ApiResponse.ok(new MasterNoteResponse(null, null, "尚未生成笔记"));
        return ApiResponse.ok(new MasterNoteResponse(content, workspace.getMasterNotePath(), null));
    }

    /**
     * 读取 Workspace 下所有 Session Note。
     * 查询 mindbank_documents 中 workspace_id={id} AND session_note_path IS NOT NULL，
     * 逐个读取文件内容，文件不存在则跳过，按 created_at 倒序返回。
     */
    @GetMapping("/{id}/session-notes")
    public ApiResponse<List<SessionNoteResponse>> getSessionNotes(@PathVariable Long id) {
        List<MindBankDocument> docs = documentMapper.selectList(
            new LambdaQueryWrapper<MindBankDocument>()
                .eq(MindBankDocument::getWorkspaceId, id)
                .isNotNull(MindBankDocument::getSessionNotePath)
                .orderByDesc(MindBankDocument::getCreatedAt));

        List<SessionNoteResponse> results = new ArrayList<>();
        for (MindBankDocument doc : docs) {
            String path = doc.getSessionNotePath();
            try {
                Path filePath = Path.of(path);
                if (Files.exists(filePath)) {
                    String content = Files.readString(filePath);
                    String date = filePath.getFileName().toString()
                        .replaceAll(".*__session__", "").replaceAll("\\.md$", "");
                    results.add(new SessionNoteResponse(content, path, date));
                }
            } catch (IOException e) {
                log.warn("读取 Session Note 失败（跳过）: path={}, err={}", path, e.getMessage());
            }
        }
        return ApiResponse.ok(results);
    }
}
