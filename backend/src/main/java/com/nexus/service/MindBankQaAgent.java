package com.nexus.service;

import com.nexus.dto.response.QaAgentResponse;
import com.nexus.entity.MindBankAgentStep;
import com.nexus.entity.MindBankAgentTask;
import com.nexus.mapper.MindBankAgentStepMapper;
import com.nexus.mapper.MindBankAgentTaskMapper;
import dev.langchain4j.agent.tool.Tool;
import dev.langchain4j.agent.tool.ToolExecutionRequest;
import dev.langchain4j.agent.tool.ToolSpecification;
import dev.langchain4j.agent.tool.ToolSpecifications;
import dev.langchain4j.data.message.AiMessage;
import dev.langchain4j.data.message.SystemMessage;
import dev.langchain4j.data.message.ToolExecutionResultMessage;
import dev.langchain4j.data.message.UserMessage;
import dev.langchain4j.model.chat.ChatLanguageModel;
import dev.langchain4j.model.output.Response;
import dev.langchain4j.service.tool.DefaultToolExecutor;
import dev.langchain4j.service.tool.ToolExecutor;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Q&A 检索 Agent（Agent C）：将固定单 Workspace RAG 升级为 agentic 检索。
 * Agent 自主判断查哪几个 Workspace、是否追溯原始文件、答不上来时建议补充材料。
 *
 * 与简单 RAG 的区别：
 * - 简单模式：KnowledgeBasePort.query(指定 slug, 问题) → 单次返回
 * - Agent 模式：Agent 自主探索多个 Workspace，多轮检索后综合回答
 *
 * 复用 Phase 6-6 的自建 agent loop 模式（ToolSpecifications + DefaultToolExecutor），
 * 完整记录每步轨迹到 mindbank_agent_steps 供前端可视化。
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MindBankQaAgent {

    private final LlmConfigService llmConfigService;
    private final MindBankAgentTools agentTools;
    private final MindBankAgentTaskMapper taskMapper;
    private final MindBankAgentStepMapper stepMapper;

    private static final String SYSTEM_PROMPT = """
        你是 Nexus Mindbank 的知识库问答助手（Agent 模式）。用户会问你知识库中的问题，你需要自主检索后回答。

        ## 你的工作流程

        1. 先调用 listWorkspaces 了解有哪些知识库可用
        2. 根据问题判断最可能相关的 1-3 个 Workspace
        3. 调用 searchKnowledgeBase 在这些 Workspace 中检索
        4. 如果检索结果不够充分，尝试换关键词或查其他 Workspace
        5. 如果需要更详细的上下文，调用 readMasterNote 读取完整笔记
        6. 综合所有信息回答用户问题

        ## 回答原则

        - 回答时引用来源 Workspace 名称
        - 如果知识库中没有相关内容，诚实告知并建议用户补充材料
        - 不要编造知识库中没有的信息
        - 回答使用中文，技术术语保留英文

        ## 输出格式

        直接回答问题，不需要 JSON 格式。在回答末尾用以下格式列出引用来源：

        ---
        来源：{Workspace 名称 1}、{Workspace 名称 2}
        """;

    /** Agent loop 最大步数，控制 token 成本 */
    private static final int MAX_STEPS = 15;

    /**
     * Agent 模式 Q&A。
     * @param question            用户问题
     * @param preferredWorkspaceId 用户当前选中的 Workspace（优先检索），可为 null
     * @return 回答结果 + agent task ID（供前端展示轨迹）
     */
    public QaAgentResponse ask(String question, Long preferredWorkspaceId) {
        MindBankAgentTask task = MindBankAgentTask.builder()
            .agentType("qa")
            .triggerType("manual")
            .status("running")
            .workspaceId(preferredWorkspaceId)
            .build();
        taskMapper.insert(task);
        Long taskId = task.getId();

        try {
            ChatLanguageModel model = llmConfigService.resolveModel("mindbank_organize");

            // 从 @Tool 注解方法构建工具规格和执行器映射（复用 Phase 6-6 模式）
            List<ToolSpecification> toolSpecs = ToolSpecifications.toolSpecificationsFrom(agentTools);
            Map<String, ToolExecutor> toolExecutors = buildToolExecutors(agentTools);

            // 构建消息：system prompt + 用户问题（含优先 Workspace 提示）
            List<dev.langchain4j.data.message.ChatMessage> messages = new ArrayList<>();
            messages.add(new SystemMessage(SYSTEM_PROMPT));

            // 有优先 Workspace 时在问题中提示 Agent，但不强制只查该 Workspace
            String enhancedQuestion = preferredWorkspaceId != null
                ? "用户当前在 Workspace ID=" + preferredWorkspaceId + " 中提问，可优先检索该知识库。\n\n问题：" + question
                : question;
            messages.add(new UserMessage(enhancedQuestion));

            int stepIndex = 0;
            String finalAnswer = "";

            // 自建 agent loop：LLM 生成 → 判断 tool call → 执行 → 回传 → 循环
            for (int i = 0; i < MAX_STEPS; i++) {
                Response<AiMessage> response = model.generate(messages, toolSpecs);
                AiMessage aiMessage = response.content();
                messages.add(aiMessage);

                // 无 tool call 表示 Agent 已完成检索，输出最终回答
                if (!aiMessage.hasToolExecutionRequests()) {
                    finalAnswer = aiMessage.text() != null ? aiMessage.text() : "";
                    recordStep(taskId, ++stepIndex, finalAnswer, null, null, null);
                    break;
                }

                // 执行所有 tool calls
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

                    recordStep(taskId, ++stepIndex,
                        thought, req.name(), req.arguments(), toolResult);

                    messages.add(ToolExecutionResultMessage.from(req, toolResult));
                }

                // 达到最大步数仍有 tool call，取最后一条 AiMessage 文本作为答案
                if (i == MAX_STEPS - 1) {
                    finalAnswer = aiMessage.text() != null ? aiMessage.text() : "检索达到最大步数限制，无法完成完整回答";
                    recordStep(taskId, ++stepIndex, finalAnswer, null, null, null);
                }
            }

            // 更新 task 状态
            task.setStatus("done");
            task.setSummary("回答了问题：" + question.substring(0, Math.min(50, question.length())));
            taskMapper.updateById(task);

            return new QaAgentResponse(finalAnswer, taskId);

        } catch (Exception e) {
            log.error("Agent C Q&A 失败 taskId={}: {}", taskId, e.getMessage(), e);
            task.setStatus("failed");
            task.setSummary("失败：" + e.getMessage());
            taskMapper.updateById(task);
            throw e;
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

    /** 记录 Agent 执行步骤，toolOutput 截断至 5000 字符防止 DB 膨胀 */
    private void recordStep(Long taskId, int index, String thought,
                           String toolCalled, String toolInput, String toolOutput) {
        String truncated = toolOutput != null && toolOutput.length() > 5000
            ? toolOutput.substring(0, 5000) + "..." : toolOutput;
        stepMapper.insert(MindBankAgentStep.builder()
            .taskId(taskId).stepIndex(index).thought(thought)
            .toolCalled(toolCalled).toolInput(toolInput).toolOutput(truncated)
            .build());
    }
}
