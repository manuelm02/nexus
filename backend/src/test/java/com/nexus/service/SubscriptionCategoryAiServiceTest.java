package com.nexus.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexus.dto.request.SubscriptionCategorySuggestRequest;
import com.nexus.dto.response.SubscriptionCategorySuggestResponse;
import dev.langchain4j.model.chat.ChatLanguageModel;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Collections;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** 订阅分类 AI 识别服务单元测试：覆盖空分类生成、已有分类匹配、LLM 异常降级。 */
@ExtendWith(MockitoExtension.class)
class SubscriptionCategoryAiServiceTest {

    @Mock
    private LlmConfigService llmConfigService;

    @Mock
    private SubscriptionCategoryService categoryService;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private SubscriptionCategoryAiService aiService;

    /** 分类表为空时，AI 生成新分类并持久化。 */
    @Test
    void suggest_emptyCategories_generatesAndPersists() {
        when(categoryService.listNames()).thenReturn(Collections.emptyList());
        ChatLanguageModel model = org.mockito.Mockito.mock(ChatLanguageModel.class);
        when(llmConfigService.resolveModel("subscriptions")).thenReturn(model);
        when(model.generate(anyString())).thenReturn("{\"category\": \"AI 工具\", \"is_new\": true}");

        SubscriptionCategorySuggestRequest req = new SubscriptionCategorySuggestRequest();
        req.setName("ChatGPT Plus");
        SubscriptionCategorySuggestResponse result = aiService.suggest(req);

        assertThat(result.getCategory()).isEqualTo("AI 工具");
        assertThat(result.isNew()).isTrue();
        verify(categoryService).create("AI 工具");
    }

    /** 分类表非空时，AI 从已有分类中选择最匹配的。 */
    @Test
    void suggest_existingCategories_selectsMatch() {
        when(categoryService.listNames()).thenReturn(List.of("AI 工具", "云服务"));
        ChatLanguageModel model = org.mockito.Mockito.mock(ChatLanguageModel.class);
        when(llmConfigService.resolveModel("subscriptions")).thenReturn(model);
        when(model.generate(anyString())).thenReturn("{\"category\": \"AI 工具\", \"is_new\": false}");

        SubscriptionCategorySuggestRequest req = new SubscriptionCategorySuggestRequest();
        req.setName("ChatGPT Plus");
        SubscriptionCategorySuggestResponse result = aiService.suggest(req);

        assertThat(result.getCategory()).isEqualTo("AI 工具");
        assertThat(result.isNew()).isFalse();
    }

    /** LLM 调用异常时降级返回"未分类"，不向外抛异常。 */
    @Test
    void suggest_llmException_fallback() {
        when(categoryService.listNames()).thenReturn(Collections.emptyList());
        when(llmConfigService.resolveModel("subscriptions")).thenThrow(new RuntimeException("LLM unavailable"));

        SubscriptionCategorySuggestRequest req = new SubscriptionCategorySuggestRequest();
        req.setName("ChatGPT Plus");
        SubscriptionCategorySuggestResponse result = aiService.suggest(req);

        assertThat(result.getCategory()).isEqualTo("未分类");
        assertThat(result.isNew()).isFalse();
    }
}
