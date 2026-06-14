package com.nexus.service;

import com.nexus.dto.request.NoteAnalyzeRequest;
import com.nexus.dto.response.NoteAnalyzeResponse;
import com.nexus.dto.response.NoteTagEntryResponse;
import com.nexus.dto.response.NoteTagSuggestionResponse;
import dev.langchain4j.model.chat.ChatLanguageModel;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NoteAiServiceTest {

    @Mock
    private LlmConfigService llmConfigService;
    @Mock
    private InboxSettingsService inboxSettingsService;
    @Mock
    private NoteTagIndexService noteTagIndexService;
    @Mock
    private ChatLanguageModel chatLanguageModel;

    @InjectMocks
    private NoteAiService noteAiService;

    @Test
    void analyzeShouldDegradeAndCapTagsToOneWhenAiNotAvailable() {
        when(inboxSettingsService.isInboxAiAvailable()).thenReturn(false);
        when(noteTagIndexService.listTags("quick_note")).thenReturn(List.of());

        NoteAnalyzeRequest req = new NoteAnalyzeRequest();
        req.setContent("今天学习了 Spring Boot");
        req.setKind("quick_note");
        req.setTags(List.of("a", "b"));

        NoteAnalyzeResponse resp = noteAiService.analyze(req);

        assertThat(resp.isAiAvailable()).isFalse();
        assertThat(resp.getSuggestedTags()).containsExactly("a");
        assertThat(resp.getNewTagDescriptions()).isEmpty();
    }

    @Test
    void analyzeShouldParseSuggestedTagsAndNewTagDescriptions() {
        when(inboxSettingsService.isInboxAiAvailable()).thenReturn(true);
        when(noteTagIndexService.listTags("quick_note")).thenReturn(List.of(
                tag("技术", "编程、工具链、技术学习相关内容")
        ));
        when(llmConfigService.resolveModel("inbox")).thenReturn(chatLanguageModel);
        when(chatLanguageModel.generate(anyString())).thenReturn("""
                ```json
                {
                  "title": "Spring Boot 学习笔记",
                  "kind": "quick_note",
                  "tags": ["技术", "学习", "新标签"],
                  "new_tags": [{"name": "学习", "description": "学习过程记录与心得"}],
                  "category": "技术",
                  "folder": "tech",
                  "cleaned_markdown": "# Spring Boot 学习笔记\\n\\n今天学习了 Spring Boot",
                  "action_items": [],
                  "confidence": "high"
                }
                ```
                """);

        NoteAnalyzeRequest req = new NoteAnalyzeRequest();
        req.setContent("今天学习了 Spring Boot");
        req.setKind("quick_note");
        req.setTags(List.of());

        NoteAnalyzeResponse resp = noteAiService.analyze(req);

        assertThat(resp.isAiAvailable()).isTrue();
        assertThat(resp.getSuggestedTags()).containsExactly("技术");
        assertThat(resp.getNewTagDescriptions()).containsEntry("学习", "学习过程记录与心得");
        assertThat(resp.getNewTagDescriptions()).doesNotContainKey("新标签");
        assertThat(resp.getNewTagDescriptions()).doesNotContainKey("技术");
    }

    @Test
    void analyzeShouldCapSuggestedTagsAtOne() {
        when(inboxSettingsService.isInboxAiAvailable()).thenReturn(true);
        when(noteTagIndexService.listTags("memo")).thenReturn(List.of());
        when(llmConfigService.resolveModel("inbox")).thenReturn(chatLanguageModel);
        when(chatLanguageModel.generate(anyString())).thenReturn("""
                {
                  "title": "备忘",
                  "kind": "memo",
                  "tags": ["a", "b", "c", "d", "e"],
                  "new_tags": [],
                  "confidence": "medium"
                }
                """);

        NoteAnalyzeRequest req = new NoteAnalyzeRequest();
        req.setContent("备忘内容");
        req.setKind("memo");
        req.setTags(List.of());

        NoteAnalyzeResponse resp = noteAiService.analyze(req);

        assertThat(resp.getSuggestedTags()).hasSize(1);
    }

    @Test
    void suggestSingleTagShouldReuseExistingTagWhenAiAvailable() {
        when(inboxSettingsService.isInboxAiAvailable()).thenReturn(true);
        when(noteTagIndexService.listTags("quick_note")).thenReturn(List.of(
                tag("技术", "编程、工具链、技术学习相关内容")
        ));
        when(llmConfigService.resolveModel("inbox")).thenReturn(chatLanguageModel);
        when(chatLanguageModel.generate(anyString())).thenReturn("""
                {
                  "tag": "技术",
                  "description": ""
                }
                """);

        NoteTagSuggestionResponse suggestion = noteAiService.suggestSingleTag("今天学习了 Spring Boot", "quick_note");

        assertThat(suggestion.getName()).isEqualTo("技术");
        assertThat(suggestion.getDescription()).isNull();
    }

    @Test
    void suggestSingleTagShouldReturnNewTagWithDescriptionWhenNotInIndex() {
        when(inboxSettingsService.isInboxAiAvailable()).thenReturn(true);
        when(noteTagIndexService.listTags("quick_note")).thenReturn(List.of());
        when(llmConfigService.resolveModel("inbox")).thenReturn(chatLanguageModel);
        when(chatLanguageModel.generate(anyString())).thenReturn("""
                {
                  "tag": "生活",
                  "description": "日常生活相关"
                }
                """);

        NoteTagSuggestionResponse suggestion = noteAiService.suggestSingleTag("今天去超市买菜", "quick_note");

        assertThat(suggestion.getName()).isEqualTo("生活");
        assertThat(suggestion.getDescription()).isEqualTo("日常生活相关");
    }

    @Test
    void suggestSingleTagShouldFallbackToUncategorizedWhenAiNotAvailable() {
        when(inboxSettingsService.isInboxAiAvailable()).thenReturn(false);
        when(noteTagIndexService.listTags("quick_note")).thenReturn(List.of());

        NoteTagSuggestionResponse suggestion = noteAiService.suggestSingleTag("随便记一下", "quick_note");

        assertThat(suggestion.getName()).isEqualTo("未分类");
        assertThat(suggestion.getDescription()).isNotNull();
    }

    @Test
    void suggestSingleTagShouldNotDuplicateDescriptionWhenUncategorizedAlreadyIndexed() {
        when(inboxSettingsService.isInboxAiAvailable()).thenReturn(false);
        when(noteTagIndexService.listTags("quick_note")).thenReturn(List.of(
                tag("未分类", "已有人工说明")
        ));

        NoteTagSuggestionResponse suggestion = noteAiService.suggestSingleTag("随便记一下", "quick_note");

        assertThat(suggestion.getName()).isEqualTo("未分类");
        assertThat(suggestion.getDescription()).isNull();
    }

    private NoteTagEntryResponse tag(String name, String description) {
        NoteTagEntryResponse entry = new NoteTagEntryResponse();
        entry.setName(name);
        entry.setDescription(description);
        return entry;
    }
}
