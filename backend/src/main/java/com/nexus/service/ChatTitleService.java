package com.nexus.service;

import com.nexus.entity.ChatConversation;
import com.nexus.entity.ChatMessage;
import com.nexus.mapper.ChatConversationMapper;
import com.nexus.mapper.ChatMessageMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

/** ChatTitleService 负责对话标题的 AI 生成与异步更新，避免 ChatService 内部自调用绕过 @Async 代理。 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ChatTitleService {

    private final ChatConversationMapper conversationMapper;
    private final ChatMessageMapper messageMapper;
    private final LlmConfigService llmConfigService;

    /** AI 提炼标题：基于最近消息生成 ≤15 字标题。 */
    public String generateTitle(String conversationId, String userId) {
        ChatConversation conversation = conversationMapper.selectById(conversationId);
        if (conversation == null) {
            throw new IllegalArgumentException("对话不存在");
        }
        if (!userId.equals(conversation.getUserId())) {
            throw new IllegalArgumentException("无权访问该对话");
        }
        List<ChatMessage> messages = messageMapper.selectByConversationId(conversationId);
        String summary = buildSummary(messages);
        String prompt = "根据以下对话内容，用不超过 15 个字的中文生成一个准确的对话标题，只输出标题本身：\n" + summary;
        try {
            String title = llmConfigService.resolveModel("chat").generate(prompt).trim();
            return title.length() > 15 ? title.substring(0, 15) : title;
        } catch (Exception e) {
            log.warn("Chat 标题生成失败，conversationId={}", conversationId, e);
            throw new IllegalStateException("标题生成失败：" + e.getMessage(), e);
        }
    }

    @Async("workflowExecutor")
    public void triggerAiTitleIfNeeded(ChatConversation conversation) {
        if (!Boolean.TRUE.equals(conversation.getTitleAi())
                || conversation.getMessageCount() == null
                || conversation.getMessageCount() > 2) {
            return;
        }
        try {
            String title = generateTitleInternal(conversation.getId());
            ChatConversation updated = conversationMapper.selectById(conversation.getId());
            if (updated != null && Boolean.TRUE.equals(updated.getTitleAi())) {
                updated.setTitle(title);
                updated.setUpdatedAt(LocalDateTime.now());
                conversationMapper.updateById(updated);
            }
        } catch (Exception e) {
            log.warn("Chat AI 命名失败，conversationId={}", conversation.getId(), e);
        }
    }

    private String generateTitleInternal(String conversationId) {
        List<ChatMessage> messages = messageMapper.selectByConversationId(conversationId);
        String summary = buildSummary(messages);
        String prompt = "根据以下对话内容，用不超过 10 个字的中文生成一个准确的对话标题，只输出标题本身：\n" + summary;
        String title = llmConfigService.resolveModel("chat").generate(prompt).trim();
        return title.length() > 10 ? title.substring(0, 10) : title;
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
}
