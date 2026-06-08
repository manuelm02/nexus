package com.nexus.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("system_configs")
public class SystemConfig {
    @TableId(type = IdType.ASSIGN_UUID)
    private String id;
    private String configKey;
    private String configVal;
    private String description;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
