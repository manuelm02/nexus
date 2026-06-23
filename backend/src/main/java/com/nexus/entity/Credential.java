package com.nexus.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.time.LocalDateTime;

/** 账号凭证实体，管理各平台登录账号、密码和 TOTP 密钥的加密存储 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@TableName("credentials")
public class Credential {
    @TableId(type = IdType.ASSIGN_UUID)
    private String id;
    private String platform;
    private String label;
    private String category;
    private String username;
    private String encryptedPassword;
    private String encryptedTotpSecret;
    private String url;
    private LocalDate expireDate;
    private String subscriptionId;
    private String notes;

    @TableField("archived")
    private boolean archived;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
