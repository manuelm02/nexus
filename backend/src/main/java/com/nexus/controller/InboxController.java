package com.nexus.controller;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.nexus.dto.request.*;
import com.nexus.dto.response.*;
import com.nexus.entity.InboxItem;
import com.nexus.inbox.document.DocumentArchivePort;
import com.nexus.inbox.note.NoteSinkPort;
import com.nexus.service.BookmarkService;
import com.nexus.service.InboxService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

/**
 * Inbox 多源收纳接口。
 * 保留 /fleeting 旧路径兼容已有客户端。
 * 书签为 Nexus 原生 CRUD；文档通过 paperless-ngx 代理；笔记写入 Obsidian Markdown。
 */
@Slf4j
@RestController
@RequestMapping({"/api/v1/inbox", "/api/v1/fleeting"})
@RequiredArgsConstructor
public class InboxController {

    private final InboxService inboxService;
    private final BookmarkService bookmarkService;
    private final NoteSinkPort noteSinkPort;
    private final DocumentArchivePort documentArchivePort;

    // ==================== 旧 inbox_items 接口（兼容） ====================

    @GetMapping
    public ApiResponse<List<InboxItem>> list() {
        return ApiResponse.ok(inboxService.list());
    }

    @PostMapping
    public ApiResponse<InboxItem> create(@Valid @RequestBody InboxCreateRequest req) {
        return ApiResponse.ok(inboxService.create(req));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable String id) {
        inboxService.delete(id);
        return ApiResponse.ok();
    }

    // ==================== 书签 ====================

    /** 分页查询书签列表，支持关键词搜索、标签筛选、未读/归档过滤 */
    @GetMapping("/bookmarks")
    public ApiResponse<Page<BookmarkResponse>> listBookmarks(@Valid BookmarkListRequest req) {
        return ApiResponse.ok(bookmarkService.list(req));
    }

    /** 创建书签，URL 必填且须 http:// 或 https:// 开头 */
    @PostMapping("/bookmarks")
    public ApiResponse<BookmarkResponse> createBookmark(@Valid @RequestBody BookmarkCreateRequest req) {
        return ApiResponse.ok(bookmarkService.create(req));
    }

    /** 局部更新书签：标题、描述、备注、标签、未读、归档 */
    @PatchMapping("/bookmarks/{id}")
    public ApiResponse<BookmarkResponse> updateBookmark(@PathVariable String id,
                                                         @RequestBody BookmarkUpdateRequest req) {
        return ApiResponse.ok(bookmarkService.update(id, req));
    }

    /** 硬删除书签，前端需做二次确认 */
    @DeleteMapping("/bookmarks/{id}")
    public ApiResponse<Void> deleteBookmark(@PathVariable String id) {
        bookmarkService.delete(id);
        return ApiResponse.ok();
    }

    // ==================== 文档（paperless-ngx） ====================

    /** 获取 paperless-ngx 文档列表，配置缺失时返回 PAPERLESS_NOT_CONFIGURED */
    @GetMapping("/documents")
    public ApiResponse<List<DocumentResponse>> listDocuments(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size) {
        try {
            return ApiResponse.ok(documentArchivePort.list(page, size));
        } catch (IllegalStateException e) {
            return ApiResponse.error("PAPERLESS_NOT_CONFIGURED", e.getMessage());
        } catch (Exception e) {
            return ApiResponse.error("PAPERLESS_REQUEST_FAILED", "paperless-ngx 请求失败");
        }
    }

    /** 获取 paperless-ngx 文档详情 */
    @GetMapping("/documents/{id}")
    public ApiResponse<DocumentResponse> documentDetail(@PathVariable String id) {
        try {
            return ApiResponse.ok(documentArchivePort.detail(id));
        } catch (IllegalStateException e) {
            return ApiResponse.error("PAPERLESS_NOT_CONFIGURED", e.getMessage());
        } catch (IllegalArgumentException e) {
            return ApiResponse.error("DOCUMENT_NOT_FOUND", e.getMessage());
        } catch (Exception e) {
            return ApiResponse.error("PAPERLESS_REQUEST_FAILED", "paperless-ngx 请求失败");
        }
    }

    /**
     * 上传文件到 paperless-ngx。
     * 使用 multipart/form-data，请求参数通过 @RequestParam 接收。
     */
    @PostMapping("/documents")
    public ApiResponse<DocumentResponse> uploadDocument(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "title", required = false) String title,
            @RequestParam(value = "tags", required = false) List<String> tags) {
        try {
            byte[] bytes = file.getBytes();
            return ApiResponse.ok(documentArchivePort.upload(
                    file.getOriginalFilename() != null ? file.getOriginalFilename() : "unnamed",
                    bytes, title, tags));
        } catch (IllegalStateException e) {
            return ApiResponse.error("PAPERLESS_NOT_CONFIGURED", e.getMessage());
        } catch (IOException e) {
            return ApiResponse.error("FILE_READ_ERROR", "无法读取上传文件");
        } catch (Exception e) {
            return ApiResponse.error("PAPERLESS_REQUEST_FAILED", "paperless-ngx 上传失败");
        }
    }

    // ==================== 笔记（Obsidian Markdown） ====================

    /** 写入 Quick Note / Memo 到 Obsidian Vault */
    @PostMapping("/notes")
    public ApiResponse<QuickNoteResponse> createNote(@Valid @RequestBody QuickNoteRequest req) {
        try {
            return ApiResponse.ok(noteSinkPort.write(req));
        } catch (IllegalStateException e) {
            return ApiResponse.error("OBSIDIAN_NOT_CONFIGURED", e.getMessage());
        } catch (IllegalArgumentException e) {
            return ApiResponse.error("NOTE_CONTENT_REQUIRED", e.getMessage());
        } catch (SecurityException e) {
            log.warn("笔记路径穿越检测: {}", e.getMessage());
            return ApiResponse.error("OBSIDIAN_WRITE_FAILED", "文件路径不安全");
        } catch (Exception e) {
            log.error("Obsidian 笔记写入失败", e);
            return ApiResponse.error("OBSIDIAN_WRITE_FAILED", "笔记写入失败");
        }
    }
}
