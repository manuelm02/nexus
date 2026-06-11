package com.nexus.translate;

import com.nexus.dto.request.TranslateRequest;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

class ConfiguredFastTranslationProviderTest {

    @Test
    void translateFastShouldUseTencentSdkCredentialsFromConfig() {
        RecordingTencentClient client = new RecordingTencentClient("你好");
        ConfiguredFastTranslationProvider provider = new ConfiguredFastTranslationProvider(client, "", "");
        ReflectionTestUtils.setField(provider, "secretId", "secret-id");
        ReflectionTestUtils.setField(provider, "secretKey", "secret-key");
        TranslateRequest request = new TranslateRequest();
        request.setSourceText("hello");
        request.setTargetLang("中文");

        Optional<TranslationResultPayload> result = provider.translateFast(request);

        assertThat(result).isPresent();
        assertThat(result.get().translatedText()).isEqualTo("你好");
        assertThat(result.get().provider()).isEqualTo("tencent");
        assertThat(client.secretId).isEqualTo("secret-id");
        assertThat(client.secretKey).isEqualTo("secret-key");
        assertThat(client.sourceText).isEqualTo("hello");
        assertThat(client.targetLanguage).isEqualTo("zh");
    }

    @Test
    void translateFastShouldSkipFastDraftWhenTencentCredentialsAreMissing() {
        RecordingTencentClient client = new RecordingTencentClient("你好");
        ConfiguredFastTranslationProvider provider = new ConfiguredFastTranslationProvider(client, "", "");
        TranslateRequest request = new TranslateRequest();
        request.setSourceText("hello");
        request.setTargetLang("中文");

        Optional<TranslationResultPayload> result = provider.translateFast(request);

        assertThat(result).isEmpty();
        assertThat(client.called).isFalse();
    }

    private static class RecordingTencentClient implements TencentMachineTranslationClient {
        private final String response;
        private boolean called;
        private String secretId;
        private String secretKey;
        private String sourceText;
        private String targetLanguage;

        private RecordingTencentClient(String response) {
            this.response = response;
        }

        @Override
        public String translate(String secretId, String secretKey, String sourceText, String targetLanguage) {
            this.called = true;
            this.secretId = secretId;
            this.secretKey = secretKey;
            this.sourceText = sourceText;
            this.targetLanguage = targetLanguage;
            return response;
        }
    }
}
