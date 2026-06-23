package com.nexus.service;

import com.nexus.entity.MindBankDocument;
import com.nexus.integration.crawl4ai.Crawl4AiClient;
import com.nexus.integration.markitdown.MarkItDownClient;
import com.nexus.integration.minio.MinioService;
import com.nexus.mapper.MindBankDocumentMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** CrawlService 单元测试，覆盖 Crawl 文件导入 Mindbank 时的关键字段落库。 */
@ExtendWith(MockitoExtension.class)
class CrawlServiceTest {

    @Mock
    private Crawl4AiClient crawl4AiClient;
    @Mock
    private MarkItDownClient markItDownClient;
    @Mock
    private MinioService minioService;
    @Mock
    private MindBankDocumentMapper mindBankDocumentMapper;
    @Mock
    private SystemConfigService systemConfigService;
    @Mock
    private MindBankPipelineService mindBankPipelineService;

    @InjectMocks
    private CrawlService crawlService;

    @Test
    void importToWorkspaceShouldPersistSelectedPromptTemplateId() {
        MindBankDocument doc = new MindBankDocument();
        doc.setId(7L);
        when(mindBankDocumentMapper.selectById(7L)).thenReturn(doc);

        crawlService.importToWorkspace(7L, 3L, 42L);

        ArgumentCaptor<MindBankDocument> captor = ArgumentCaptor.forClass(MindBankDocument.class);
        verify(mindBankDocumentMapper).updateById(captor.capture());
        assertThat(captor.getValue().getWorkspaceId()).isEqualTo(3L);
        assertThat(captor.getValue().getPromptTemplateId()).isEqualTo(42L);
        assertThat(captor.getValue().getPipelineStatus()).isEqualTo("processing");
        verify(mindBankPipelineService).triggerAsync(7L);
    }
}
