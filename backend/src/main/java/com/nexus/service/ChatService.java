package com.nexus.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexus.dto.request.ChatRenameRequest;
import com.nexus.dto.request.ChatSendRequest;
import com.nexus.dto.response.ChatConversationResponse;
import com.nexus.dto.response.ChatMessageResponse;
import com.nexus.entity.ChatConversation;
import com.nexus.entity.ChatMessage;
import com.nexus.mapper.ChatConversationMapper;
import com.nexus.mapper.ChatMessageMapper;
import dev.langchain4j.data.message.AiMessage;
import dev.langchain4j.data.message.UserMessage;
import dev.langchain4j.model.StreamingResponseHandler;
import dev.langchain4j.model.chat.StreamingChatLanguageModel;
import dev.langchain4j.model.output.Response;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/** ChatService 编排对话 CRUD、历史消息、流式 SSE 与异步 AI 命名。 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ChatService {

    private final ChatConversationMapper conversationMapper;
    private final ChatMessageMapper messageMapper;
    private final LlmConfigService llmConfigService;
    private final ChatTitleService chatTitleService;
    private final ObjectMapper objectMapper;

    /** 创建新对话，初始标题为"新对话"并标记为 AI 生成（titleAi=true）。 */
    @Transactional
    public ChatConversationResponse createConversation(String userId) {
        ChatConversation conversation = new ChatConversation();
        conversation.setUserId(userId);
        conversation.setTitle("新对话");
        conversation.setTitleAi(true);
        conversation.setWorkflowType("chat");
        conversation.setMessageCount(0);
        conversationMapper.insert(conversation);
        return ChatConversationResponse.from(conversation);
    }

    /** 按 updated_at 倒序列出当前用户的所有对话。 */
    public List<ChatConversationResponse> listConversations(String userId) {
        return conversationMapper.selectList(
                        new LambdaQueryWrapper<ChatConversation>()
                                .eq(ChatConversation::getUserId, userId)
                                .orderByDesc(ChatConversation::getUpdatedAt))
                .stream()
                .map(ChatConversationResponse::from)
                .toList();
    }

    /** 获取指定对话的历史消息（按创建时间升序）。 */
    public List<ChatMessageResponse> getMessages(String conversationId, String userId) {
        verifyOwnership(conversationId, userId);
        return messageMapper.selectByConversationId(conversationId)
                .stream()
                .map(ChatMessageResponse::from)
                .toList();
    }

    /** 用户手动重命名对话；保存时默认 titleAi=false，后续 AI 不再覆盖。 */
    @Transactional
    public void renameConversation(String id, String userId, ChatRenameRequest req) {
        ChatConversation conversation = verifyOwnership(id, userId);
        conversation.setTitle(req.getTitle().trim());
        conversation.setTitleAi(req.getTitleAi() != null ? req.getTitleAi() : false);
        conversation.setUpdatedAt(LocalDateTime.now());
        conversationMapper.updateById(conversation);
    }

    /** 删除对话，级联删除消息由数据库外键 ON DELETE CASCADE 处理。 */
    @Transactional
    public void deleteConversation(String id, String userId) {
        verifyOwnership(id, userId);
        conversationMapper.deleteById(id);
    }

    /**
     * SSE 流式发送消息：持久化 user 消息 → 取最近 20 条构建上下文 → StreamingChatLanguageModel 逐 token 输出
     * → done 事件后持久化 assistant 消息，并在满足条件时异步触发 AI 命名。
     */
    public SseEmitter sendMessage(String conversationId, String userId, ChatSendRequest req) {
        ChatConversation conversation = verifyOwnership(conversationId, userId);

        // 持久化用户消息并更新计数
        persistUserMessage(conversation, req.getMessage());

        // 构建上下文：最近 20 条消息，按时间升序
        List<ChatMessage> history = messageMapper.selectByConversationId(conversationId);
        List<dev.langchain4j.data.message.ChatMessage> context = buildContext(history);

        StreamingChatLanguageModel model = llmConfigService.resolveStreamingModel("chat");
        SseEmitter emitter = new SseEmitter(120_000L);
        StringBuilder assistantContent = new StringBuilder();

        // 后台线程执行流式生成，emitter 立即返回给 Spring 建立 SSE 连接；
        // latch.await() 会阻塞 servlet 线程导致 emitter 在所有 token 发完后才返回，破坏流式效果。
        new Thread(() -> {
            try {
                model.generate(context, new StreamingResponseHandler<AiMessage>() {
                    @Override
                    public void onNext(String token) {
                        assistantContent.append(token);
                        sendSseEvent(emitter, new ChatStreamEvent("token", new TokenPayload(token)));
                    }

                    @Override
                    public void onComplete(Response<AiMessage> response) {
                        String finalContent = assistantContent.toString().trim();
                        ChatMessage assistantMsg = persistAssistantMessage(conversation, finalContent);
                        sendSseEvent(emitter, new ChatStreamEvent("done", new DonePayload(ChatMessageResponse.from(assistantMsg))));
                        completeEmitter(emitter);
                        chatTitleService.triggerAiTitleIfNeeded(conversation);
                    }

                    @Override
                    public void onError(Throwable error) {
                        log.warn("Chat SSE 生成失败，conversationId={}", conversationId, error);
                        sendSseEvent(emitter, new ChatStreamEvent("error", new ErrorPayload("生成失败：" + error.getMessage())));
                        completeEmitter(emitter);
                    }
                });
            } catch (Exception e) {
                log.warn("Chat SSE 异常，conversationId={}", conversationId, e);
                sendSseEvent(emitter, new ChatStreamEvent("error", new ErrorPayload("生成失败：" + e.getMessage())));
                completeEmitter(emitter);
            }
        }, "chat-sse-" + conversationId).start();

        return emitter;
    }

    private void persistUserMessage(ChatConversation conversation, String content) {
        ChatMessage userMessage = new ChatMessage();
        userMessage.setConversationId(conversation.getId());
        userMessage.setRole("user");
        userMessage.setContent(content);
        messageMapper.insert(userMessage);

        conversation.setMessageCount((conversation.getMessageCount() == null ? 0 : conversation.getMessageCount()) + 1);
        conversation.setUpdatedAt(LocalDateTime.now());
        conversationMapper.updateById(conversation);
    }

    private ChatMessage persistAssistantMessage(ChatConversation conversation, String content) {
        ChatMessage assistantMessage = new ChatMessage();
        assistantMessage.setConversationId(conversation.getId());
        assistantMessage.setRole("assistant");
        assistantMessage.setContent(content);
        messageMapper.insert(assistantMessage);

        conversation.setMessageCount((conversation.getMessageCount() == null ? 0 : conversation.getMessageCount()) + 1);
        conversation.setUpdatedAt(LocalDateTime.now());
        conversationMapper.updateById(conversation);
        return assistantMessage;
    }

    private List<dev.langchain4j.data.message.ChatMessage> buildContext(List<ChatMessage> history) {
        List<dev.langchain4j.data.message.ChatMessage> context = new ArrayList<>();
        int start = Math.max(0, history.size() - 20);
        for (int i = start; i < history.size(); i++) {
            ChatMessage msg = history.get(i);
            if ("user".equals(msg.getRole())) {
                context.add(new UserMessage(msg.getContent()));
            } else if ("assistant".equals(msg.getRole())) {
                context.add(new AiMessage(msg.getContent()));
            }
        }
        return context;
    }

    private void sendSseEvent(SseEmitter emitter, ChatStreamEvent event) {
        try {
            // SSE data 只写 payload，与 translate 流模式一致：前端用 event.name 识别类型，data 解析为 payload
            String data = objectMapper.writeValueAsString(event.payload());
            emitter.send(SseEmitter.event()
                    .name(event.type())
                    .data(data));
        } catch (IOException e) {
            log.warn("Chat SSE 写出失败", e);
            completeEmitter(emitter);
        }
    }

    private void completeEmitter(SseEmitter emitter) {
        try {
            emitter.complete();
        } catch (Exception ignored) {
        }
    }

    /** 校验会话归属，返回实体。 */
    private ChatConversation verifyOwnership(String conversationId, String userId) {
        ChatConversation conversation = conversationMapper.selectById(conversationId);
        if (conversation == null) {
            throw new IllegalArgumentException("对话不存在");
        }
        if (!userId.equals(conversation.getUserId())) {
            throw new IllegalArgumentException("无权访问该对话");
        }
        return conversation;
    }

    private String buildSummary(List<ChatMessage> messages) {
        int limit = Math.min(messages.size(), 6);
        StringBuilder sb = new StringBuilder();
        for (int i = messages.size() - limit; i < messages.size(); i++) {
            ChatMessage msg = messages.get(i);
            sb.append(msg.getRole()).append("：").append(msg.getContent()).append("\n");
        }
        return sb.toString();
    }

    public record ChatStreamEvent(String type, Object payload) {
    }

    public record TokenPayload(String token) {
    }

    public record DonePayload(ChatMessageResponse message) {
    }

    public record ErrorPayload(String error) {
    }
}
