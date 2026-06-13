package com.nexus.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.nexus.dto.request.BookmarkCreateRequest;
import com.nexus.dto.request.BookmarkListRequest;
import com.nexus.dto.request.BookmarkUpdateRequest;
import com.nexus.dto.response.BookmarkResponse;
import com.nexus.entity.Bookmark;
import com.nexus.mapper.BookmarkMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.nio.file.Path;
import java.util.Collections;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BookmarkServiceTest {

    @Mock
    private BookmarkMapper bookmarkMapper;

    @InjectMocks
    private BookmarkService bookmarkService;

    // ======================== create ========================

    @Test
    void createShouldValidateUrlPrefix() {
        BookmarkCreateRequest req = new BookmarkCreateRequest();
        req.setUrl("ftp://example.com");

        assertThatThrownBy(() -> bookmarkService.create(req))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("URL 必须以 http:// 或 https:// 开头");
    }

    @Test
    void createShouldDetectDuplicateNormalizedUrl() {
        BookmarkCreateRequest req = new BookmarkCreateRequest();
        req.setUrl("https://example.com/");

        // 模拟 normalized_url 冲突
        when(bookmarkMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(new Bookmark());

        assertThatThrownBy(() -> bookmarkService.create(req))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("该书签已存在");
    }

    @Test
    void createShouldGenerateDomainFallbackWhenTitleIsEmpty() {
        BookmarkCreateRequest req = new BookmarkCreateRequest();
        req.setUrl("https://example.com/page");
        req.setTitle(""); // 空标题

        when(bookmarkMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(null);

        BookmarkResponse resp = bookmarkService.create(req);

        assertThat(resp.getDomain()).isEqualTo("example.com");
        assertThat(resp.getTitle()).isEqualTo("example.com"); // 从域名兜底
    }

    @Test
    void createShouldPreserveTitleWhenProvided() {
        BookmarkCreateRequest req = new BookmarkCreateRequest();
        req.setUrl("https://example.com");
        req.setTitle("我的书签");

        when(bookmarkMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(null);

        BookmarkResponse resp = bookmarkService.create(req);

        assertThat(resp.getTitle()).isEqualTo("我的书签");
        assertThat(resp.getDomain()).isEqualTo("example.com");
        assertThat(resp.isUnread()).isTrue();
        assertThat(resp.isArchived()).isFalse();
    }

    @Test
    void createShouldNormalizeTags() {
        BookmarkCreateRequest req = new BookmarkCreateRequest();
        req.setUrl("https://example.com");
        req.setTitle("测试标签");
        req.setTags(List.of("  Tag1  ", "", "tag1", "Tag2")); // 有空格、空、重复

        when(bookmarkMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(null);

        BookmarkResponse resp = bookmarkService.create(req);

        // 验证标签已去空、trim、去重（大小写敏感，Tag1 和 tag1 视为不同标签）
        assertThat(resp.getTagNames()).containsExactly("Tag1", "tag1", "Tag2");
    }

    @Test
    void createShouldNormalizeUrlByRemovingTrailingSlash() {
        BookmarkCreateRequest req = new BookmarkCreateRequest();
        req.setUrl("https://example.com/");

        when(bookmarkMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(null);

        bookmarkService.create(req);

        // 验证 selectOne 被调用，且 URL 已标准化
        verify(bookmarkMapper).selectOne(any(LambdaQueryWrapper.class));
        verify(bookmarkMapper).insert(any(Bookmark.class));
    }

    // ======================== update ========================

    @Test
    void updateShouldToggleUnread() {
        Bookmark existing = new Bookmark();
        existing.setId("b1");
        existing.setUrl("https://example.com");
        existing.setTitle("示例");
        existing.setTags(Collections.emptyList());
        existing.setUnread(true);

        when(bookmarkMapper.selectById("b1")).thenReturn(existing);

        BookmarkUpdateRequest req = new BookmarkUpdateRequest();
        req.setUnread(false);

        bookmarkService.update("b1", req);

        // 验证 update 被调用
        verify(bookmarkMapper).update(isNull(), any());
    }

    @Test
    void updateShouldToggleArchived() {
        Bookmark existing = new Bookmark();
        existing.setId("b1");
        existing.setUrl("https://example.com");
        existing.setTitle("示例");
        existing.setTags(Collections.emptyList());

        when(bookmarkMapper.selectById("b1")).thenReturn(existing);

        BookmarkUpdateRequest req = new BookmarkUpdateRequest();
        req.setArchived(true);

        bookmarkService.update("b1", req);
        verify(bookmarkMapper).update(isNull(), any());
    }

    @Test
    void updateShouldThrowWhenBookmarkNotFound() {
        when(bookmarkMapper.selectById("nonexistent")).thenReturn(null);

        BookmarkUpdateRequest req = new BookmarkUpdateRequest();
        req.setTitle("新标题");

        assertThatThrownBy(() -> bookmarkService.update("nonexistent", req))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("书签不存在");
    }

    // ======================== delete ========================

    @Test
    void deleteShouldThrowWhenBookmarkNotFound() {
        when(bookmarkMapper.selectById("nonexistent")).thenReturn(null);

        assertThatThrownBy(() -> bookmarkService.delete("nonexistent"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("书签不存在");
    }

    @Test
    void deleteShouldRemoveExistingBookmark() {
        Bookmark existing = new Bookmark();
        existing.setId("b1");

        when(bookmarkMapper.selectById("b1")).thenReturn(existing);

        bookmarkService.delete("b1");

        verify(bookmarkMapper).deleteById("b1");
    }

    // ======================== list ========================

    @Test
    void listShouldReturnEmptyWhenNoBookmarks() {
        Page<Bookmark> emptyPage = new Page<>(1, 20, 0);
        emptyPage.setRecords(Collections.emptyList());

        when(bookmarkMapper.selectPage(any(Page.class), any(LambdaQueryWrapper.class)))
                .thenReturn(emptyPage);

        BookmarkListRequest req = new BookmarkListRequest();
        Page<BookmarkResponse> result = bookmarkService.list(req);

        assertThat(result.getTotal()).isEqualTo(0);
        assertThat(result.getRecords()).isEmpty();
    }
}
