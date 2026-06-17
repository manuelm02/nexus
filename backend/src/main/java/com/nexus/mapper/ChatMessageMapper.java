package com.nexus.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.nexus.entity.ChatMessage;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface ChatMessageMapper extends BaseMapper<ChatMessage> {

    @Select("SELECT * FROM chat_messages WHERE conversation_id = #{conversationId} ORDER BY created_at ASC")
    List<ChatMessage> selectByConversationId(String conversationId);
}
