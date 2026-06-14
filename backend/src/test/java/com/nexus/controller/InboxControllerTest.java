package com.nexus.controller;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.nexus.dto.request.BookmarkCreateRequest;
import com.nexus.dto.request.QuickNoteRequest;
import com.nexus.inbox.document.DocumentArchivePort;
import com.nexus.inbox.note.NoteSinkPort;
import com.nexus.service.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.Collections;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class InboxControllerTest {

    @Mock
    private InboxService inboxService;
    @Mock
    private BookmarkService bookmarkService;
    @Mock
    private BookmarkAiService bookmarkAiService;
    @Mock
    private BookmarkImportService bookmarkImportService;
    @Mock
    private BookmarkSmartGroupService bookmarkSmartGroupService;
    @Mock
    private PaperlessGatewayService paperlessGatewayService;
    @Mock
    private NoteAiService noteAiService;
    @Mock
    private NoteSummaryService noteSummaryService;
    @Mock
    private NoteTagIndexService noteTagIndexService;
    @Mock
    private NoteTagReorganizeService noteTagReorganizeService;
    @Mock
    private NoteSinkPort noteSinkPort;
    @Mock
    private DocumentArchivePort documentArchivePort;

    @InjectMocks
    private InboxController inboxController;

    // ======================== 书签 ========================

    @Test
    void listBookmarksShouldReturnPage() {
        when(bookmarkService.list(any())).thenReturn(new Page<>(1, 20, 0));

        var resp = inboxController.listBookmarks(new com.nexus.dto.request.BookmarkListRequest());

        assertThat(resp.isSuccess()).isTrue();
        assertThat(resp.getData()).isNotNull();
    }

    @Test
    void createBookmarkShouldReturnBookmarkResponse() {
        var resp = new com.nexus.dto.response.BookmarkResponse();
        resp.setId("b1");
        resp.setUrl("https://example.com");
        resp.setTitle("测试");
        resp.setDomain("example.com");
        when(bookmarkService.create(any())).thenReturn(resp);

        var req = new BookmarkCreateRequest();
        req.setUrl("https://example.com");
        var result = inboxController.createBookmark(req);

        assertThat(result.isSuccess()).isTrue();
        assertThat(result.getData().getUrl()).isEqualTo("https://example.com");
    }

    @Test
    void createBookmarkWithInvalidUrlShouldReturnError() {
        when(bookmarkService.create(any()))
                .thenThrow(new IllegalArgumentException("URL 必须以 http:// 或 https:// 开头"));

        var req = new BookmarkCreateRequest();
        req.setUrl("ftp://invalid.com");

        var resp = inboxController.createBookmark(req);

        assertThat(resp.isSuccess()).isFalse();
        assertThat(resp.getErrorCode()).isEqualTo("BOOKMARK_CREATE_FAILED");
        assertThat(resp.getMessage()).contains("URL 必须以 http://");
    }

    @Test
    void createBookmarkWithDuplicateUrlShouldReturnError() {
        when(bookmarkService.create(any()))
                .thenThrow(new IllegalArgumentException("该书签已存在"));

        var req = new BookmarkCreateRequest();
        req.setUrl("https://example.com");

        var resp = inboxController.createBookmark(req);

        assertThat(resp.isSuccess()).isFalse();
        assertThat(resp.getErrorCode()).isEqualTo("BOOKMARK_CREATE_FAILED");
        assertThat(resp.getMessage()).isEqualTo("该书签已存在");
    }

    // ======================== 文档 ========================

    @Test
    void listDocumentsShouldReturnPaperlessNotConfigured() {
        when(documentArchivePort.list(anyInt(), anyInt()))
                .thenThrow(new IllegalStateException("paperless-ngx 未配置"));

        var resp = inboxController.listDocuments(1, 20);

        assertThat(resp.isSuccess()).isFalse();
        assertThat(resp.getErrorCode()).isEqualTo("PAPERLESS_NOT_CONFIGURED");
    }

    @Test
    void listDocumentsShouldReturnOkWhenConfigured() {
        when(documentArchivePort.list(1, 20)).thenReturn(Collections.emptyList());

        var resp = inboxController.listDocuments(1, 20);

        assertThat(resp.isSuccess()).isTrue();
        assertThat(resp.getData()).isEmpty();
    }

    // ======================== 笔记 ========================

    @Test
    void createNoteShouldReturnObsidianNotConfigured() {
        when(noteSinkPort.write(any()))
                .thenThrow(new IllegalStateException("Obsidian 未配置"));

        var req = new QuickNoteRequest();
        req.setContent("测试笔记");

        var resp = inboxController.createNote(req);

        assertThat(resp.isSuccess()).isFalse();
        assertThat(resp.getErrorCode()).isEqualTo("OBSIDIAN_NOT_CONFIGURED");
    }

    @Test
    void createNoteShouldRequireContent() {
        when(noteSinkPort.write(any()))
                .thenThrow(new IllegalArgumentException("笔记内容不能为空"));

        var req = new QuickNoteRequest();
        req.setContent("");

        var resp = inboxController.createNote(req);

        assertThat(resp.isSuccess()).isFalse();
        assertThat(resp.getErrorCode()).isEqualTo("NOTE_CONTENT_REQUIRED");
    }

    // ======================== 笔记标签索引 ========================

    @Test
    void listNoteTagsShouldReturnTagEntries() {
        var tag = new com.nexus.dto.response.NoteTagEntryResponse();
        tag.setName("技术");
        tag.setDescription("编程、工具链、技术学习相关内容");
        when(noteTagIndexService.listTags("quick_note")).thenReturn(java.util.List.of(tag));

        var resp = inboxController.listNoteTags("quick_note");

        assertThat(resp.isSuccess()).isTrue();
        assertThat(resp.getData()).hasSize(1);
        assertThat(resp.getData().get(0).getName()).isEqualTo("技术");
    }

    // ======================== 笔记汇总 ========================

    @Test
    void summarizeNotesShouldReturnEmptyResultWhenNoFilter() {
        var serviceResp = new com.nexus.dto.response.NoteSummarizeResponse();
        serviceResp.setMatchedCount(0);
        serviceResp.setMarkdown(null);
        when(noteSummaryService.summarize(any())).thenReturn(serviceResp);

        var req = new com.nexus.dto.request.NoteSummarizeRequest();
        req.setKind("quick_note");

        var resp = inboxController.summarizeNotes(req);

        assertThat(resp.isSuccess()).isTrue();
        assertThat(resp.getData().getMatchedCount()).isEqualTo(0);
        assertThat(resp.getData().getMarkdown()).isNull();
    }

    @Test
    void summarizeNotesShouldReturnErrorWhenServiceThrows() {
        when(noteSummaryService.summarize(any())).thenThrow(new RuntimeException("扫描失败"));

        var req = new com.nexus.dto.request.NoteSummarizeRequest();
        req.setKind("memo");
        req.setTitleQuery("关键词");

        var resp = inboxController.summarizeNotes(req);

        assertThat(resp.isSuccess()).isFalse();
        assertThat(resp.getErrorCode()).isEqualTo("NOTE_SUMMARIZE_FAILED");
    }

    // ======================== 笔记标签整理 ========================

    @Test
    void reorganizeNoteTagsShouldReturnResult() {
        var change = new com.nexus.dto.response.NoteReorganizeResponse.NoteReorganizeChange();
        change.setTitle("测试笔记");
        change.setOldTag("旧标签");
        change.setNewTag("新标签");
        change.setOldPath("Inbox/Quick Note/旧标签/测试笔记.md");
        change.setNewPath("Inbox/Quick Note/新标签/测试笔记.md");

        var serviceResp = new com.nexus.dto.response.NoteReorganizeResponse();
        serviceResp.setScannedCount(2);
        serviceResp.setChanges(java.util.List.of(change));
        serviceResp.setAiUnavailable(false);
        when(noteTagReorganizeService.reorganize(any())).thenReturn(serviceResp);

        var req = new com.nexus.dto.request.NoteReorganizeRequest();
        req.setKind("quick_note");

        var resp = inboxController.reorganizeNoteTags(req);

        assertThat(resp.isSuccess()).isTrue();
        assertThat(resp.getData().getScannedCount()).isEqualTo(2);
    }

    @Test
    void reorganizeNoteTagsShouldHandleException() {
        when(noteTagReorganizeService.reorganize(any())).thenThrow(new RuntimeException("整理失败"));

        var req = new com.nexus.dto.request.NoteReorganizeRequest();
        req.setKind("memo");

        var resp = inboxController.reorganizeNoteTags(req);

        assertThat(resp.isSuccess()).isFalse();
        assertThat(resp.getErrorCode()).isEqualTo("NOTE_REORGANIZE_FAILED");
    }
}
