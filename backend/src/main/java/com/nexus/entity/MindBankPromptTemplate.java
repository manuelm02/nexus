package com.nexus.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * Mindbank Prompt 模板实体。
 * boolean 字段避免 isXxx 前缀命名，改用语义化名称并显式映射列名，
 * 规避 MyBatis-Plus lambda cache 解析错误（见 CLAUDE.md 约束）。
 */
@Data
@TableName("mindbank_prompt_templates")
public class MindBankPromptTemplate {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String name;
    /** 'organize_init' | 'organize_merge' | 'session_note' | 'classify_folder' */
    private String promptType;
    private String content;
    @TableField("is_default")
    private Boolean defaultFlag;
    @TableField("is_builtin")
    private Boolean builtinFlag;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
