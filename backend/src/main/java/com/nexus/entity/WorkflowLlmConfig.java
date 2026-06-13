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
    // providerId 允许显式设为 null（清除绑定，恢复继承全局默认），覆盖 MyBatis-Plus 默认的 NOT_NULL 策略
    @TableField(updateStrategy = FieldStrategy.ALWAYS)
    private String providerId;
    private String modelOverride;
    private BigDecimal temperature;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
