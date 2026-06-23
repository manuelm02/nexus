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

/** Agent B 巡检产出的建议，用户逐条采纳或忽略（human-in-the-loop 核心）。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@TableName("mindbank_agent_suggestions")
public class MindBankAgentSuggestion {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long taskId;
    /** 建议类型：split_note / merge_workspace / resplit_workspace / fix_index / orphan_note */
    private String suggestionType;
    private String description;
    /** 涉及的笔记/Workspace 名称列表，JSONB */
    private String affectedNotes;
    /** 建议的具体操作，JSONB */
    private String proposedAction;
    /** 审批状态：pending / accepted / ignored */
    private String status;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
}
