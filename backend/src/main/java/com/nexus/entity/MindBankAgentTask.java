package com.nexus.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/** Mindbank Agent 任务记录，支持巡检/融合/QA 三类 Agent 的状态追踪与中断恢复。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@TableName("mindbank_agent_tasks")
public class MindBankAgentTask {
    @TableId(type = IdType.AUTO)
    private Long id;
    /** Agent 类型：inspect(B) / merge_check(A) / qa(C) */
    private String agentType;
    /** 触发方式：manual / auto */
    private String triggerType;
    /** 状态流转：pending → running → awaiting_approval → done / failed */
    private String status;
    private Long workspaceId;
    private String summary;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updatedAt;
}
