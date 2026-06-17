package com.nexus.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/** 订阅分类实体，用于 Settings 页面管理可选分类列表。 */
@Data
@TableName("subscription_categories")
public class SubscriptionCategory {
    @TableId(type = IdType.ASSIGN_UUID)
    private String id;
    private String name;
    private LocalDateTime createdAt;
}
