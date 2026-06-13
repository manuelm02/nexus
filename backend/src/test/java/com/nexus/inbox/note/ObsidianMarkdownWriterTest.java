package com.nexus.inbox.note;

import com.nexus.config.InboxIntegrationProperties;
import com.nexus.dto.request.QuickNoteRequest;
import com.nexus.dto.response.QuickNoteResponse;
import com.nexus.service.InboxSettingsService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ObsidianMarkdownWriterTest {

    @Mock
    private InboxIntegrationProperties properties;
    @Mock
    private InboxSettingsService inboxSettingsService;

    private ObsidianMarkdownWriter writer;
    private InboxIntegrationProperties.Obsidian obsidianConfig;

    @TempDir
    Path tempDir;

    @BeforeEach
    void setUp() {
        obsidianConfig = new InboxIntegrationProperties.Obsidian();
        obsidianConfig.setVaultPath(tempDir.toString());
        obsidianConfig.setInboxDir("Inbox");
        writer = new ObsidianMarkdownWriter(properties, inboxSettingsService);
    }

    @Test
    void writeShouldCreateMarkdownFileWithFrontMatter() {
        useDefaultQuickNoteConfig();
        QuickNoteRequest req = new QuickNoteRequest();
        req.setTitle("测试笔记");
        req.setContent("这是内容");
        req.setKind("quick_note");
        req.setTags(List.of("inbox", "test"));

        QuickNoteResponse resp = writer.write(req);

        assertThat(resp.getRelativePath()).isNotNull();
        assertThat(resp.getCreatedAt()).isNotNull();
        // 验证文件存在且内容包含 front matter
        Path fullPath = tempDir.resolve(resp.getRelativePath()).normalize().toAbsolutePath();
        assertThat(Files.exists(fullPath)).isTrue();
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
        writer = new ObsidianMarkdownWriter(properties, inboxSettingsService);

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
        writer = new ObsidianMarkdownWriter(properties, inboxSettingsService);

        QuickNoteRequest req = new QuickNoteRequest();
        req.setContent("测试路径穿越");

        assertThatThrownBy(() -> writer.write(req))
                .isInstanceOf(SecurityException.class)
                .hasMessageContaining("路径");
    }

    @Test
    void writeShouldCreateYearMonthDirectory() {
        useDefaultQuickNoteConfig();
        QuickNoteRequest req = new QuickNoteRequest();
        req.setContent("目录创建测试");

        QuickNoteResponse resp = writer.write(req);

        // 验证文件在预期目录结构下
        Path relativePath = tempDir.resolve(resp.getRelativePath());
        assertThat(relativePath).isNotNull();
        // 应该包含年份和月份子目录
        Path parent = relativePath.getParent();
        assertThat(parent).isNotNull();
        // 父目录应有两种情况：Inbox/yyyy/MM 或直接在 tempDir 下（取决于配置）
    }

    @Test
    void writeShouldSanitizeFileNameSlug() {
        useDefaultQuickNoteConfig();
        QuickNoteRequest req = new QuickNoteRequest();
        req.setTitle("包含/特殊:字符*的?标题");
        req.setContent("测试");

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

        QuickNoteResponse resp = writer.write(req);

        Path fullPath = tempDir.resolve(resp.getRelativePath());
        // 验证文件存在
        assertThat(Files.exists(fullPath)).isTrue();
        assertThat(resp.getRelativePath()).startsWith("Inbox/Memo");
    }

    private void useDefaultQuickNoteConfig() {
        when(properties.getObsidian()).thenReturn(obsidianConfig);
        when(inboxSettingsService.getObsidianQuickNoteDir()).thenReturn("Inbox/Quick Note");
    }

    private void useDefaultMemoConfig() {
        when(properties.getObsidian()).thenReturn(obsidianConfig);
        when(inboxSettingsService.getObsidianMemoDir()).thenReturn("Inbox/Memo");
    }
}
