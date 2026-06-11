package com.nexus.service;

import com.nexus.dto.request.TranslateRequest;
import com.nexus.entity.Translation;
import com.nexus.mapper.TranslationMapper;
import com.nexus.translate.TranslationProviderPort;
import com.nexus.translate.TranslationResultPayload;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TranslateServiceTest {

    @Mock
    private TranslationMapper translationMapper;

    @Mock
    private TranslationProviderPort translationProvider;

    @InjectMocks
    private TranslateService translateService;

    @Test
    void translateShouldReturnLayeredResultAndPersistProviderMetadata() {
        TranslateRequest req = new TranslateRequest();
        req.setSourceText("今天的会议推迟到下午三点");
        req.setTargetLang("英文");
        req.setStyle("formal");
        when(translationProvider.translate(req)).thenReturn(new TranslationResultPayload(
                "Today's meeting has been postponed to 3 PM.",
                "采用正式语气，保留会议时间变更的清晰表达。",
                List.of("会议", "推迟", "下午三点"),
                List.of("The meeting has been moved to 3 PM this afternoon."),
                "llm"
        ));

        Translation saved = translateService.translate(req);

        assertThat(saved.getTranslatedText()).isNotBlank();
        assertThat(saved.getExplanation()).isNotBlank();
        assertThat(saved.getKeywords()).contains("会议");
        assertThat(saved.getAlternatives()).contains("The meeting has been moved to 3 PM this afternoon.");
        assertThat(saved.getProvider()).isEqualTo("llm");
        verify(translationMapper).insert(saved);
    }
}
