package com.nexus.dto.response;

import com.nexus.entity.ChatMessage;
import lombok.Data;

import java.time.LocalDateTime;

/** Chat 单条消息响应。 */
@Data
public class ChatMessageResponse {
    private String id;
    private String conversationId;
    private String role;
    private String content;
    private LocalDateTime createdAt;

    public static ChatMessageResponse from(ChatMessage entity) {
        ChatMessageResponse response = new ChatMessageResponse();
        response.setId(entity.getId());
        response.setConversationId(entity.getConversationId());
        response.setRole(entity.getRole());
        response.setContent(entity.getContent());
        response.setCreatedAt(entity.getCreatedAt());
        return response;
    }
}
