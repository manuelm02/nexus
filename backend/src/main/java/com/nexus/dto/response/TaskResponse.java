package com.nexus.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class TaskResponse {
    private String id;
    private String type;
    private String status;
    private Object input;
    private Object output;
    private String errorMessage;
    private String resultText;
    private String resultMarkdown;
    private Object resultJson;
    private Object resultFiles;
    private String notionPageUrl;
    private boolean notionSynced;
    private boolean keepForever;
    private boolean archived;
    private LocalDateTime expiresAt;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
