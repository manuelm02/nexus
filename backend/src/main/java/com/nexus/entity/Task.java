package com.nexus.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName(value = "tasks", autoResultMap = true)
public class Task {
    @TableId(type = IdType.ASSIGN_UUID)
    private String id;
    private String type;
    private String status;  // pending|running|completed|failed
    @TableField(typeHandler = JacksonTypeHandler.class)
    private Object input;
    @TableField(typeHandler = JacksonTypeHandler.class)
    private Object output;
    private String errorMessage;
    private String resultText;
    private String resultMarkdown;
    @TableField(typeHandler = JacksonTypeHandler.class)
    private Object resultJson;
    @TableField(typeHandler = JacksonTypeHandler.class)
    private Object resultFiles;
    private String telegramMessageId;
    private boolean telegramSent;
    private boolean keepForever;
    private boolean archived;
    private LocalDateTime expiresAt;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
