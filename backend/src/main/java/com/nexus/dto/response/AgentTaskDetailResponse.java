package com.nexus.dto.response;

import com.nexus.entity.MindBankAgentStep;
import com.nexus.entity.MindBankAgentSuggestion;
import com.nexus.entity.MindBankAgentTask;

import java.util.List;

/**
 * Agent 任务详情响应，包含任务元信息、执行步骤轨迹和建议列表。
 * 供前端展示巡检详情页面使用。
 */
public record AgentTaskDetailResponse(
        MindBankAgentTask task,
        List<MindBankAgentStep> steps,
        List<MindBankAgentSuggestion> suggestions
) {}
