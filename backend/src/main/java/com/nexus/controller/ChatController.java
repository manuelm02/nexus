package com.nexus.controller;

import com.nexus.dto.request.ChatRenameRequest;
import com.nexus.dto.request.ChatSendRequest;
import com.nexus.dto.response.ApiResponse;
import com.nexus.dto.response.ChatConversationResponse;
import com.nexus.dto.response.ChatMessageResponse;
import com.nexus.dto.response.ChatSuggestionResponse;
import com.nexus.service.ChatService;
import com.nexus.service.ChatSuggestionService;
import com.nexus.service.ChatTitleService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.List;

/** Chat 日常问答接口：对话管理、历史消息、动态推荐与 SSE 流式发送。 */
@RestController
@RequestMapping("/api/v1/chat")
@RequiredArgsConstructor
public class ChatController {

    private final ChatService chatService;
    private final ChatTitleService chatTitleService;
    private final ChatSuggestionService chatSuggestionService;

    @GetMapping("/conversations")
    public ApiResponse<List<ChatConversationResponse>> listConversations(@AuthenticationPrincipal String userId) {
        return ApiResponse.ok(chatService.listConversations(userId));
    }

    @PostMapping("/conversations")
    public ApiResponse<ChatConversationResponse> createConversation(@AuthenticationPrincipal String userId) {
        return ApiResponse.ok(chatService.createConversation(userId));
    }

    @DeleteMapping("/conversations/{id}")
    public ApiResponse<Void> deleteConversation(@PathVariable String id, @AuthenticationPrincipal String userId) {
        chatService.deleteConversation(id, userId);
        return ApiResponse.ok();
    }

    @PatchMapping("/conversations/{id}/title")
    public ApiResponse<Void> renameConversation(@PathVariable String id,
                                                @AuthenticationPrincipal String userId,
                                                @Valid @RequestBody ChatRenameRequest req) {
        chatService.renameConversation(id, userId, req);
        return ApiResponse.ok();
    }

    @PostMapping("/conversations/{id}/title/ai")
    public ApiResponse<String> generateTitle(@PathVariable String id, @AuthenticationPrincipal String userId) {
        return ApiResponse.ok(chatTitleService.generateTitle(id, userId));
    }

    @GetMapping("/conversations/{id}/messages")
    public ApiResponse<List<ChatMessageResponse>> getMessages(@PathVariable String id, @AuthenticationPrincipal String userId) {
        return ApiResponse.ok(chatService.getMessages(id, userId));
    }

    @GetMapping("/suggestions")
    public ApiResponse<List<ChatSuggestionResponse>> getSuggestions(@AuthenticationPrincipal String userId) {
        return ApiResponse.ok(chatSuggestionService.getSuggestions(userId));
    }

    @PostMapping(value = "/conversations/{id}/messages/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(@PathVariable String id,
                             @AuthenticationPrincipal String userId,
                             @Valid @RequestBody ChatSendRequest req) {
        return chatService.sendMessage(id, userId, req);
    }
}
