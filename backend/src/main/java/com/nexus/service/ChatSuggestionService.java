package com.nexus.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.nexus.dto.response.ChatSuggestionResponse;
import com.nexus.entity.ChatConversation;
import com.nexus.mapper.ChatConversationMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/** ChatSuggestionService 基于用户最近 7 天的真实对话标题生成首页推荐词条。 */
@Service
@RequiredArgsConstructor
public class ChatSuggestionService {

    private final ChatConversationMapper conversationMapper;

    private static final List<String> DEFAULT_SUGGESTIONS = List.of(
            "总结一下 TCP 三次握手",
            "用通俗语言解释 Transformer",
            "帮我写一段 Python 快速排序",
            "推荐几款好用的笔记工具",
            "如何设计一个高并发缓存"
    );

    /** 取最近 7 天的对话 title，去重后返回；不足时用预置词条兜底。 */
    public List<ChatSuggestionResponse> getSuggestions(String userId) {
        LocalDateTime since = LocalDateTime.now().minusDays(7);
        List<String> recentTitles = conversationMapper.selectList(
                        new LambdaQueryWrapper<ChatConversation>()
                                .eq(ChatConversation::getUserId, userId)
                                .ge(ChatConversation::getUpdatedAt, since)
                                .orderByDesc(ChatConversation::getUpdatedAt))
                .stream()
                .map(ChatConversation::getTitle)
                .filter(title -> title != null && !title.isBlank() && !"新对话".equals(title))
                .toList();

        Set<String> result = new LinkedHashSet<>();
        int count = 0;
        for (String title : recentTitles) {
            if (count >= 8) break;
            if (result.add(title)) count++;
        }
        if (result.size() < 6) {
            for (String fallback : DEFAULT_SUGGESTIONS) {
                if (result.add(fallback)) {
                    if (result.size() >= 6) break;
                }
            }
        }
        return result.stream().map(ChatSuggestionResponse::new).toList();
    }
}
