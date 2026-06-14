package com.nexus.controller;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.nexus.dto.request.*;
import com.nexus.dto.response.*;
import com.nexus.entity.BookmarkSmartGroup;
import com.nexus.entity.InboxItem;
import com.nexus.inbox.document.DocumentArchivePort;
import com.nexus.inbox.note.NoteSinkPort;
import com.nexus.service.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Inbox 多源收纳接口——AI Capture Workspace。
 * 保留 /fleeting 旧路径兼容已有客户端。
 * 书签为 Nexus 原生 CRUD + AI 分析/导入/智能分组；文档通过 paperless-ngx 代理；笔记写入 Obsidian Markdown + AI 辅助。
 */
@Slf4j
@RestController
@RequestMapping({"/api/v1/inbox", "/api/v1/fleeting"})
@RequiredArgsConstructor
public class InboxController {

    private final InboxService inboxService;
    private final BookmarkService bookmarkService;
    private final BookmarkAiService bookmarkAiService;
    private final BookmarkImportService bookmarkImportService;
    private final BookmarkSmartGroupService bookmarkSmartGroupService;
    private final PaperlessGatewayService paperlessGatewayService;
    private final NoteAiService noteAiService;
    private final NoteSummaryService noteSummaryService;
    private final NoteTagIndexService noteTagIndexService;
    private final NoteTagReorganizeService noteTagReorganizeService;
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
        try {
            return ApiResponse.ok(bookmarkService.create(req));
        } catch (IllegalArgumentException e) {
            // URL 格式无效或书签已存在，返回可读错误信息给前端展示
            return ApiResponse.error("BOOKMARK_CREATE_FAILED", e.getMessage());
        } catch (Exception e) {
            log.error("书签保存失败", e);
            return ApiResponse.error("BOOKMARK_CREATE_FAILED", "书签保存失败");
        }
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

    // ==================== 书签 AI 与导入 ====================

    /** AI 分析单个书签 URL：归一化、去重检测、标题/描述/标签/分组建议（不写数据） */
    @PostMapping("/bookmarks/analyze")
    public ApiResponse<BookmarkAnalyzeResponse> analyzeBookmark(@Valid @RequestBody BookmarkAnalyzeRequest req) {
        try {
            return ApiResponse.ok(bookmarkAiService.analyze(req));
        } catch (IllegalArgumentException e) {
            return ApiResponse.error("ANALYZE_FAILED", e.getMessage());
        }
    }

    /** 批量导入预览：分类为 create/skip/conflict/invalid，不写入数据 */
    @PostMapping("/bookmarks/import/preview")
    public ApiResponse<BookmarkImportPreviewResponse> previewImport(@Valid @RequestBody BookmarkImportPreviewRequest req) {
        try {
            return ApiResponse.ok(bookmarkImportService.preview(req));
        } catch (Exception e) {
            log.error("导入预览失败", e);
            return ApiResponse.error("IMPORT_PREVIEW_FAILED", "导入预览失败");
        }
    }

    /** 根据用户决策提交批量导入，执行创建/更新/跳过 */
    @PostMapping("/bookmarks/import/commit")
    public ApiResponse<BookmarkImportCommitResponse> commitImport(@Valid @RequestBody BookmarkImportCommitRequest req) {
        try {
            return ApiResponse.ok(bookmarkImportService.commit(req));
        } catch (Exception e) {
            log.error("导入提交失败", e);
            return ApiResponse.error("IMPORT_COMMIT_FAILED", "导入提交失败: " + e.getMessage());
        }
    }

    // ==================== 书签标签工作台 ====================

    /** 获取所有标签及其计数 */
    @GetMapping("/bookmarks/tags")
    public ApiResponse<BookmarkTagSummaryResponse> listTags() {
        return ApiResponse.ok(bookmarkService.getTagSummary());
    }

    /** AI 建议标签合并/清理（advisory，不自动合并） */
    @PostMapping("/bookmarks/tags/suggest")
    public ApiResponse<BookmarkTagSummaryResponse> suggestTags() {
        try {
            return ApiResponse.ok(bookmarkService.suggestTagCleanup());
        } catch (Exception e) {
            log.warn("标签建议失败: {}", e.getMessage());
            return ApiResponse.error("TAG_SUGGEST_FAILED", "标签建议功能暂不可用");
        }
    }

    // ==================== 书签智能分组 ====================

    /** 列出所有智能分组 */
    @GetMapping("/bookmarks/groups")
    public ApiResponse<List<BookmarkSmartGroupResponse>> listSmartGroups() {
        List<BookmarkSmartGroup> groups = bookmarkSmartGroupService.listGroups();
        List<BookmarkSmartGroupResponse> resp = groups.stream()
                .map(g -> BookmarkSmartGroupResponse.from(g, (int) bookmarkSmartGroupService.getBookmarkCount(g.getId())))
                .collect(Collectors.toList());
        return ApiResponse.ok(resp);
    }

    /** 创建智能分组 */
    @PostMapping("/bookmarks/groups")
    public ApiResponse<BookmarkSmartGroupResponse> createSmartGroup(@Valid @RequestBody BookmarkSmartGroupRequest req) {
        BookmarkSmartGroup g = bookmarkSmartGroupService.createGroup(
                req.getName(), req.getDescription(), req.getMatchMode(),
                req.getMatchValue(), req.getOrderIndex());
        return ApiResponse.ok(BookmarkSmartGroupResponse.from(g, 0));
    }

    /** 更新智能分组 */
    @PatchMapping("/bookmarks/groups/{id}")
    public ApiResponse<BookmarkSmartGroupResponse> updateSmartGroup(
            @PathVariable String id, @RequestBody BookmarkSmartGroupRequest req) {
        BookmarkSmartGroup g = bookmarkSmartGroupService.updateGroup(
                id, req.getName(), req.getDescription(), req.getMatchMode(),
                req.getMatchValue(), req.getOrderIndex(), req.getEnabled());
        return ApiResponse.ok(BookmarkSmartGroupResponse.from(g, (int) bookmarkSmartGroupService.getBookmarkCount(id)));
    }

    /** 删除智能分组及其所有分配 */
    @DeleteMapping("/bookmarks/groups/{id}")
    public ApiResponse<Void> deleteSmartGroup(@PathVariable String id) {
        bookmarkSmartGroupService.deleteGroup(id);
        return ApiResponse.ok();
    }

    /** 预览分组匹配结果（不写入数据） */
    @PostMapping("/bookmarks/groups/preview")
    public ApiResponse<BookmarkGroupPreviewResponse> previewGroups(@Valid @RequestBody BookmarkGroupPreviewRequest req) {
        try {
            return ApiResponse.ok(bookmarkSmartGroupService.previewGroups(req));
        } catch (Exception e) {
            log.error("分组预览失败", e);
            return ApiResponse.error("GROUP_PREVIEW_FAILED", "分组预览失败");
        }
    }

    /** 应用分组分配（持久化） */
    @PostMapping("/bookmarks/groups/apply")
    public ApiResponse<Void> applyGroups(@Valid @RequestBody BookmarkGroupApplyRequest req) {
        try {
            bookmarkSmartGroupService.applyGroupAssignments(req.getBookmarkIds(), req.getGroupIds());
            return ApiResponse.ok();
        } catch (Exception e) {
            log.error("分组应用失败", e);
            return ApiResponse.error("GROUP_APPLY_FAILED", "分组应用失败");
        }
    }

    // ==================== 文档（paperless-ngx） ====================

    /** 获取 paperless 网关状态：配置状态、可达性、入口链接 */
    @GetMapping("/documents/status")
    public ApiResponse<PaperlessGatewayStatusResponse> documentStatus() {
        return ApiResponse.ok(paperlessGatewayService.getStatus());
    }

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

    /** AI 分析笔记内容：建议标题/类型/标签/文件夹/清洗 Markdown/行动项（不写文件） */
    @PostMapping("/notes/analyze")
    public ApiResponse<NoteAnalyzeResponse> analyzeNote(@Valid @RequestBody NoteAnalyzeRequest req) {
        try {
            return ApiResponse.ok(noteAiService.analyze(req));
        } catch (Exception e) {
            log.warn("笔记 AI 分析失败: {}", e.getMessage());
            return ApiResponse.error("NOTE_ANALYZE_FAILED", "笔记分析暂不可用");
        }
    }

    /** 获取笔记标签索引列表，供前端 TagPicker 拉取可选标签 */
    @GetMapping("/notes/tags")
    public ApiResponse<List<NoteTagEntryResponse>> listNoteTags(@RequestParam String kind) {
        return ApiResponse.ok(noteTagIndexService.listTags(kind));
    }

    /** 按标题关键词 + 标签筛选笔记，AI 生成 Markdown 汇总（不写入文件） */
    @PostMapping("/notes/summarize")
    public ApiResponse<NoteSummarizeResponse> summarizeNotes(@Valid @RequestBody NoteSummarizeRequest req) {
        try {
            return ApiResponse.ok(noteSummaryService.summarize(req));
        } catch (Exception e) {
            log.error("笔记汇总失败", e);
            return ApiResponse.error("NOTE_SUMMARIZE_FAILED", "笔记汇总失败");
        }
    }

    /** AI 重新评估并归位指定类型下所有笔记的标签（手动触发，立即执行） */
    @PostMapping("/notes/reorganize-tags")
    public ApiResponse<NoteReorganizeResponse> reorganizeNoteTags(@Valid @RequestBody NoteReorganizeRequest req) {
        try {
            return ApiResponse.ok(noteTagReorganizeService.reorganize(req));
        } catch (Exception e) {
            log.error("笔记标签整理失败", e);
            return ApiResponse.error("NOTE_REORGANIZE_FAILED", "标签整理失败");
        }
    }
}
