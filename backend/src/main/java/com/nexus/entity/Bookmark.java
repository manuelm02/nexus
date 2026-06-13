package com.nexus.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

/** Nexus 原生书签实体，存储于 PostgreSQL bookmarks 表。 */
@Data
@TableName(value = "bookmarks", autoResultMap = true)
public class Bookmark {
    @TableId(type = IdType.ASSIGN_UUID)
    private String id;
    private String url;
    private String normalizedUrl;
    private String title;
    private String description;
    private String notes;
    /** 标签列表，以 JSONB 存储 */
    @TableField(typeHandler = JacksonTypeHandler.class)
    private List<String> tags;
    private boolean unread;
    private boolean archived;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
