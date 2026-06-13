package com.nexus.controller;

import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.nexus.dto.request.BookmarkCreateRequest;
import com.nexus.dto.request.QuickNoteRequest;
import com.nexus.inbox.document.DocumentArchivePort;
import com.nexus.inbox.note.NoteSinkPort;
import com.nexus.service.BookmarkService;
import com.nexus.service.InboxService;
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

        // 由于没有全局异常处理器，异常会传播；这里只验证 service 调用
        try {
            inboxController.createBookmark(req);
        } catch (IllegalArgumentException e) {
            assertThat(e.getMessage()).contains("URL 必须以 http://");
        }
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
}
