package com.nexus.service;

import com.nexus.dto.request.NoteReorganizeRequest;
import com.nexus.dto.response.NoteTagSuggestionResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NoteTagReorganizeServiceTest {

    @Mock
    private InboxSettingsService inboxSettingsService;
    @Mock
    private NoteAiService noteAiService;
    @Mock
    private NoteTagIndexService noteTagIndexService;

    private NoteTagReorganizeService service;

    @TempDir
    Path tempDir;

    @BeforeEach
    void setUp() {
        service = new NoteTagReorganizeService(inboxSettingsService, noteAiService, noteTagIndexService);
    }

    @Test
    void reorganizeShouldReturnAiUnavailableWhenAiNotAvailable() {
        when(inboxSettingsService.isInboxAiAvailable()).thenReturn(false);

        NoteReorganizeRequest req = new NoteReorganizeRequest();
        req.setKind("quick_note");

        var resp = service.reorganize(req);

        assertThat(resp.isAiUnavailable()).isTrue();
        assertThat(resp.getScannedCount()).isEqualTo(0);
        assertThat(resp.getChanges()).isEmpty();
        verify(noteAiService, never()).suggestSingleTag(anyString(), anyString());
    }

    @Test
    void reorganizeShouldReturnEmptyChangesWhenTagUnchanged() throws IOException {
        when(inboxSettingsService.isInboxAiAvailable()).thenReturn(true);
        when(inboxSettingsService.get("inbox.obsidian.vault_path")).thenReturn(tempDir.toString());
        when(inboxSettingsService.getObsidianQuickNoteDir()).thenReturn("Inbox/Quick Note");

        Path noteRoot = tempDir.resolve("Inbox/Quick Note");
        Files.createDirectories(noteRoot);
        Path notePath = noteRoot.resolve("笔记.md");
        String content = "---\ntags:\n  - 技术\n---\n\n# 标题\n\n内容";
        Files.writeString(notePath, content, StandardCharsets.UTF_8);

        NoteTagSuggestionResponse suggestion = new NoteTagSuggestionResponse();
        suggestion.setName("技术");
        when(noteAiService.suggestSingleTag(anyString(), eq("quick_note"))).thenReturn(suggestion);

        NoteReorganizeRequest req = new NoteReorganizeRequest();
        req.setKind("quick_note");

        var resp = service.reorganize(req);

        assertThat(resp.getScannedCount()).isEqualTo(1);
        assertThat(resp.getChanges()).isEmpty();
        assertThat(Files.exists(notePath)).isTrue();
    }

    @Test
    void reorganizeShouldMoveFileAndUpdateFrontMatterWhenTagChanges() throws IOException {
        when(inboxSettingsService.isInboxAiAvailable()).thenReturn(true);
        when(inboxSettingsService.get("inbox.obsidian.vault_path")).thenReturn(tempDir.toString());
        when(inboxSettingsService.getObsidianQuickNoteDir()).thenReturn("Inbox/Quick Note");

        Path noteRoot = tempDir.resolve("Inbox/Quick Note");
        Path oldDir = noteRoot.resolve("旧标签");
        Files.createDirectories(oldDir);
        Path oldPath = oldDir.resolve("笔记.md");
        String content = "---\nsource: nexus\ntype: quick_note\ntags:\n  - 旧标签\n---\n\n# 标题\n\n内容";
        Files.writeString(oldPath, content, StandardCharsets.UTF_8);

        NoteTagSuggestionResponse suggestion = new NoteTagSuggestionResponse();
        suggestion.setName("新标签");
        suggestion.setDescription("新标签说明");
        when(noteAiService.suggestSingleTag(anyString(), eq("quick_note"))).thenReturn(suggestion);

        NoteReorganizeRequest req = new NoteReorganizeRequest();
        req.setKind("quick_note");

        var resp = service.reorganize(req);

        Path newPath = noteRoot.resolve("新标签").resolve("笔记.md");
        assertThat(Files.exists(oldPath)).isFalse();
        assertThat(Files.exists(newPath)).isTrue();

        String newContent = Files.readString(newPath, StandardCharsets.UTF_8);
        assertThat(newContent).contains("tags:\n  - 新标签");
        assertThat(newContent).doesNotContain("旧标签");
        assertThat(newContent).contains("source: nexus");
        assertThat(newContent).contains("type: quick_note");

        assertThat(resp.getChanges()).hasSize(1);
        var change = resp.getChanges().get(0);
        assertThat(change.getOldTag()).isEqualTo("旧标签");
        assertThat(change.getNewTag()).isEqualTo("新标签");
        assertThat(change.getOldPath()).isEqualTo("Inbox/Quick Note/旧标签/笔记.md");
        assertThat(change.getNewPath()).isEqualTo("Inbox/Quick Note/新标签/笔记.md");

        verify(noteTagIndexService).syncNewTags(eq("quick_note"), eq(Map.of("新标签", "新标签说明")));
    }

    @Test
    void reorganizeShouldAppendSequenceNumberWhenTargetFileNameConflicts() throws IOException {
        when(inboxSettingsService.isInboxAiAvailable()).thenReturn(true);
        when(inboxSettingsService.get("inbox.obsidian.vault_path")).thenReturn(tempDir.toString());
        when(inboxSettingsService.getObsidianQuickNoteDir()).thenReturn("Inbox/Quick Note");

        Path noteRoot = tempDir.resolve("Inbox/Quick Note");
        Path oldDir = noteRoot.resolve("旧标签");
        Path newDir = noteRoot.resolve("新标签");
        Files.createDirectories(oldDir);
        Files.createDirectories(newDir);

        // 目标目录下已存在同名文件
        Files.writeString(newDir.resolve("笔记.md"),
                "---\ntags:\n  - 新标签\n---\n\n# 已存在\n\n占位内容", StandardCharsets.UTF_8);

        Path oldPath = oldDir.resolve("笔记.md");
        String content = "---\ntags:\n  - 旧标签\n---\n\n# 标题\n\n内容";
        Files.writeString(oldPath, content, StandardCharsets.UTF_8);

        NoteTagSuggestionResponse suggestion = new NoteTagSuggestionResponse();
        suggestion.setName("新标签");
        when(noteAiService.suggestSingleTag(anyString(), eq("quick_note"))).thenReturn(suggestion);

        NoteReorganizeRequest req = new NoteReorganizeRequest();
        req.setKind("quick_note");

        var resp = service.reorganize(req);

        Path movedPath = newDir.resolve("笔记-2.md");
        assertThat(Files.exists(oldPath)).isFalse();
        assertThat(Files.exists(movedPath)).isTrue();
        assertThat(resp.getChanges()).hasSize(1);
        assertThat(resp.getChanges().get(0).getNewPath()).isEqualTo("Inbox/Quick Note/新标签/笔记-2.md");
    }
}
