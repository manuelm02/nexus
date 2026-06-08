package com.nexus.port;

import java.util.List;
import java.util.Map;

public interface MindBankPort {
    IngestResult ingest(IngestRequest request);
    List<RetrievedChunk> search(SearchRequest request);
    void delete(String docId);
    List<WorkspaceInfo> listWorkspaces();
    WorkspaceInfo ensureWorkspace(String domain);

    record IngestRequest(
            String domain,
            String docId,
            String content,
            Map<String, Object> metadata
    ) {}

    record IngestResult(boolean success, String docId, String errorMsg) {}

    record RetrievedChunk(
            String docId,
            String chunkText,
            double score,
            Map<String, Object> metadata
    ) {}

    record SearchRequest(String query, String domain, int topK) {}

    record WorkspaceInfo(String slug, String name) {}
}
