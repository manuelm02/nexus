package com.nexus.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@TableName("workflow_llm_configs")
public class WorkflowLlmConfig {
    @TableId(type = IdType.ASSIGN_UUID)
    private String id;
    private String workflowType;
    private String providerId;
    private String modelOverride;
    private BigDecimal temperature;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
