package com.nexus.service;

import com.nexus.dto.request.BookmarkImportCommitRequest;
import com.nexus.dto.request.BookmarkImportPreviewRequest;
import com.nexus.dto.response.BookmarkAnalyzeResponse;
import com.nexus.dto.response.BookmarkResponse;
import com.nexus.entity.BookmarkSmartGroup;
import com.nexus.entity.BookmarkSmartGroupAssignment;
import com.nexus.mapper.BookmarkMapper;
import com.nexus.mapper.BookmarkSmartGroupAssignmentMapper;
import com.nexus.mapper.BookmarkSmartGroupMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BookmarkImportServiceTest {

    @Mock
    private BookmarkService bookmarkService;
    @Mock
    private BookmarkSmartGroupService smartGroupService;
    @Mock
    private BookmarkAiService bookmarkAiService;
    @Mock
    private BookmarkMapper bookmarkMapper;
    @Mock
    private BookmarkSmartGroupMapper groupMapper;
    @Mock
    private BookmarkSmartGroupAssignmentMapper assignmentMapper;

    private BookmarkImportService service;

    @BeforeEach
    void setUp() {
        service = new BookmarkImportService(
                bookmarkService,
                new BookmarkUrlNormalizer(),
                smartGroupService,
                bookmarkAiService,
                bookmarkMapper,
                groupMapper,
                assignmentMapper);
        lenient().when(bookmarkMapper.selectOne(any())).thenReturn(null);
        lenient().when(groupMapper.selectList(any())).thenReturn(List.of());
        lenient().when(bookmarkMapper.selectBatchIds(any())).thenReturn(List.of());
        lenient().when(bookmarkAiService.analyze(any())).thenReturn(aiUnavailable());
    }

    @Test
    void commitShouldCreateOnlyCompactSmartGroupsFromFrequentImportedTags() {
        var previewReq = new BookmarkImportPreviewRequest();
        previewReq.setItems(List.of(
                item("https://a.example.com/1", "A"),
                item("https://b.example.com/2", "B"),
                item("https://c.example.com/3", "C"),
                item("https://d.example.com/4", "D")
        ));
        var preview = service.preview(previewReq);

        when(bookmarkService.create(any())).thenAnswer(invocation -> {
            var req = invocation.getArgument(0, com.nexus.dto.request.BookmarkCreateRequest.class);
            BookmarkResponse response = new BookmarkResponse();
            response.setId("bookmark-" + req.getTitle());
            response.setUrl(req.getUrl());
            response.setTitle(req.getTitle());
            response.setTagNames(req.getTags());
            return response;
        });

        var commitReq = new BookmarkImportCommitRequest();
        commitReq.setImportSessionId(preview.getImportSessionId());
        commitReq.setDecisions(List.of(
                decision(0, "A", List.of("技术", "博客", "个人网站")),
                decision(1, "B", List.of("技术", "产品说明", "耳机")),
                decision(2, "C", List.of("技术", "用户手册", "耳机")),
                decision(3, "D", List.of("生活", "旅行"))
        ));

        service.commit(commitReq);

        ArgumentCaptor<BookmarkSmartGroup> groupCaptor = ArgumentCaptor.forClass(BookmarkSmartGroup.class);
        verify(groupMapper, org.mockito.Mockito.times(2)).insert(groupCaptor.capture());
        assertThat(groupCaptor.getAllValues())
                .extracting(BookmarkSmartGroup::getName)
                .containsExactly("技术", "耳机");
        assertThat(groupCaptor.getAllValues())
                .extracting(BookmarkSmartGroup::getMatchMode)
                .containsOnly("any_tag");

        ArgumentCaptor<BookmarkSmartGroupAssignment> assignmentCaptor =
                ArgumentCaptor.forClass(BookmarkSmartGroupAssignment.class);
        verify(assignmentMapper, org.mockito.Mockito.times(5)).insert(assignmentCaptor.capture());
        assertThat(assignmentCaptor.getAllValues())
                .extracting(BookmarkSmartGroupAssignment::getAssignSource)
                .containsOnly("ai_import");
    }

    @Test
    void commitShouldCreateCompactGroupsFromAiSuggestedGroupNamesWhenTagsAreUnique() {
        when(bookmarkAiService.analyze(any())).thenAnswer(invocation -> {
            var req = invocation.getArgument(0, com.nexus.dto.request.BookmarkAnalyzeRequest.class);
            BookmarkAnalyzeResponse response = new BookmarkAnalyzeResponse();
            response.setAiAvailable(true);
            response.setSuggestedTitle(req.getTitle());
            response.setSuggestedDescription(req.getTitle() + " description");
            response.setSuggestedTags(List.of(req.getTitle() + "标签"));
            response.setSuggestedGroupName(switch (req.getTitle()) {
                case "A", "C" -> "AI 学习";
                case "B" -> "PT 资源";
                case "D" -> "硬件设备";
                default -> "其他";
            });
            return response;
        });
        var previewReq = new BookmarkImportPreviewRequest();
        previewReq.setItems(List.of(
                item("https://a.example.com/1", "A"),
                item("https://b.example.com/2", "B"),
                item("https://c.example.com/3", "C"),
                item("https://d.example.com/4", "D")
        ));
        var preview = service.preview(previewReq);

        when(bookmarkService.create(any())).thenAnswer(invocation -> {
            var req = invocation.getArgument(0, com.nexus.dto.request.BookmarkCreateRequest.class);
            BookmarkResponse response = new BookmarkResponse();
            response.setId("bookmark-" + req.getTitle());
            response.setUrl(req.getUrl());
            response.setTitle(req.getTitle());
            response.setTagNames(req.getTags());
            return response;
        });

        var commitReq = new BookmarkImportCommitRequest();
        commitReq.setImportSessionId(preview.getImportSessionId());
        commitReq.setDecisions(List.of(
                decision(0, "A", List.of("ChatGPT Plus", "订阅指南", "国内支付")),
                decision(1, "B", List.of("PT", "Private Tracker", "下载教程")),
                decision(2, "C", List.of("RAG", "检索增强生成", "知识库")),
                decision(3, "D", List.of("用户手册", "产品说明书", "电子设备"))
        ));

        service.commit(commitReq);

        ArgumentCaptor<BookmarkSmartGroup> groupCaptor = ArgumentCaptor.forClass(BookmarkSmartGroup.class);
        verify(groupMapper, org.mockito.Mockito.times(3)).insert(groupCaptor.capture());
        assertThat(groupCaptor.getAllValues())
                .extracting(BookmarkSmartGroup::getName)
                .containsExactly("AI 学习", "PT 资源", "硬件设备");
        assertThat(groupCaptor.getAllValues().getFirst().getMatchValue())
                .contains("ChatGPT Plus", "RAG")
                .doesNotContain("AI 学习");

        ArgumentCaptor<BookmarkSmartGroupAssignment> assignmentCaptor =
                ArgumentCaptor.forClass(BookmarkSmartGroupAssignment.class);
        verify(assignmentMapper, org.mockito.Mockito.times(4)).insert(assignmentCaptor.capture());
        assertThat(assignmentCaptor.getAllValues())
                .extracting(BookmarkSmartGroupAssignment::getAssignSource)
                .containsOnly("ai_import");
    }

    private BookmarkImportPreviewRequest.ImportItem item(String url, String title) {
        var item = new BookmarkImportPreviewRequest.ImportItem();
        item.setUrl(url);
        item.setTitle(title);
        return item;
    }

    private BookmarkImportCommitRequest.ImportDecision decision(int sourceIndex, String title, List<String> tags) {
        var decision = new BookmarkImportCommitRequest.ImportDecision();
        decision.setSourceIndex(sourceIndex);
        decision.setAction(BookmarkImportCommitRequest.ImportAction.create);
        decision.setFinalTitle(title);
        decision.setFinalTags(tags);
        return decision;
    }

    private BookmarkAnalyzeResponse aiUnavailable() {
        BookmarkAnalyzeResponse response = new BookmarkAnalyzeResponse();
        response.setAiAvailable(false);
        return response;
    }
}
