package com.nexus.service;

import com.nexus.dto.request.TranslateRequest;
import com.nexus.translate.FastTranslationProviderPort;
import com.nexus.translate.TranslationProviderPort;
import com.nexus.translate.TranslationResultPayload;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TranslateStreamingServiceTest {

    @Mock
    private FastTranslationProviderPort fastProvider;

    @Mock
    private TranslationProviderPort llmProvider;

    @Test
    void streamShouldEmitFastDraftThenEnhancedResult() {
        TranslateStreamingService service = new TranslateStreamingService(fastProvider, llmProvider, null);
        TranslateRequest request = new TranslateRequest();
        request.setSourceText("architecture");
        request.setTargetLang("中文");

        when(fastProvider.translateFast(request)).thenReturn(Optional.of(new TranslationResultPayload(
                "建筑", null, List.of(), List.of(), "baidu"
        )));
        when(llmProvider.translate(argThat(req -> req.getContext() != null && req.getContext().contains("建筑"))))
                .thenReturn(new TranslationResultPayload(
                        "建筑学", "结合上下文可译为建筑学。", List.of("architecture"), List.of("架构"), "llm"
                ));

        List<TranslateStreamingService.TranslateStreamEvent> events = service.translate(request);

        assertThat(events).extracting(TranslateStreamingService.TranslateStreamEvent::type)
                .containsExactly("draft", "enhanced", "done");
        assertThat(events.get(0).payload().translatedText()).isEqualTo("建筑");
        assertThat(events.get(1).payload().translatedText()).isEqualTo("建筑学");
        verify(llmProvider).translate(argThat(req -> req.getContext().contains("翻译 API 初稿：建筑")));
    }
}
