package com.nexus.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

/** 书签智能分组定义实体，存储分组名称、匹配模式及匹配规则，对应 bookmark_smart_groups 表。 */
@Data
@TableName("bookmark_smart_groups")
public class BookmarkSmartGroup {
    @TableId(type = IdType.ASSIGN_UUID)
    private String id;
    private String name;
    private String description;
    @TableField("match_mode")
    private String matchMode;
    @TableField("match_value")
    private String matchValue;
    @TableField("order_index")
    private Integer orderIndex;
    private Boolean enabled;
    @TableField(fill = FieldFill.INSERT)
    private java.time.LocalDateTime createdAt;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private java.time.LocalDateTime updatedAt;
}
