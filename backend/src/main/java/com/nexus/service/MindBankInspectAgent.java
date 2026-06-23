package com.nexus.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nexus.entity.MindBankAgentStep;
import com.nexus.entity.MindBankAgentSuggestion;
import com.nexus.entity.MindBankAgentTask;
import com.nexus.mapper.MindBankAgentStepMapper;
import com.nexus.mapper.MindBankAgentSuggestionMapper;
import com.nexus.mapper.MindBankAgentTaskMapper;
import dev.langchain4j.agent.tool.Tool;
import dev.langchain4j.agent.tool.ToolExecutionRequest;
import dev.langchain4j.agent.tool.ToolSpecification;
import dev.langchain4j.agent.tool.ToolSpecifications;
import dev.langchain4j.data.message.AiMessage;
import dev.langchain4j.data.message.SystemMessage;
import dev.langchain4j.data.message.ToolExecutionResultMessage;
import dev.langchain4j.data.message.UserMessage;
import dev.langchain4j.memory.chat.MessageWindowChatMemory;
import dev.langchain4j.model.chat.ChatLanguageModel;
import dev.langchain4j.model.output.Response;
import dev.langchain4j.service.tool.DefaultToolExecutor;
import dev.langchain4j.service.tool.ToolExecutor;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * 知识库巡检 Agent（Agent B）：定期或手动扫描整个知识库，自主发现体系性问题，
 * 产出结构化建议等待用户审批。
 *
 * 设计原则：只读不改，任何执行都需用户确认（human-in-the-loop）。
 *
 * 实现方式：自建 agent loop（而非 AiServices 黑盒），以便完整记录每一步的
 * 思考、工具调用、入参和返回到 mindbank_agent_steps，供前端轨迹可视化。
 * LangChain4j 0.35.0 的 AiServices 不提供 tool 调用中间步骤拦截，
 * 自建 loop 是记录完整轨迹的最可靠方式。
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MindBankInspectAgent {

    private final LlmConfigService llmConfigService;
    private final MindBankAgentTools agentTools;
    private final MindBankAgentTaskMapper taskMapper;
    private final MindBankAgentStepMapper stepMapper;
    private final MindBankAgentSuggestionMapper suggestionMapper;
    private final ObjectMapper objectMapper;

    /** 巡检系统提示词：定义角色、问题类型、巡检流程、输出格式和约束 */
    private static final String SYSTEM_PROMPT = """
        你是 Nexus Mindbank 的知识库巡检助手。你的职责是检查整个知识库的体系性，发现问题并产出结构化建议。

        ## 你能发现的问题类型

        1. **split_note**：某 Master Note 过长（>5000字），内容跨多个主题，建议拆分为独立 Workspace
        2. **merge_workspace**：两个 Workspace 内容高度重叠（>30%），建议合并为一个
        3. **resplit_workspace**：某 Workspace 内容太杂（跨多个不相关领域），建议重新切分
        4. **fix_index**：知识索引（_index.md）与实际笔记不一致（缺失条目或条目指向不存在的文件）
        5. **orphan_note**：孤立笔记（不属于任何 Workspace）或长期未更新的 Master Note（>90天）

        ## 巡检流程

        1. 先调用 listAllNotes 查看所有笔记的元信息
        2. 调用 listWorkspaces 了解 Workspace 分布
        3. 调用 readIndex 查看全局索引
        4. 根据元信息，自主决定深入检查哪些笔记（如：文件过大、名称相似的 Workspace）
        5. 对可疑项调用 readMasterNote 查看内容，或 searchKnowledgeBase 检查重叠度
        6. 汇总发现的问题

        ## 输出格式

        完成巡检后，输出一个 JSON 数组，每个元素是一条建议：
        ```json
        [
          {
            "type": "split_note",
            "description": "Workspace「Java 后端」的 Master Note 已有 8000 字，涵盖 Spring Boot 和 MyBatis 两个独立主题，建议拆分",
            "affected": ["Java 后端"],
            "action": "将 Spring Boot 相关内容拆分为独立 Workspace「Spring Boot」"
          }
        ]
        ```

        如果没有发现任何问题，返回空数组 `[]`。

        ## 约束

        - 你只能读取数据，不能修改任何笔记或 Workspace
        - 每个工具调用前先说明你的判断依据
        - 不要检查所有笔记的完整内容，只深入检查可疑项
        - 最多调用 20 次工具，避免无限循环
        """;

    /** Agent loop 最大步数，防止无限循环 */
    private static final int MAX_STEPS = 25;

    /**
     * 创建巡检任务记录，返回 task ID 供前端轮询。
     * @param triggerType 触发方式：manual / auto
     * @return 新创建的 task ID
     */
    public Long createInspectionTask(String triggerType) {
        MindBankAgentTask task = MindBankAgentTask.builder()
            .agentType("inspect")
            .triggerType(triggerType)
            .status("pending")
            .build();
        taskMapper.insert(task);
        return task.getId();
    }

    /**
     * 异步执行巡检任务。通过自建 agent loop 逐步调用 LLM + 工具，
     * 每一步都记录到 mindbank_agent_steps 供前端可视化。
     */
    @Async("mindBankPipelineExecutor")
    public void runInspection(Long taskId) {
        try {
            updateTaskStatus(taskId, "running");

            // resolveModel 在未配置 Provider 时抛 IllegalStateException，此处捕获转为友好提示
            ChatLanguageModel model;
            try {
                model = llmConfigService.resolveModel("mindbank_organize");
            } catch (IllegalStateException e) {
                throw new IllegalStateException("请先在 Settings → Mindbank 中配置 mindbank_organize 模型", e);
            }

            // 从 @Tool 注解方法构建工具规格和执行器映射
            List<ToolSpecification> toolSpecs = ToolSpecifications.toolSpecificationsFrom(agentTools);
            Map<String, ToolExecutor> toolExecutors = buildToolExecutors(agentTools);

            // 构建 chat memory：system prompt + 用户指令
            MessageWindowChatMemory memory = MessageWindowChatMemory.withMaxMessages(40);
            memory.add(new SystemMessage(SYSTEM_PROMPT));
            memory.add(new UserMessage("请开始巡检知识库。"));

            AtomicInteger stepIndex = new AtomicInteger(0);
            String finalResult = null;

            // 自建 agent loop：LLM 生成 → 判断是否有 tool call → 执行 tool → 回传结果 → 循环
            for (int i = 0; i < MAX_STEPS; i++) {
                Response<AiMessage> response = model.generate(memory.messages(), toolSpecs);
                AiMessage aiMessage = response.content();
                memory.add(aiMessage);

                // 无 tool call 表示 Agent 已完成推理，输出最终结论
                if (!aiMessage.hasToolExecutionRequests()) {
                    finalResult = aiMessage.text();
                    recordStep(taskId, stepIndex.incrementAndGet(),
                        finalResult, null, null, null);
                    break;
                }

                // 执行所有 tool calls，每个记录一步轨迹
                for (ToolExecutionRequest req : aiMessage.toolExecutionRequests()) {
                    String thought = (aiMessage.text() != null && !aiMessage.text().isBlank())
                        ? aiMessage.text() : null;

                    ToolExecutor executor = toolExecutors.get(req.name());
                    String toolResult;
                    if (executor != null) {
                        toolResult = executor.execute(req, null);
                    } else {
                        toolResult = "错误：未找到工具 " + req.name();
                    }

                    recordStep(taskId, stepIndex.incrementAndGet(),
                        thought, req.name(), req.arguments(), toolResult);

                    // 将工具返回结果回传给 LLM，供下一步推理
                    memory.add(ToolExecutionResultMessage.from(req, toolResult));
                }

                // 最后一步如果仍有 tool call，取最后一条 AiMessage 的 text 作为结果
                if (i == MAX_STEPS - 1) {
                    finalResult = aiMessage.text() != null ? aiMessage.text() : "巡检达到最大步数限制，可能未完成全部检查";
                    recordStep(taskId, stepIndex.incrementAndGet(),
                        finalResult, null, null, null);
                }
            }

            // 解析最终输出中的结构化建议 JSON
            if (finalResult != null) {
                parseSuggestions(taskId, finalResult);
            }

            // 根据是否有建议更新任务状态
            long suggestionCount = suggestionMapper.selectCount(
                new LambdaQueryWrapper<MindBankAgentSuggestion>()
                    .eq(MindBankAgentSuggestion::getTaskId, taskId));
            if (suggestionCount > 0) {
                updateTaskStatus(taskId, "awaiting_approval");
                updateTaskSummary(taskId, "发现 " + suggestionCount + " 个问题，等待审批");
            } else {
                updateTaskStatus(taskId, "done");
                updateTaskSummary(taskId, "巡检完成，未发现问题");
            }

        } catch (Exception e) {
            log.error("Agent B 巡检失败 taskId={}: {}", taskId, e.getMessage(), e);
            updateTaskStatus(taskId, "failed");
            updateTaskSummary(taskId, "巡检失败：" + e.getMessage());
        }
    }

    /**
     * 反射扫描 @Tool 注解方法，为每个方法创建 DefaultToolExecutor，
     * 构建 toolName → ToolExecutor 映射供 agent loop 调用。
     */
    private Map<String, ToolExecutor> buildToolExecutors(Object tools) {
        Map<String, ToolExecutor> executors = new HashMap<>();
        for (Method method : tools.getClass().getDeclaredMethods()) {
            if (method.isAnnotationPresent(Tool.class)) {
                ToolSpecification spec = ToolSpecifications.toolSpecificationFrom(method);
                executors.put(spec.name(), new DefaultToolExecutor(tools, method));
            }
        }
        return executors;
    }

    /**
     * 记录 Agent 执行步骤（用于前端轨迹可视化 + 调试）。
     * toolOutput 截断至 5000 字符防止 DB 膨胀。
     */
    private void recordStep(Long taskId, int index, String thought,
                           String toolCalled, String toolInput, String toolOutput) {
        String truncatedOutput = toolOutput != null && toolOutput.length() > 5000
            ? toolOutput.substring(0, 5000) + "..." : toolOutput;

        stepMapper.insert(MindBankAgentStep.builder()
            .taskId(taskId)
            .stepIndex(index)
            .thought(thought)
            .toolCalled(toolCalled)
            .toolInput(toolInput)
            .toolOutput(truncatedOutput)
            .build());
    }

    /**
     * 解析 Agent 最终输出中的 JSON 建议数组，写入 mindbank_agent_suggestions。
     * 容错处理：Agent 输出可能被 markdown 代码块包裹或格式偏差，
     * 解析失败不中断任务——巡检完成但没有结构化建议。
     */
    private void parseSuggestions(Long taskId, String agentOutput) {
        try {
            // 提取 JSON 数组（可能被 markdown 代码块包裹）
            String json = agentOutput;
            int start = agentOutput.indexOf('[');
            int end = agentOutput.lastIndexOf(']');
            if (start >= 0 && end > start) {
                json = agentOutput.substring(start, end + 1);
            }

            List<Map<String, Object>> suggestions = objectMapper.readValue(json, new TypeReference<>() {});
            for (Map<String, Object> s : suggestions) {
                suggestionMapper.insert(MindBankAgentSuggestion.builder()
                    .taskId(taskId)
                    .suggestionType((String) s.get("type"))
                    .description((String) s.get("description"))
                    .affectedNotes(objectMapper.writeValueAsString(s.get("affected")))
                    .proposedAction(objectMapper.writeValueAsString(s.get("action")))
                    .status("pending")
                    .build());
            }
        } catch (Exception e) {
            log.warn("解析 Agent 建议失败（可能输出格式不规范）：{}", e.getMessage());
        }
    }

    private void updateTaskStatus(Long taskId, String status) {
        MindBankAgentTask update = new MindBankAgentTask();
        update.setId(taskId);
        update.setStatus(status);
        taskMapper.updateById(update);
    }

    private void updateTaskSummary(Long taskId, String summary) {
        MindBankAgentTask update = new MindBankAgentTask();
        update.setId(taskId);
        update.setSummary(summary);
        taskMapper.updateById(update);
    }
}
