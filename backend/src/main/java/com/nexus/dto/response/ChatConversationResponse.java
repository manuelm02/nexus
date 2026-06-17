package com.nexus.dto.response;

import com.nexus.entity.ChatConversation;
import lombok.Data;

import java.time.LocalDateTime;

/** Chat 会话列表项响应。 */
@Data
public class ChatConversationResponse {
    private String id;
    private String title;
    private Boolean titleAi;
    private String workflowType;
    private Integer messageCount;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public static ChatConversationResponse from(ChatConversation entity) {
        ChatConversationResponse response = new ChatConversationResponse();
        response.setId(entity.getId());
        response.setTitle(entity.getTitle());
        response.setTitleAi(entity.getTitleAi());
        response.setWorkflowType(entity.getWorkflowType());
        response.setMessageCount(entity.getMessageCount());
        response.setCreatedAt(entity.getCreatedAt());
        response.setUpdatedAt(entity.getUpdatedAt());
        return response;
    }
}
