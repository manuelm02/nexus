package com.nexus.entity;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;

import java.time.LocalDateTime;

/** 书签到智能分组的 N:N 分配记录，由规则引擎自动维护或手动添加，对应 bookmark_smart_group_assignments 表。 */
@Data
@TableName("bookmark_smart_group_assignments")
public class BookmarkSmartGroupAssignment {
    @TableId(type = IdType.ASSIGN_UUID)
    private String id;
    @TableField("group_id")
    private String groupId;
    @TableField("bookmark_id")
    private String bookmarkId;
    @TableField("assign_source")
    private String assignSource;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
}
