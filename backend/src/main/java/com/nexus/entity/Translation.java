package com.nexus.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("prism")
public class Translation {
    @TableId(type = IdType.ASSIGN_UUID)
    private String id;
    private String sourceText;
    private String translatedText;
    private String sourceLang;
    private String targetLang;
    private String style;
    private String taskId;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
}
