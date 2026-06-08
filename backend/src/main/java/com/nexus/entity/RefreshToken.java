package com.nexus.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("refresh_tokens")
public class RefreshToken {
    @TableId(type = IdType.ASSIGN_UUID)
    private String id;
    private String userId;
    private String tokenHash;
    private String deviceType;
    private String deviceInfo;
    private LocalDateTime expiresAt;
    private boolean revoked;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
}
