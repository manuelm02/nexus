package com.nexus.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@TableName("todos")
public class Todo {
    @TableId(type = IdType.ASSIGN_UUID)
    private String id;
    private String title;
    private String description;
    private String priority;   // low|medium|high
    private String status;     // pending|cancelled|not_started|in_progress|done
    private LocalDate scheduledDate;
    private LocalDate dueDate;
    private String taskId;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
