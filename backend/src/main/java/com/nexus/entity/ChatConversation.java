package com.nexus.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

/** Chat 对话会话实体，title_ai 字段用 Boolean 语义化命名并显式映射列名，规避 MyBatis-Plus lambda cache 问题。 */
@Data
@TableName("chat_conversations")
public class ChatConversation {
    @TableId(type = IdType.ASSIGN_UUID)
    private String id;
    private String userId;
    private String title;
    @TableField("title_ai")
    private Boolean titleAi;
    private String workflowType;
    private Integer messageCount;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
