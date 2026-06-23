package com.nexus.service;

import com.nexus.entity.MindBankAgentStep;
import com.nexus.entity.MindBankAgentTask;
import com.nexus.mapper.MindBankAgentStepMapper;
import com.nexus.mapper.MindBankAgentTaskMapper;
import dev.langchain4j.data.message.AiMessage;
import dev.langchain4j.data.message.ChatMessage;
import dev.langchain4j.data.message.SystemMessage;
import dev.langchain4j.data.message.UserMessage;
import dev.langchain4j.model.chat.ChatLanguageModel;
import dev.langchain4j.model.output.Response;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * 融合自检 Agent（Agent A）：在 Pipeline Step 2 中调用，对复杂材料进行多轮融合自检。
 * 解决的问题：单次 Prompt 融合长 Master Note 时容易遗漏知识点、章节结构断裂、矛盾判断错。
 *
 * 触发条件（由 MindBankPipelineService.step2Organize 判断）：
 * - Master Note 已存在 AND 新材料 ≥ 1500 字符 → 走 Agent A
 * - 否则 → 走原始单次 Prompt
 *
 * 自检循环最多 3 轮，防止无限循环。每轮记录到 mindbank_agent_steps。
 * Agent A 失败时由调用方回退到单次 Prompt，不中断 Pipeline。
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MindBankMergeCheckAgent {

    private final LlmConfigService llmConfigService;
    private final MindBankAgentTaskMapper taskMapper;
    private final MindBankAgentStepMapper stepMapper;

    /** 最大自检轮数，防止无限循环和 token 成本失控 */
    private static final int MAX_SELF_CHECK_ROUNDS = 3;

    private static final String SYSTEM_PROMPT = """
        你是 Nexus Mindbank 的知识融合专家。你的任务是将新材料高质量地融合进已有的 Master Note。

        ## 融合流程

        1. **分析新材料**：列出新材料中的所有核心知识点
        2. **对比判断**：逐个判断每个知识点与现有 Master Note 的关系：
           - 全新概念：需要新增章节
           - 补充内容：扩展已有章节
           - 与已有内容矛盾：标注 [更新] 并说明差异
           - 重复内容：跳过
        3. **决定位置**：为每个新知识点确定在 Master Note 中的插入位置
        4. **生成新版**：输出完整的更新后 Master Note

        ## 自检清单

        生成完 Master Note 后，逐条检查以下项目：
        - [ ] 新材料中的所有知识点是否都已融入？是否有遗漏？
        - [ ] 是否制造了与已有内容的矛盾（不含标注 [更新] 的合理更新）？
        - [ ] 章节结构是否连贯？是否有断裂或孤立段落？
        - [ ] 知识地图/目录索引是否与正文同步？

        如果自检发现问题，在下一轮中修正。如果全部通过，输出最终版本。

        ## 输出格式

        每轮输出：
        ```
        【自检结果】
        - 遗漏检查：通过/未通过（说明）
        - 矛盾检查：通过/未通过（说明）
        - 结构检查：通过/未通过（说明）
        - 索引检查：通过/未通过（说明）

        【Master Note】
        （完整 Master Note 内容）
        ```

        全部通过时，在最前面加上 `[PASS]` 标记。
        """;

    /**
     * 执行融合自检，返回最终 Master Note 内容。
     *
     * @param existingMaster 现有 Master Note 全文
     * @param newContent     新材料内容
     * @param workspaceName  Workspace 名称（用于上下文）
     * @param documentId     文档 ID（关联 agent_task）
     * @return 融合后的 Master Note 内容
     */
    public String mergeWithSelfCheck(String existingMaster, String newContent,
                                      String workspaceName, Long documentId) {
        MindBankAgentTask task = MindBankAgentTask.builder()
            .agentType("merge_check")
            .triggerType("auto")
            .status("running")
            .build();
        taskMapper.insert(task);
        Long taskId = task.getId();

        try {
            ChatLanguageModel model = llmConfigService.resolveModel("mindbank_organize");

            // 构造初始 Prompt：已有 Master Note + 新材料 + 融合指令
            String userPrompt = String.format("""
                ## 已有 Master Note

                %s

                ## 新材料

                %s

                ## 任务

                请将新材料融合进已有 Master Note，然后进行自检。输出完整的更新后 Master Note。
                """, existingMaster, newContent);

            // 自检循环：LLM 生成 → 检查 [PASS] 标记 → 未通过则追加修正指令
            List<ChatMessage> messages = new ArrayList<>();
            messages.add(SystemMessage.from(SYSTEM_PROMPT));
            messages.add(UserMessage.from(userPrompt));

            String lastOutput = "";
            int stepIndex = 0;

            for (int round = 1; round <= MAX_SELF_CHECK_ROUNDS; round++) {
                Response<AiMessage> response = model.generate(messages);
                String output = response.content().text();
                if (output == null) output = "";

                // 记录每轮自检输出到 DB，供前端轨迹可视化
                recordStep(taskId, ++stepIndex,
                    "第 " + round + " 轮融合自检", null, null, output);

                lastOutput = output;

                // [PASS] 标记表示自检全部通过，可提前退出
                if (output.contains("[PASS]")) {
                    log.info("Agent A 融合自检通过，共 {} 轮，taskId={}", round, taskId);
                    break;
                }

                if (round < MAX_SELF_CHECK_ROUNDS) {
                    // 未通过：将上轮输出加入上下文，要求 LLM 修正后重新输出
                    messages.add(AiMessage.from(output));
                    messages.add(UserMessage.from(
                        "自检未全部通过，请修正上述问题后重新输出完整 Master Note，再次自检。"));
                } else {
                    log.warn("Agent A 达到最大自检轮数 {}，使用最后一次输出，taskId={}",
                        MAX_SELF_CHECK_ROUNDS, taskId);
                }
            }

            // 提取 Master Note 内容（去掉自检报告部分）
            String masterNote = extractMasterNote(lastOutput);

            updateTaskStatus(taskId, "done");
            return masterNote;

        } catch (Exception e) {
            updateTaskStatus(taskId, "failed");
            log.error("Agent A 融合自检失败，taskId={}: {}", taskId, e.getMessage());
            throw e;
        }
    }

    /**
     * 从 Agent 输出中提取 Master Note 内容（去掉【自检结果】部分）。
     * 优先按【Master Note】标记提取；找不到标记时尝试去掉 [PASS] 和自检报告；
     * 兜底返回清理后的完整输出，确保调用方总能拿到可写入的内容。
     */
    private String extractMasterNote(String output) {
        // 优先提取【Master Note】标记后的内容
        int idx = output.indexOf("【Master Note】");
        if (idx >= 0) {
            return output.substring(idx + "【Master Note】".length()).trim();
        }
        // 去掉 [PASS] 标记
        String cleaned = output.replace("[PASS]", "").trim();
        // 尝试跳过自检报告，从第一个 markdown 标题开始
        int checkIdx = cleaned.indexOf("【自检结果】");
        if (checkIdx >= 0) {
            int noteStart = cleaned.indexOf("\n#", checkIdx);
            if (noteStart >= 0) return cleaned.substring(noteStart).trim();
        }
        // 兜底：返回完整输出
        return cleaned;
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

    private void updateTaskStatus(Long taskId, String status) {
        MindBankAgentTask update = new MindBankAgentTask();
        update.setId(taskId);
        update.setStatus(status);
        taskMapper.updateById(update);
    }
}
