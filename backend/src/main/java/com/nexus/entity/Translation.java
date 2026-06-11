package com.nexus.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.nexus.handler.JsonbTypeHandler;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

/** Translation 记录一次翻译结果及其补充信息，支撑 Translate 工作台回填和历史浏览。 */
@Data
@TableName(value = "translations", autoResultMap = true)
public class Translation {
    @TableId(type = IdType.ASSIGN_UUID)
    private String id;
    private String sourceText;
    private String translatedText;
    private String sourceLang;
    private String targetLang;
    private String style;
    private String taskId;
    private String explanation;
    @TableField(typeHandler = JsonbTypeHandler.class)
    private List<String> keywords;
    @TableField(typeHandler = JsonbTypeHandler.class)
    private List<String> alternatives;
    private String provider;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
}
