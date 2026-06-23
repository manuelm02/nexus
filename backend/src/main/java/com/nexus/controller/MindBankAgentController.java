package com.nexus.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.nexus.dto.response.AgentTaskDetailResponse;
import com.nexus.dto.response.ApiResponse;
import com.nexus.entity.MindBankAgentStep;
import com.nexus.entity.MindBankAgentSuggestion;
import com.nexus.entity.MindBankAgentTask;
import com.nexus.mapper.MindBankAgentStepMapper;
import com.nexus.mapper.MindBankAgentSuggestionMapper;
import com.nexus.mapper.MindBankAgentTaskMapper;
import com.nexus.service.MindBankInspectAgent;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * Mindbank Agent 管理接口。
 * 提供巡检触发、任务查询、建议审批功能，对应 Agent B 知识库巡检的完整 human-in-the-loop 流程。
 */
@RestController
@RequestMapping("/api/v1/mindbank/agent")
@RequiredArgsConstructor
public class MindBankAgentController {

    private final MindBankInspectAgent inspectAgent;
    private final MindBankAgentTaskMapper taskMapper;
    private final MindBankAgentStepMapper stepMapper;
    private final MindBankAgentSuggestionMapper suggestionMapper;

    /** 触发知识库巡检，异步执行，立即返回 taskId 供前端轮询 */
    @PostMapping("/inspect")
    public ApiResponse<Map<String, Long>> triggerInspection() {
        Long taskId = inspectAgent.createInspectionTask("manual");
        inspectAgent.runInspection(taskId); // @Async，不阻塞
        return ApiResponse.ok(Map.of("taskId", taskId));
    }

    /** 查询巡检历史列表，按创建时间倒序 */
    @GetMapping("/tasks")
    public ApiResponse<List<MindBankAgentTask>> listTasks() {
        return ApiResponse.ok(taskMapper.selectList(
            new LambdaQueryWrapper<MindBankAgentTask>()
                .orderByDesc(MindBankAgentTask::getCreatedAt)));
    }

    /** 查询单次巡检详情（含执行步骤轨迹 + 建议列表） */
    @GetMapping("/tasks/{id}")
    public ApiResponse<AgentTaskDetailResponse> getTaskDetail(@PathVariable Long id) {
        MindBankAgentTask task = taskMapper.selectById(id);
        if (task == null) return ApiResponse.error("任务不存在");

        List<MindBankAgentStep> steps = stepMapper.selectList(
            new LambdaQueryWrapper<MindBankAgentStep>()
                .eq(MindBankAgentStep::getTaskId, id)
                .orderByAsc(MindBankAgentStep::getStepIndex));

        List<MindBankAgentSuggestion> suggestions = suggestionMapper.selectList(
            new LambdaQueryWrapper<MindBankAgentSuggestion>()
                .eq(MindBankAgentSuggestion::getTaskId, id)
                .orderByAsc(MindBankAgentSuggestion::getId));

        return ApiResponse.ok(new AgentTaskDetailResponse(task, steps, suggestions));
    }

    /** 采纳建议，Phase 6.8 可接入根据 proposed_action 执行实际操作 */
    @PostMapping("/suggestions/{id}/approve")
    public ApiResponse<Void> approveSuggestion(@PathVariable Long id) {
        MindBankAgentSuggestion suggestion = suggestionMapper.selectById(id);
        if (suggestion == null) return ApiResponse.error("建议不存在");
        suggestion.setStatus("accepted");
        suggestionMapper.updateById(suggestion);
        return ApiResponse.ok(null);
    }

    /** 忽略建议 */
    @PostMapping("/suggestions/{id}/ignore")
    public ApiResponse<Void> ignoreSuggestion(@PathVariable Long id) {
        MindBankAgentSuggestion suggestion = suggestionMapper.selectById(id);
        if (suggestion == null) return ApiResponse.error("建议不存在");
        suggestion.setStatus("ignored");
        suggestionMapper.updateById(suggestion);
        return ApiResponse.ok(null);
    }
}
