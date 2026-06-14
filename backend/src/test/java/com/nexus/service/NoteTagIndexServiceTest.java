package com.nexus.service;

import com.nexus.dto.response.NoteTagEntryResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.quality.Strictness;
import org.mockito.junit.jupiter.MockitoSettings;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
// 部分用例（如 vault 未配置）不会用到 getObsidianTagsDir() 的 stub，使用 LENIENT 避免误报 UnnecessaryStubbingException
@MockitoSettings(strictness = Strictness.LENIENT)
class NoteTagIndexServiceTest {

    @Mock
    private InboxSettingsService inboxSettingsService;

    private NoteTagIndexService service;

    @TempDir
    Path tempDir;

    @BeforeEach
    void setUp() {
        service = new NoteTagIndexService(inboxSettingsService);
        when(inboxSettingsService.get("inbox.obsidian.vault_path")).thenReturn(tempDir.toString());
        when(inboxSettingsService.getObsidianTagsDir()).thenReturn("Inbox/tags");
    }

    @Test
    void listTagsShouldReturnEmptyWhenIndexFileMissing() {
        List<NoteTagEntryResponse> tags = service.listTags("quick_note");

        assertThat(tags).isEmpty();
    }

    @Test
    void listTagsShouldParseValidLinesAndSkipInvalidOnes() throws IOException {
        Path indexDir = tempDir.resolve("Inbox/tags");
        Files.createDirectories(indexDir);
        Path indexFile = indexDir.resolve("quick-note-tags.md");
        Files.writeString(indexFile, """
                # Quick Note 标签索引

                - 技术: 编程、工具链、技术学习相关内容
                这是一行格式不规范的内容
                - 生活: 日常生活、习惯、健康相关
                """, StandardCharsets.UTF_8);

        List<NoteTagEntryResponse> tags = service.listTags("quick_note");

        assertThat(tags).hasSize(2);
        assertThat(tags.get(0).getName()).isEqualTo("技术");
        assertThat(tags.get(0).getDescription()).isEqualTo("编程、工具链、技术学习相关内容");
        assertThat(tags.get(1).getName()).isEqualTo("生活");
    }

    @Test
    void syncNewTagsShouldAppendOnlyNewEntriesAndSkipExisting() throws IOException {
        Path indexDir = tempDir.resolve("Inbox/tags");
        Files.createDirectories(indexDir);
        Path indexFile = indexDir.resolve("memo-tags.md");
        Files.writeString(indexFile, "# Memo 标签索引\n\n- 想法: 待孵化的点子和灵感\n", StandardCharsets.UTF_8);

        service.syncNewTags("memo", Map.of(
                "想法", "这个描述不会覆盖已有的",
                "工作", "工作相关的备忘"
        ));

        List<NoteTagEntryResponse> tags = service.listTags("memo");
        assertThat(tags).hasSize(2);
        assertThat(tags.get(0).getDescription()).isEqualTo("待孵化的点子和灵感");
        assertThat(tags.get(1).getName()).isEqualTo("工作");
        assertThat(tags.get(1).getDescription()).isEqualTo("工作相关的备忘");
    }

    @Test
    void syncNewTagsShouldCreateIndexFileWhenMissing() {
        service.syncNewTags("quick_note", Map.of("技术", "编程相关"));

        List<NoteTagEntryResponse> tags = service.listTags("quick_note");
        assertThat(tags).hasSize(1);
        assertThat(tags.get(0).getName()).isEqualTo("技术");
        assertThat(tags.get(0).getDescription()).isEqualTo("编程相关");
    }

    @Test
    void syncNewTagsShouldUsePlaceholderWhenDescriptionBlank() {
        service.syncNewTags("quick_note", Map.of("新标签", ""));

        List<NoteTagEntryResponse> tags = service.listTags("quick_note");
        assertThat(tags).hasSize(1);
        assertThat(tags.get(0).getDescription()).isEqualTo("（待补充说明）");
    }

    @Test
    void syncNewTagsShouldDoNothingWhenVaultNotConfigured() {
        when(inboxSettingsService.get("inbox.obsidian.vault_path")).thenReturn(null);

        service.syncNewTags("quick_note", Map.of("技术", "编程相关"));

        // 不抛异常即可；listTags 同样因 vault 未配置返回空
        assertThat(service.listTags("quick_note")).isEmpty();
    }
}
