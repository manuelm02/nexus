package com.nexus.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@TableName("users")
public class User {
    @TableId(type = IdType.ASSIGN_UUID)
    private String id;
    private String username;
    private String nickname;
    private String avatarUrl;
    private String email;
    private String phone;
    private String passwordHash;
    private String role;
    private String telegramId;
    private String telegramUsername;
    private String appleUserId;
    private String wechatOpenid;
    private String wechatUnionid;
    private String status;
    private LocalDateTime lastLoginAt;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
