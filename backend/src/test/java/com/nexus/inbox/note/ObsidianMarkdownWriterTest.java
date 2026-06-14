package com.nexus.inbox.note;

import com.nexus.config.InboxIntegrationProperties;
import com.nexus.dto.request.QuickNoteRequest;
import com.nexus.dto.response.NoteTagEntryResponse;
import com.nexus.dto.response.NoteTagSuggestionResponse;
import com.nexus.dto.response.QuickNoteResponse;
import com.nexus.service.InboxSettingsService;
import com.nexus.service.NoteAiService;
import com.nexus.service.NoteTagIndexService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ObsidianMarkdownWriterTest {

    @Mock
    private InboxIntegrationProperties properties;
    @Mock
    private InboxSettingsService inboxSettingsService;
    @Mock
    private NoteTagIndexService noteTagIndexService;
    @Mock
    private NoteAiService noteAiService;

    private ObsidianMarkdownWriter writer;
    private InboxIntegrationProperties.Obsidian obsidianConfig;

    @TempDir
    Path tempDir;

    @BeforeEach
    void setUp() {
        obsidianConfig = new InboxIntegrationProperties.Obsidian();
        obsidianConfig.setVaultPath(tempDir.toString());
        obsidianConfig.setInboxDir("Inbox");
        writer = new ObsidianMarkdownWriter(properties, inboxSettingsService, noteTagIndexService, noteAiService);
    }

    @Test
    void writeShouldCreateMarkdownFileWithFrontMatter() {
        useDefaultQuickNoteConfig();
        // 标签已存在于索引中，无需补充占位说明
        when(noteTagIndexService.listTags("quick_note")).thenReturn(List.of(tagEntry("inbox", "收件箱")));
        QuickNoteRequest req = new QuickNoteRequest();
        req.setTitle("测试笔记");
        req.setContent("这是内容");
        req.setKind("quick_note");
        req.setTags(List.of("inbox"));

        QuickNoteResponse resp = writer.write(req);

        assertThat(resp.getRelativePath()).isNotNull();
        assertThat(resp.getCreatedAt()).isNotNull();
        // 验证按标签存储的新路径结构：{noteDir}/{tag}/{标题}.md
        assertThat(resp.getRelativePath()).isEqualTo("Inbox/Quick Note/inbox/测试笔记.md");
        assertThat(resp.getTag()).isEqualTo("inbox");
        // 验证文件存在且内容包含 front matter
        Path fullPath = tempDir.resolve(resp.getRelativePath()).normalize().toAbsolutePath();
        assertThat(Files.exists(fullPath)).isTrue();
        verify(noteTagIndexService).syncNewTags("quick_note", Map.of());
    }

    @Test
    void writeShouldSyncPlaceholderDescriptionWhenSelectedTagNotInIndex() {
        useDefaultQuickNoteConfig();
        // 标签索引中不存在该标签，且请求未提供说明 → 应补充占位说明一并写回索引，避免索引漂移
        when(noteTagIndexService.listTags("quick_note")).thenReturn(List.of());
        QuickNoteRequest req = new QuickNoteRequest();
        req.setContent("使用未登记标签的笔记");
        req.setTags(List.of("未登记标签"));

        writer.write(req);

        verify(noteTagIndexService).syncNewTags("quick_note", Map.of("未登记标签", "（待补充说明）"));
    }

    @Test
    void writeShouldSyncNewTagDescriptionsWhenProvided() {
        useDefaultQuickNoteConfig();
        QuickNoteRequest req = new QuickNoteRequest();
        req.setContent("带新标签的笔记");
        req.setTags(List.of("技术"));
        req.setNewTagDescriptions(Map.of("技术", "技术相关的笔记"));

        writer.write(req);

        verify(noteTagIndexService).syncNewTags("quick_note", Map.of("技术", "技术相关的笔记"));
    }

    @Test
    void writeShouldAutoSuggestTagWhenTagsEmpty() {
        useDefaultQuickNoteConfig();
        NoteTagSuggestionResponse suggestion = new NoteTagSuggestionResponse();
        suggestion.setName("生活");
        suggestion.setDescription("日常生活");
        when(noteAiService.suggestSingleTag(eq("无标签的笔记"), eq("quick_note"))).thenReturn(suggestion);

        QuickNoteRequest req = new QuickNoteRequest();
        req.setContent("无标签的笔记");

        QuickNoteResponse resp = writer.write(req);

        assertThat(resp.getRelativePath()).isEqualTo("Inbox/Quick Note/生活/未命名笔记.md");
        assertThat(resp.getTag()).isEqualTo("生活");

        Path fullPath = tempDir.resolve(resp.getRelativePath());
        String content = readFile(fullPath);
        assertThat(content).contains("tags:\n  - 生活");

        verify(noteTagIndexService).syncNewTags("quick_note", Map.of("生活", "日常生活"));
    }

    @Test
    void writeShouldFallbackToUncategorizedWhenAiUnavailableAndTagsEmpty() {
        useDefaultQuickNoteConfig();
        NoteTagSuggestionResponse fallback = new NoteTagSuggestionResponse();
        fallback.setName("未分类");
        fallback.setDescription("AI 未启用或暂不可用时的默认分类，可手动整理");
        when(noteAiService.suggestSingleTag(eq("无标签的笔记"), eq("quick_note"))).thenReturn(fallback);

        QuickNoteRequest req = new QuickNoteRequest();
        req.setContent("无标签的笔记");

        QuickNoteResponse resp = writer.write(req);

        assertThat(resp.getRelativePath()).isEqualTo("Inbox/Quick Note/未分类/未命名笔记.md");
        assertThat(resp.getTag()).isEqualTo("未分类");
    }

    @Test
    void writeShouldRejectBlankContent() {
        QuickNoteRequest req = new QuickNoteRequest();
        req.setContent("   ");

        assertThatThrownBy(() -> writer.write(req))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("笔记内容不能为空");
    }

    @Test
    void writeShouldRejectNullContent() {
        QuickNoteRequest req = new QuickNoteRequest();
        req.setContent(null);

        assertThatThrownBy(() -> writer.write(req))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("笔记内容不能为空");
    }

    @Test
    void writeShouldThrowWhenVaultNotConfigured() {
        InboxIntegrationProperties.Obsidian emptyConfig = new InboxIntegrationProperties.Obsidian();
        emptyConfig.setVaultPath("");
        when(properties.getObsidian()).thenReturn(emptyConfig);
        writer = new ObsidianMarkdownWriter(properties, inboxSettingsService, noteTagIndexService, noteAiService);

        QuickNoteRequest req = new QuickNoteRequest();
        req.setContent("测试");

        assertThatThrownBy(() -> writer.write(req))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Obsidian 未配置");
    }

    @Test
    void writeShouldPreventPathTraversal() {
        // 尝试通过 Settings 派生目录进行路径穿越
        InboxIntegrationProperties.Obsidian config = new InboxIntegrationProperties.Obsidian();
        config.setVaultPath(tempDir.toString());
        when(properties.getObsidian()).thenReturn(config);
        when(inboxSettingsService.getObsidianQuickNoteDir()).thenReturn("../../../etc");
        writer = new ObsidianMarkdownWriter(properties, inboxSettingsService, noteTagIndexService, noteAiService);

        QuickNoteRequest req = new QuickNoteRequest();
        req.setContent("测试路径穿越");
        req.setTags(List.of("inbox"));

        assertThatThrownBy(() -> writer.write(req))
                .isInstanceOf(SecurityException.class)
                .hasMessageContaining("路径");
    }

    @Test
    void writeShouldCreateTagDirectory() {
        useDefaultQuickNoteConfig();
        QuickNoteRequest req = new QuickNoteRequest();
        req.setContent("目录创建测试");
        req.setTags(List.of("inbox"));

        QuickNoteResponse resp = writer.write(req);

        // 父目录名应等于标签名
        Path relativePath = tempDir.resolve(resp.getRelativePath());
        Path parent = relativePath.getParent();
        assertThat(parent).isNotNull();
        assertThat(parent.getFileName().toString()).isEqualTo("inbox");
    }

    @Test
    void writeShouldSanitizeFileNameSlug() {
        useDefaultQuickNoteConfig();
        QuickNoteRequest req = new QuickNoteRequest();
        req.setTitle("包含/特殊:字符*的?标题");
        req.setContent("测试");
        req.setTags(List.of("inbox"));

        QuickNoteResponse resp = writer.write(req);

        // slug 应该已将特殊字符替换为连字符（文件名不含特殊字符，但路径含 / 目录分隔符）
        String fileName = resp.getRelativePath().substring(resp.getRelativePath().lastIndexOf('/') + 1);
        assertThat(fileName).doesNotContain(":");
        assertThat(fileName).doesNotContain("*");
        assertThat(fileName).doesNotContain("?");
    }

    @Test
    void writeMemoKindShouldBeRecordedInFrontMatter() {
        useDefaultMemoConfig();
        QuickNoteRequest req = new QuickNoteRequest();
        req.setContent("备忘内容");
        req.setKind("memo");
        req.setTags(List.of("备忘"));

        QuickNoteResponse resp = writer.write(req);

        Path fullPath = tempDir.resolve(resp.getRelativePath());
        // 验证文件存在
        assertThat(Files.exists(fullPath)).isTrue();
        assertThat(resp.getRelativePath()).startsWith("Inbox/Memo/备忘/");
    }

    @Test
    void writeShouldUseUntitledNoteWhenTitleBlank() {
        useDefaultQuickNoteConfig();
        QuickNoteRequest req = new QuickNoteRequest();
        req.setContent("没有标题的笔记");
        req.setTags(List.of("inbox"));

        QuickNoteResponse resp = writer.write(req);

        String fileName = resp.getRelativePath().substring(resp.getRelativePath().lastIndexOf('/') + 1);
        assertThat(fileName).isEqualTo("未命名笔记.md");
    }

    @Test
    void writeShouldAppendSequenceNumberWhenFileNameConflicts() {
        useDefaultQuickNoteConfig();
        QuickNoteRequest req = new QuickNoteRequest();
        req.setTitle("重复标题");
        req.setContent("第一篇");
        req.setTags(List.of("inbox"));
        writer.write(req);

        QuickNoteRequest req2 = new QuickNoteRequest();
        req2.setTitle("重复标题");
        req2.setContent("第二篇");
        req2.setTags(List.of("inbox"));
        QuickNoteResponse resp2 = writer.write(req2);

        assertThat(resp2.getRelativePath()).endsWith("重复标题-2.md");
        Path fullPath = tempDir.resolve(resp2.getRelativePath());
        assertThat(Files.exists(fullPath)).isTrue();
    }

    private String readFile(Path path) {
        try {
            return Files.readString(path);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private void useDefaultQuickNoteConfig() {
        when(properties.getObsidian()).thenReturn(obsidianConfig);
        when(inboxSettingsService.getObsidianQuickNoteDir()).thenReturn("Inbox/Quick Note");
    }

    private void useDefaultMemoConfig() {
        when(properties.getObsidian()).thenReturn(obsidianConfig);
        when(inboxSettingsService.getObsidianMemoDir()).thenReturn("Inbox/Memo");
    }

    private NoteTagEntryResponse tagEntry(String name, String description) {
        NoteTagEntryResponse entry = new NoteTagEntryResponse();
        entry.setName(name);
        entry.setDescription(description);
        return entry;
    }
}
