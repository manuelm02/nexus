package com.nexus.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
public class MindbankMetaResponse {
    private String id;
    private String title;
    private String summary;
    private String domain;
    private List<String> tags;
    private String sourceType;
    private String fileUrl;
    private String fileName;
    private Long fileSize;
    private String sourceUrl;
    private String reviewStatus;
    private String workspaceSlug;
    private String anythingllmDocId;
    private LocalDateTime ingestedAt;
    private String notionPageUrl;
    private boolean notionSynced;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
