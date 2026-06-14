package com.nexus.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.nexus.handler.JsonbTypeHandler;
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
    /** 标签列表以 JSONB 存储，插入时必须使用 PostgreSQL OTHER 类型避免被当成 VARCHAR。 */
    @TableField(typeHandler = JsonbTypeHandler.class)
    private List<String> tags;
    private boolean unread;
    private boolean archived;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
