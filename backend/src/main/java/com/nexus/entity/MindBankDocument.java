package com.nexus.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

/** Mindbank 文档实体，记录每次 Crawl 或导入的文件及其 5 步流水线处理状态。 */
@Data
@TableName("mindbank_documents")
public class MindBankDocument {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long workspaceId;
    private String fileName;
    /** 'crawl_web' 或 'crawl_file' */
    private String sourceType;
    private String originalMinioKey;
    private String processedMinioKey;
    /** Step1 内容类型识别结果：A/B/C/D/E/F */
    private String contentTypeTag;
    private String pipelineStatus;
    private String step1Status;
    private String step2Status;
    private String step3Status;
    private String step4Status;
    private String step5Status;
    private String stepErrorMsg;
    private String sessionNotePath;
    private Long promptTemplateId;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
