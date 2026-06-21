package com.nexus.controller;

import com.nexus.dto.request.CreateNoteRequest;
import com.nexus.dto.request.RenameNoteRequest;
import com.nexus.dto.request.SaveNoteRequest;
import com.nexus.dto.response.ApiResponse;
import com.nexus.dto.response.FileTreeNodeResponse;
import com.nexus.service.NotesService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * NotesController 提供 Obsidian vault 文件树浏览和 Markdown 编辑接口。
 * 所有路径参数均为相对 vault 根的相对路径，NotesService 强制校验防穿越。
 * vault 路径未配置时返回友好错误，不抛 500。
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/notes")
@RequiredArgsConstructor
public class NotesController {

    private final NotesService notesService;

    /** 获取 vault 完整目录树（递归，只含 .md 文件和目录） */
    @GetMapping("/tree")
    public ApiResponse<List<FileTreeNodeResponse>> getTree() {
        try {
            return ApiResponse.ok(notesService.getFileTree());
        } catch (IllegalStateException e) {
            // vault 未配置
            return ApiResponse.error("VAULT_NOT_CONFIGURED", e.getMessage());
        }
    }

    /** 读取指定 .md 文件内容 */
    @GetMapping("/file")
    public ApiResponse<Map<String, String>> readFile(@RequestParam String path) {
        try {
            return ApiResponse.ok(Map.of("content", notesService.readFile(path)));
        } catch (IllegalStateException e) {
            return ApiResponse.error("VAULT_NOT_CONFIGURED", e.getMessage());
        } catch (IllegalArgumentException e) {
            return ApiResponse.error("FILE_NOT_FOUND", e.getMessage());
        }
    }

    /** 保存文件内容 */
    @PutMapping("/file")
    public ApiResponse<Void> saveFile(@RequestBody SaveNoteRequest req) {
        try {
            notesService.saveFile(req.getPath(), req.getContent());
            return ApiResponse.ok();
        } catch (IllegalStateException e) {
            return ApiResponse.error("VAULT_NOT_CONFIGURED", e.getMessage());
        }
    }

    /** 新建空 .md 文件（父目录不存在则创建） */
    @PostMapping("/file")
    public ApiResponse<Void> createFile(@RequestBody CreateNoteRequest req) {
        try {
            notesService.createFile(req.getPath());
            return ApiResponse.ok();
        } catch (IllegalStateException e) {
            return ApiResponse.error("VAULT_NOT_CONFIGURED", e.getMessage());
        } catch (IllegalArgumentException e) {
            return ApiResponse.error("FILE_EXISTS", e.getMessage());
        }
    }

    /** 新建文件夹 */
    @PostMapping("/folder")
    public ApiResponse<Void> createFolder(@RequestBody CreateNoteRequest req) {
        try {
            notesService.createFolder(req.getPath());
            return ApiResponse.ok();
        } catch (IllegalStateException e) {
            return ApiResponse.error("VAULT_NOT_CONFIGURED", e.getMessage());
        } catch (IllegalArgumentException e) {
            return ApiResponse.error("FOLDER_EXISTS", e.getMessage());
        }
    }

    /** 重命名/移动文件或目录 */
    @PutMapping("/rename")
    public ApiResponse<Void> rename(@RequestBody RenameNoteRequest req) {
        try {
            notesService.rename(req.getOldPath(), req.getNewPath());
            return ApiResponse.ok();
        } catch (IllegalStateException e) {
            return ApiResponse.error("VAULT_NOT_CONFIGURED", e.getMessage());
        } catch (IllegalArgumentException e) {
            return ApiResponse.error("RENAME_FAILED", e.getMessage());
        }
    }

    /** 删除文件 */
    @DeleteMapping("/file")
    public ApiResponse<Void> deleteFile(@RequestParam String path) {
        try {
            notesService.deleteFile(path);
            return ApiResponse.ok();
        } catch (IllegalStateException e) {
            return ApiResponse.error("VAULT_NOT_CONFIGURED", e.getMessage());
        } catch (IllegalArgumentException e) {
            return ApiResponse.error("FILE_NOT_FOUND", e.getMessage());
        }
    }

    /** 递归删除目录（含子内容，前端需先二次确认） */
    @DeleteMapping("/folder")
    public ApiResponse<Void> deleteFolder(@RequestParam String path) {
        try {
            notesService.deleteFolder(path);
            return ApiResponse.ok();
        } catch (IllegalStateException e) {
            return ApiResponse.error("VAULT_NOT_CONFIGURED", e.getMessage());
        } catch (IllegalArgumentException e) {
            return ApiResponse.error("FOLDER_NOT_FOUND", e.getMessage());
        }
    }
}
