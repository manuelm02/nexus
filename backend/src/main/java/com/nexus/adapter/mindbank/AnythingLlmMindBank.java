package com.nexus.adapter.mindbank;

import com.nexus.port.MindBankPort;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "nexus.mindbank.store", havingValue = "anythingllm", matchIfMissing = true)
public class AnythingLlmMindBank implements MindBankPort {

    // TODO 阶段2：注入 AnythingLlmClient 并实现所有方法

    @Override
    public IngestResult ingest(IngestRequest request) {
        log.warn("AnythingLlmMindBank.ingest 尚未在阶段2实现");
        return new IngestResult(false, null, "尚未实现");
    }

    @Override
    public List<RetrievedChunk> search(SearchRequest request) {
        log.warn("AnythingLlmMindBank.search 尚未在阶段2实现");
        return List.of();
    }

    @Override
    public void delete(String docId) {
        log.warn("AnythingLlmMindBank.delete 尚未在阶段2实现");
    }

    @Override
    public List<WorkspaceInfo> listWorkspaces() {
        return List.of();
    }

    @Override
    public WorkspaceInfo ensureWorkspace(String domain) {
        log.warn("AnythingLlmMindBank.ensureWorkspace 尚未在阶段2实现");
        return new WorkspaceInfo(domain.toLowerCase().replace(" ", "-"), domain);
    }
}
