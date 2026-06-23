# Phase 6-7 — Agent A 融合自检 + Agent C 检索增强提示词

执行计划：`docs/superpowers/plans/2026-06-17-mindbank-crawl-phase6.md`（Phase 6.8 节）  
架构设计：`docs/nexus-mindbank-pipeline-agent-design.md`（第 6.2 + 6.4 节）  
前置：Phase 6-1~6-6 均已完成。Agent 基础设施（loop、工具、状态落库、轨迹可视化）已在 Phase 6-6 验证通过

---

你正在开发 Nexus 项目（路径：`/Users/manuelm/Workspace/Projects/Nexus/nexus`），Spring Boot 3.x 后端 + React 18 + TypeScript 前端。请先阅读 `CLAUDE.md` 和 `AGENTS.md`，再阅读计划文档 Phase 6.8 节和架构设计文档第 6.2 + 6.4 节。

本阶段目标：
1. **Agent A 融合自检**：接入 Pipeline Step 2，当材料较复杂时用多轮自检替代单次 Prompt，提升入库质量
2. **Agent C 检索增强**：升级 Q&A 为 agentic 检索，Agent 自主决定查哪些 Workspace

**核心优势**：Agent 基础设施已在 Phase 6-6 跑通（AiServices / @Tool / agent_tasks / agent_steps），本阶段水到渠成，只需新建两个 Agent 服务 + 接入已有端点。

---

## 第一步：Agent A — MindBankMergeCheckAgent

创建 `backend/src/main/java/com/nexus/service/MindBankMergeCheckAgent.java`：

```java
/**
 * 融合自检 Agent（Agent A）：在 Pipeline Step 2 中调用，对复杂材料进行多轮融合自检。
 * 解决的问题：单次 Prompt 融合长 Master Note 时容易遗漏知识点、章节结构断裂、矛盾判断错。
 *
 * 触发条件（由 MindBankPipelineService.step2Organize 判断）：
 * - Master Note 已存在 AND 新材料 ≥ 1500 字符 → 走 Agent A
 * - 否则 → 走原始单次 Prompt
 *
 * 自检循环最多 3 轮，防止无限循环。每轮记录到 mindbank_agent_steps。
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MindBankMergeCheckAgent {

    private final LlmConfigService llmConfigService;
    private final MindBankAgentTaskMapper taskMapper;
    private final MindBankAgentStepMapper stepMapper;
    private final NotePort notePort;

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
        // 1. 创建 agent_task
        MindBankAgentTask task = MindBankAgentTask.builder()
            .agentType("merge_check")
            .triggerType("auto")
            .status("running")
            .build();
        taskMapper.insert(task);
        Long taskId = task.getId();

        try {
            ChatLanguageModel model = llmConfigService.resolveModel("mindbank_organize");
            if (model == null) throw new IllegalStateException("请先配置 mindbank_organize 模型");

            // 2. 构造初始 Prompt
            String userPrompt = String.format("""
                ## 已有 Master Note

                %s

                ## 新材料

                %s

                ## 任务

                请将新材料融合进已有 Master Note，然后进行自检。输出完整的更新后 Master Note。
                """, existingMaster, newContent);

            // 3. 自检循环
            List<ChatMessage> messages = new ArrayList<>();
            messages.add(SystemMessage.from(SYSTEM_PROMPT));
            messages.add(UserMessage.from(userPrompt));

            String lastOutput = "";
            int stepIndex = 0;

            for (int round = 1; round <= MAX_SELF_CHECK_ROUNDS; round++) {
                Response<AiMessage> response = model.generate(messages);
                String output = response.content().text();

                // 记录步骤
                recordStep(taskId, ++stepIndex,
                    "第 " + round + " 轮融合自检", null, null, output);

                lastOutput = output;

                // 检查是否通过
                if (output.contains("[PASS]")) {
                    log.info("Agent A 融合自检通过，共 {} 轮，taskId={}", round, taskId);
                    break;
                }

                if (round < MAX_SELF_CHECK_ROUNDS) {
                    // 追加到上下文，要求修正
                    messages.add(AiMessage.from(output));
                    messages.add(UserMessage.from(
                        "自检未全部通过，请修正上述问题后重新输出完整 Master Note，再次自检。"));
                } else {
                    log.warn("Agent A 达到最大自检轮数 {}，使用最后一次输出，taskId={}",
                        MAX_SELF_CHECK_ROUNDS, taskId);
                }
            }

            // 4. 提取 Master Note 内容（去掉自检报告部分）
            String masterNote = extractMasterNote(lastOutput);

            // 5. 更新 task 状态
            updateTaskStatus(taskId, "done");
            return masterNote;

        } catch (Exception e) {
            updateTaskStatus(taskId, "failed");
            log.error("Agent A 融合自检失败，回退到单次 Prompt，taskId={}: {}", taskId, e.getMessage());
            throw e;
        }
    }

    /**
     * 从 Agent 输出中提取 Master Note 内容（去掉【自检结果】部分）
     */
    private String extractMasterNote(String output) {
        // 尝试提取【Master Note】标记后的内容
        int idx = output.indexOf("【Master Note】");
        if (idx >= 0) {
            return output.substring(idx + "【Master Note】".length()).trim();
        }
        // 尝试去掉 [PASS] 标记和自检报告
        String cleaned = output.replace("[PASS]", "").trim();
        int checkIdx = cleaned.indexOf("【自检结果】");
        if (checkIdx >= 0) {
            // 找到自检结果后面的 Master Note
            int noteStart = cleaned.indexOf("\n#", checkIdx);
            if (noteStart >= 0) return cleaned.substring(noteStart).trim();
        }
        // 兜底：返回完整输出
        return cleaned;
    }

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
        taskMapper.updateById(MindBankAgentTask.builder().id(taskId).status(status).build());
    }
}
```

## 第二步：修改 Pipeline Step 2 接入 Agent A

修改 `MindBankPipelineService.step2Organize`：

```java
private void step2Organize(Long docId) {
    MindBankDocument doc = getDoc(docId);
    MindBankWorkspace workspace = getWorkspace(doc.getWorkspaceId());

    String newContent = storagePort.readProcessed(doc.getProcessedMinioKey());
    String existingMaster = notePort.readMaster(workspace.getName());
    boolean hasMasterNote = existingMaster != null && !existingMaster.isBlank();

    String masterNoteContent;

    if (!hasMasterNote) {
        // 首次导入：走原始单次 Prompt（organize_init 模板）
        String promptTemplate = getDefaultPromptTemplate("organize_init");
        String prompt = promptTemplate
            .replace("{content}", newContent)
            .replace("{source_url}", buildMinioUrl(doc.getOriginalMinioKey()))
            .replace("{timestamp}", LocalDateTime.now().toString())
            .replace("{workspace_name}", workspace.getName());
        ChatLanguageModel model = llmConfigService.resolveModel("mindbank_organize");
        masterNoteContent = generateWithChunking(model, prompt, newContent);

    } else if (newContent.length() < 1500) {
        // 简单材料：走原始单次 Prompt（organize_merge 模板）
        String promptTemplate = getDefaultPromptTemplate("organize_merge");
        String prompt = promptTemplate
            .replace("{master_note}", existingMaster)
            .replace("{new_content}", newContent)
            .replace("{document_name}", doc.getFileName())
            .replace("{timestamp}", LocalDateTime.now().toString())
            .replace("{workspace_name}", workspace.getName());
        ChatLanguageModel model = llmConfigService.resolveModel("mindbank_organize");
        masterNoteContent = model.generate(prompt);

    } else {
        // 复杂材料：走 Agent A 融合自检
        log.info("材料长度 {} ≥ 1500，启用 Agent A 融合自检，docId={}", newContent.length(), docId);
        try {
            masterNoteContent = mergeCheckAgent.mergeWithSelfCheck(
                existingMaster, newContent, workspace.getName(), docId);
        } catch (Exception e) {
            // Agent A 失败时回退到单次 Prompt
            log.warn("Agent A 失败，回退到单次 Prompt：{}", e.getMessage());
            String promptTemplate = getDefaultPromptTemplate("organize_merge");
            String prompt = promptTemplate
                .replace("{master_note}", existingMaster)
                .replace("{new_content}", newContent)
                .replace("{document_name}", doc.getFileName())
                .replace("{timestamp}", LocalDateTime.now().toString())
                .replace("{workspace_name}", workspace.getName());
            ChatLanguageModel model = llmConfigService.resolveModel("mindbank_organize");
            masterNoteContent = generateWithChunking(model, prompt, newContent);
        }
    }

    putCache(docId, "masterNoteContent", masterNoteContent);
    putCache(docId, "hasMasterNote", String.valueOf(hasMasterNote));
}
```

## 第三步：Agent C — MindBankQaAgent

创建 `backend/src/main/java/com/nexus/service/MindBankQaAgent.java`：

```java
/**
 * Q&A 检索 Agent（Agent C）：将固定单 Workspace RAG 升级为 agentic 检索。
 * Agent 自主判断查哪几个 Workspace、是否追溯原始文件、答不上来时建议补充材料。
 *
 * 与简单 RAG 的区别：
 * - 简单模式：KnowledgeBasePort.query(指定 slug, 问题) → 单次返回
 * - Agent 模式：Agent 自主探索多个 Workspace，多轮检索后综合回答
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

    /**
     * Agent 模式 Q&A。
     * @param question 用户问题
     * @param preferredWorkspaceId 用户当前选中的 Workspace（优先检索）
     * @return 回答结果 + agent task ID（供前端展示轨迹）
     */
    public QaAgentResponse ask(String question, Long preferredWorkspaceId) {
        // 1. 创建 agent_task
        MindBankAgentTask task = MindBankAgentTask.builder()
            .agentType("qa")
            .triggerType("manual")
            .status("running")
            .workspaceId(preferredWorkspaceId)
            .build();
        taskMapper.insert(task);
        Long taskId = task.getId();

        try {
            // 2. 构建 AiServices
            ChatLanguageModel model = llmConfigService.resolveModel("mindbank_organize");
            if (model == null) throw new IllegalStateException("请先配置 mindbank_organize 模型");

            // 注意：使用自建 loop 而非 AiServices，以便拦截每步记录到 DB
            // （复用 Phase 6-6 Agent B 的 loop 模式）
            List<ChatMessage> messages = new ArrayList<>();
            messages.add(SystemMessage.from(SYSTEM_PROMPT));

            // 如果有优先 Workspace，在问题中提示
            String enhancedQuestion = preferredWorkspaceId != null
                ? "用户当前在 Workspace ID=" + preferredWorkspaceId + " 中提问，可优先检索该知识库。\n\n问题：" + question
                : question;
            messages.add(UserMessage.from(enhancedQuestion));

            // 3. 获取 tool specifications
            List<ToolSpecification> toolSpecs = getToolSpecifications();

            // 4. Agent loop
            int stepIndex = 0;
            int maxSteps = 15;
            String finalAnswer = "";

            for (int i = 0; i < maxSteps; i++) {
                Response<AiMessage> response = model.generate(messages, toolSpecs);
                AiMessage aiMessage = response.content();
                messages.add(aiMessage);

                if (!aiMessage.hasToolExecutionRequests()) {
                    // Agent 完成
                    finalAnswer = aiMessage.text();
                    recordStep(taskId, ++stepIndex, finalAnswer, null, null, null);
                    break;
                }

                // 执行 tool calls
                for (ToolExecutionRequest req : aiMessage.toolExecutionRequests()) {
                    recordStep(taskId, ++stepIndex, aiMessage.text(),
                        req.name(), req.arguments(), null);
                    String toolResult = executeToolByName(req.name(), req.arguments());
                    recordStep(taskId, ++stepIndex, null,
                        req.name(), req.arguments(), toolResult);
                    messages.add(ToolExecutionResultMessage.from(req, toolResult));
                }
            }

            // 5. 更新 task
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

    // executeToolByName：根据工具名反射调用 MindBankAgentTools 的方法
    // getToolSpecifications：从 MindBankAgentTools 的 @Tool 方法提取工具定义
    // recordStep：复用 Phase 6-6 的步骤记录逻辑
}
```

`QaAgentResponse`：`record QaAgentResponse(String answer, Long agentTaskId) {}`

## 第四步：Q&A Controller 升级

修改 `MindBankQaController`：

```java
@PostMapping("/{workspaceId}/chat")
public ApiResponse<?> chat(@PathVariable Long workspaceId, @RequestBody QaChatRequest req) {
    MindBankWorkspace workspace = workspaceMapper.selectById(workspaceId);
    if (workspace == null) return ApiResponse.error("Workspace 不存在");

    if (req.agentMode() != null && req.agentMode()) {
        // Agent 模式：走 Agent C
        QaAgentResponse result = qaAgent.ask(req.question(), workspaceId);
        return ApiResponse.ok(Map.of(
            "answer", result.answer(),
            "agentTaskId", result.agentTaskId(),
            "mode", "agent"
        ));
    } else {
        // 简单模式：走固定 RAG
        if (workspace.getAnythingllmSlug() == null) {
            return ApiResponse.error("该 Workspace 尚未完成知识库初始化");
        }
        KnowledgeBaseAnswer answer = knowledgeBasePort.query(
            workspace.getAnythingllmSlug(), req.question());
        return ApiResponse.ok(Map.of(
            "answer", answer.answer(),
            "sources", answer.sourceUrls(),
            "mode", "simple"
        ));
    }
}
```

`QaChatRequest`：`record QaChatRequest(String question, Boolean agentMode) {}`

## 第五步：MindBankAgentTools 扩展

在 `MindBankAgentTools` 中新增供 Agent C 使用的工具：

```java
@Tool("读取 MinIO 中指定文件的处理后内容（Markdown），用于追溯原始材料求证")
public String readProcessedFile(@P("MinIO 文件 key（processedMinioKey）") String key) {
    try {
        String content = storagePort.readProcessed(key);
        return content.length() > 5000
            ? content.substring(0, 5000) + "\n\n[... 内容过长已截断 ...]"
            : content;
    } catch (Exception e) {
        return "读取失败：" + e.getMessage();
    }
}

@Tool("列出指定 Workspace 下的所有文档信息（文件名、来源类型、创建时间），了解知识库收录了哪些材料")
public String listDocuments(@P("Workspace ID") Long workspaceId) {
    List<MindBankDocument> docs = documentMapper.selectList(
        new LambdaQueryWrapper<MindBankDocument>()
            .eq(MindBankDocument::getWorkspaceId, workspaceId)
            .orderByDesc(MindBankDocument::getCreatedAt));
    if (docs.isEmpty()) return "该 Workspace 暂无文档";
    return docs.stream()
        .map(d -> String.format("- %s [%s] %s", d.getFileName(), d.getSourceType(),
            d.getCreatedAt().toLocalDate()))
        .collect(Collectors.joining("\n"));
}
```

## 第六步：前端 Q&A 视图升级

修改 `MindBankQaView.tsx`，新增 Agent 模式开关：

```typescript
// 新增状态
const [agentMode, setAgentMode] = useState(false)
const [agentTaskId, setAgentTaskId] = useState<number | null>(null)

// 顶部操作区新增 Toggle
<div className="flex items-center justify-between border-b px-4 py-2">
  <span className="text-sm">基于《{workspace.name}》知识库问答</span>
  <label className="flex items-center gap-2 text-xs text-muted-foreground">
    <span>Agent 模式</span>
    <Switch checked={agentMode} onCheckedChange={setAgentMode} />
    {/* Agent 模式：AI 自主检索多个知识库，更智能但较慢 */}
  </label>
</div>

// 发送请求时传 agentMode 参数
const sendMessage = async (question: string) => {
  const res = await askWorkspace(workspace.id, question, agentMode)
  if (res.agentTaskId) setAgentTaskId(res.agentTaskId)
  // 追加 AI 消息...
}

// AI 回答下方：Agent 模式时展示执行轨迹（可展开）
{agentMode && agentTaskId && (
  <Collapsible>
    <CollapsibleTrigger className="text-xs text-muted-foreground">
      查看 Agent 思考过程
    </CollapsibleTrigger>
    <CollapsibleContent>
      <AgentTraceView taskId={agentTaskId} />
      {/* 复用 Phase 6-6 的 AgentTraceView 组件 */}
    </CollapsibleContent>
  </Collapsible>
)}
```

## 第七步：mindbank.api.ts 更新

```typescript
// Q&A 升级：新增 agentMode 参数
export const askWorkspace = (workspaceId: number, question: string, agentMode: boolean = false) =>
  apiClient.post(`/mindbank/qa/${workspaceId}/chat`, { question, agentMode })
    .then(res => res.data.data)
```

## 第八步：验证

```bash
pnpm build
mise exec java@21 -- mvn -q test

# Agent A 测试：
# 1. 确保一个 Workspace 已有 Master Note（已通过 Pipeline 入库至少一次）
# 2. 导入一篇较长（>1500 字符）的新材料到该 Workspace
# 3. Pipeline Step 2 应该走 Agent A（检查日志："启用 Agent A 融合自检"）
# 4. 查看 mindbank_agent_tasks 表有 agent_type='merge_check' 的记录
# 5. 查看 mindbank_agent_steps 表有自检轮次记录
# 6. 对比融合质量（可手动导入同一材料到另一个 Workspace 走单次 Prompt 对比）

# Agent C 测试：
# 1. Mindbank → Q&A Tab → 开启 Agent 模式
# 2. 提一个跨 Workspace 的问题（如涉及多个领域的知识）
# 3. 观察 Agent 是否自主查询了多个 Workspace
# 4. 展开执行轨迹，查看 Agent 的思考过程和工具调用
# 5. 关闭 Agent 模式对比：同一问题应该更快但可能漏答

# 回退测试：
# 1. 临时断开 LLM 配置
# 2. 导入材料 → Agent A 应该失败并回退到单次 Prompt
# 3. 日志应有："Agent A 失败，回退到单次 Prompt"
```

**注意事项：**
- Agent A 失败时**必须回退到单次 Prompt**，不能让 Pipeline 因 Agent 问题整体失败
- Agent C 的 maxSteps 设为 15，避免 token 成本失控
- 自建 agent loop 需要正确处理 LangChain4j 的 ToolSpecification 提取（从 @Tool 注解方法生成）
- Agent C 的工具调用结果截断至 5000 字符，防止上下文溢出
- 前端 Agent 模式 Toggle 默认关闭（省 token），用户主动开启
