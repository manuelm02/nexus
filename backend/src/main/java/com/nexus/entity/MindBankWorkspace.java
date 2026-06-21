package com.nexus.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

/** Mindbank 工作空间实体，对应 AnythingLLM workspace，承载 Master Note 路径和 embedding 文档 ID。 */
@Data
@TableName("mindbank_workspaces")
public class MindBankWorkspace {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String name;
    private String domainTag;
    private String anythingllmSlug;
    private String description;
    private String masterNotePath;
    private String anythingllmDocId;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
