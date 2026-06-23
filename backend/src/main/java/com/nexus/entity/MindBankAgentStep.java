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

/** Agent loop 每一步的执行轨迹，用于前端可视化展示和长任务中断恢复。 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@TableName("mindbank_agent_steps")
public class MindBankAgentStep {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long taskId;
    private Integer stepIndex;
    /** 模型这一步的思考（LLM 输出文本） */
    private String thought;
    /** 调用的工具名，空值表示纯思考或最终结论步骤 */
    private String toolCalled;
    /** 工具入参，JSONB 存储 */
    private String toolInput;
    /** 工具返回，JSONB 存储（截断至 5000 字符防膨胀） */
    private String toolOutput;
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createdAt;
}
