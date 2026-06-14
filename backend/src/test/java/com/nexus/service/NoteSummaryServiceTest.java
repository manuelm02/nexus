package com.nexus.service;

import com.nexus.dto.request.NoteSummarizeRequest;
import com.nexus.dto.response.NoteSummarizeResponse;
import dev.langchain4j.model.chat.ChatLanguageModel;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class NoteSummaryServiceTest {

    @Mock
    private LlmConfigService llmConfigService;
    @Mock
    private InboxSettingsService inboxSettingsService;
    @Mock
    private ChatLanguageModel chatLanguageModel;

    private NoteSummaryService service;

    @TempDir
    Path tempDir;

    @BeforeEach
    void setUp() throws IOException {
        service = new NoteSummaryService(llmConfigService, inboxSettingsService, new com.fasterxml.jackson.databind.ObjectMapper());

        Path quickNoteDir = tempDir.resolve("Inbox/Quick Note/2026/06");
        Files.createDirectories(quickNoteDir);

        Files.writeString(quickNoteDir.resolve("note1.md"), """
                ---
                source: nexus
                type: quick_note
                created: 2026-06-01T10:00:00+08:00
                tags:
                  - 技术
                  - 学习
                ---

                # Spring Boot 学习笔记

                今天学习了依赖注入。
                """, StandardCharsets.UTF_8);

        Files.writeString(quickNoteDir.resolve("note2.md"), """
                ---
                source: nexus
                type: quick_note
                created: 2026-06-02T10:00:00+08:00
                tags:
                  - 生活
                ---

                # 周末计划

                打算去爬山。
                """, StandardCharsets.UTF_8);

        lenient().when(inboxSettingsService.get("inbox.obsidian.vault_path")).thenReturn(tempDir.toString());
        lenient().when(inboxSettingsService.getObsidianQuickNoteDir()).thenReturn("Inbox/Quick Note");
    }

    @Test
    void summarizeShouldReturnEmptyWhenNoFilterProvided() {
        NoteSummarizeRequest req = new NoteSummarizeRequest();
        req.setKind("quick_note");

        NoteSummarizeResponse resp = service.summarize(req);

        assertThat(resp.getMatchedCount()).isEqualTo(0);
        assertThat(resp.getMarkdown()).isNull();
    }

    @Test
    void summarizeShouldMatchByTitleQuery() {
        when(inboxSettingsService.isInboxAiAvailable()).thenReturn(false);

        NoteSummarizeRequest req = new NoteSummarizeRequest();
        req.setKind("quick_note");
        req.setTitleQuery("Spring");

        NoteSummarizeResponse resp = service.summarize(req);

        assertThat(resp.getMatchedCount()).isEqualTo(1);
        assertThat(resp.getMarkdown()).contains("Spring Boot 学习笔记");
        assertThat(resp.getMarkdown()).contains("依赖注入");
    }

    @Test
    void summarizeShouldMatchByTagIntersection() {
        when(inboxSettingsService.isInboxAiAvailable()).thenReturn(false);

        NoteSummarizeRequest req = new NoteSummarizeRequest();
        req.setKind("quick_note");
        req.setTags(List.of("生活"));

        NoteSummarizeResponse resp = service.summarize(req);

        assertThat(resp.getMatchedCount()).isEqualTo(1);
        assertThat(resp.getMarkdown()).contains("周末计划");
    }

    @Test
    void summarizeShouldReturnZeroWhenNothingMatches() {
        NoteSummarizeRequest req = new NoteSummarizeRequest();
        req.setKind("quick_note");
        req.setTitleQuery("不存在的关键词");

        NoteSummarizeResponse resp = service.summarize(req);

        assertThat(resp.getMatchedCount()).isEqualTo(0);
        assertThat(resp.getMarkdown()).isNull();
    }

    @Test
    void summarizeShouldUseLlmWhenAvailable() {
        when(inboxSettingsService.isInboxAiAvailable()).thenReturn(true);
        when(llmConfigService.resolveModel("inbox")).thenReturn(chatLanguageModel);
        when(chatLanguageModel.generate(anyString())).thenReturn("""
                ```json
                {"markdown": "# 技术笔记汇总\\n\\n- 依赖注入相关内容"}
                ```
                """);

        NoteSummarizeRequest req = new NoteSummarizeRequest();
        req.setKind("quick_note");
        req.setTags(List.of("技术"));

        NoteSummarizeResponse resp = service.summarize(req);

        assertThat(resp.getMatchedCount()).isEqualTo(1);
        assertThat(resp.getMarkdown()).isEqualTo("# 技术笔记汇总\n\n- 依赖注入相关内容");
    }
}
