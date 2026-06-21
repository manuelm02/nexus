# Phase 6-6 — Agent 基础设施 + Agent B 知识库巡检提示词

执行计划：`docs/superpowers/plans/2026-06-17-mindbank-crawl-phase6.md`（Phase 6.7 节）  
架构设计：`docs/nexus-mindbank-pipeline-agent-design.md`（Layer 2 Agent 知识运维层）  
前置：Phase 6-1~6-5 均已完成。Pipeline 可完整跑通，Port 接口（NotePort / StoragePort / KnowledgeBasePort）已验证，Workspace 和文档管理可用

---

你正在开发 Nexus 项目（路径：`/Users/manuelm/Workspace/Projects/Nexus/nexus`），Spring Boot 3.x 后端 + React 18 + TypeScript 前端。请先阅读 `CLAUDE.md` 和 `AGENTS.md`，再阅读计划文档 Phase 6.7 节和架构设计文档第 6 节（Layer 2 Agent 知识运维层）。

本阶段目标：
1. **Agent 基础设施**：DB 表、LangChain4j agent loop、工具注册、状态落库、执行轨迹可视化
2. **Agent B 知识库巡检**：只读 + 出建议 + 用户审批，搭建完整的 human-in-the-loop 流程

**为什么先做 Agent B**：
- 只读 Agent 出错不破坏知识库数据，最安全
- 能把整套 Agent 基础设施（loop + 工具 + 状态 + 轨迹）跑通验证
- 直接服务"让知识体系化、不混乱"这一核心目标

**核心架构约束**：Agent 的"工具"本质上就是 Port 方法的包装。Agent 能做的事 = Port 能力的子集 + 组合。这就是为什么 Phase 6-4 先抽 Port 这么重要——Pipeline 和 Agent 不重复造轮子。

---

## 第一步：Flyway 迁移 V1_20__mindbank_agent.sql

创建 `backend/src/main/resources/db/migration/V1_20__mindbank_agent.sql`：

```sql
-- Agent 任务表（巡检/融合任务的执行记录，支持中断恢复与进度追踪）
CREATE TABLE mindbank_agent_tasks (
    id              BIGSERIAL PRIMARY KEY,
    agent_type      VARCHAR(30) NOT NULL,    -- 'inspect'(B) | 'merge_check'(A) | 'qa'(C)
    trigger_type    VARCHAR(20) NOT NULL,    -- 'manual' | 'auto'
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',
                    -- pending → running → awaiting_approval → done
                    -- pending → running → failed
    workspace_id    BIGINT REFERENCES mindbank_workspaces(id) ON DELETE SET NULL,
    summary         TEXT,                    -- 任务结果摘要
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Agent 执行步骤表（agent loop 每一步，服务两个目的：① 前端轨迹可视化 ② 长任务中断恢复）
CREATE TABLE mindbank_agent_steps (
    id              BIGSERIAL PRIMARY KEY,
    task_id         BIGINT NOT NULL REFERENCES mindbank_agent_tasks(id) ON DELETE CASCADE,
    step_index      INT NOT NULL,
    thought         TEXT,                    -- 模型这一步的思考
    tool_called     VARCHAR(100),            -- 调用的工具名（空=纯思考或最终结论）
    tool_input      JSONB,                   -- 工具入参
    tool_output     JSONB,                   -- 工具返回（截断至 5000 字符防膨胀）
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Agent 建议表（Agent B 巡检产出，等用户审批——human-in-the-loop 核心）
CREATE TABLE mindbank_agent_suggestions (
    id              BIGSERIAL PRIMARY KEY,
    task_id         BIGINT NOT NULL REFERENCES mindbank_agent_tasks(id) ON DELETE CASCADE,
    suggestion_type VARCHAR(40) NOT NULL,
                    -- split_note：Master Note 过长，建议拆分
                    -- merge_workspace：两个 Workspace 内容重叠，建议合并
                    -- resplit_workspace：Workspace 太杂，建议重新切分
                    -- fix_index：知识索引与正文漂移，建议修正
                    -- orphan_note：孤立/长期未更新笔记，建议处理
    description     TEXT NOT NULL,           -- 问题描述（自然语言）
    affected_notes  JSONB,                   -- 涉及的笔记/Workspace 名称列表
    proposed_action JSONB,                   -- 建议的具体操作（结构化，采纳时据此执行）
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending/accepted/ignored
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE mindbank_agent_tasks IS 'Mindbank Agent 任务记录，awaiting_approval 表示巡检完成等待用户审批建议';
COMMENT ON TABLE mindbank_agent_steps IS 'Agent loop 每一步的执行轨迹，用于前端可视化和调试';
COMMENT ON TABLE mindbank_agent_suggestions IS 'Agent B 巡检产出的建议，用户逐条采纳或忽略';
```

## 第二步：Entity / Mapper

创建以下 Entity 和 Mapper（标准 MyBatis-Plus 风格）：

**`MindBankAgentTask.java`**
```java
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@TableName("mindbank_agent_tasks")
public class MindBankAgentTask {
    @TableId(type = IdType.AUTO)
    private Long id;
    private String agentType;       // inspect / merge_check / qa
    private String triggerType;     // manual / auto
    private String status;          // pending / running / awaiting_approval / done / failed
    private Long workspaceId;
    private String summary;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
```

**`MindBankAgentStep.java`**
```java
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
    private String thought;
    private String toolCalled;
    /** 工具入参，JSONB 存储 */
    private String toolInput;
    /** 工具返回，JSONB 存储（截断至 5000 字符） */
    private String toolOutput;
    private LocalDateTime createdAt;
}
```

**`MindBankAgentSuggestion.java`**
```java
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@TableName("mindbank_agent_suggestions")
public class MindBankAgentSuggestion {
    @TableId(type = IdType.AUTO)
    private Long id;
    private Long taskId;
    private String suggestionType;  // split_note / merge_workspace / resplit_workspace / fix_index / orphan_note
    private String description;
    /** 涉及的笔记/Workspace 名称列表，JSONB */
    private String affectedNotes;
    /** 建议的具体操作，JSONB */
    private String proposedAction;
    private String status;          // pending / accepted / ignored
    private LocalDateTime createdAt;
}
```

对应 Mapper：`MindBankAgentTaskMapper`、`MindBankAgentStepMapper`、`MindBankAgentSuggestionMapper`（标准 BaseMapper 继承）

## 第三步：Agent 工具（@Tool 注解，Port 方法包装）

创建 `backend/src/main/java/com/nexus/service/MindBankAgentTools.java`：

```java
/**
 * Agent 的"手脚"：将 Port 方法包装为 LangChain4j @Tool，供 Agent loop 调用。
 * Agent 能做的事 = Port 能力的子集 + 组合。
 *
 * 所有方法均为只读操作，Agent B 不修改任何数据。
 */
@Component
@RequiredArgsConstructor
public class MindBankAgentTools {

    private final NotePort notePort;
    private final KnowledgeBasePort knowledgeBasePort;
    private final MindBankWorkspaceMapper workspaceMapper;
    private final SystemConfigService systemConfigService;

    @Tool("列出 Obsidian vault 中所有笔记的元信息（文件名、路径、文件大小字节数、最后修改时间），用于发现过大或长期未更新的笔记")
    public String listAllNotes() {
        List<NoteMeta> notes = notePort.listNotes();
        // 转为易读格式返回（JSON 或表格文本）
        return notes.stream()
            .map(n -> String.format("%s | %s | %d bytes | %s", n.name(), n.path(), n.sizeBytes(), n.lastModified()))
            .collect(Collectors.joining("\n"));
    }

    @Tool("读取指定 Workspace 的 Master Note 全文。参数：workspaceName（Workspace 名称）")
    public String readMasterNote(@P("Workspace 名称") String workspaceName) {
        String content = notePort.readMaster(workspaceName);
        if (content == null) return "该 Workspace 尚未生成 Master Note";
        // 截断防止上下文溢出（保留前 8000 字符）
        return content.length() > 8000 ? content.substring(0, 8000) + "\n\n[... 内容过长已截断 ...]" : content;
    }

    @Tool("读取知识库全局索引（_index.md），查看所有已整理的知识条目和结构")
    public String readIndex() {
        String subFolder = systemConfigService.get("notes.obsidian.sub_folder", "Mindbank");
        String index = notePort.readIndex(subFolder);
        return index.isBlank() ? "全局索引为空，尚无已整理的知识条目" : index;
    }

    @Tool("列出所有 Workspace 的基本信息（名称、领域标签、文档数量、是否有 Master Note），用于识别重叠或需要合并/拆分的 Workspace")
    public String listWorkspaces() {
        List<MindBankWorkspace> workspaces = workspaceMapper.selectList(null);
        return workspaces.stream()
            .map(w -> String.format("- %s [%s] | 文档数: %d | Master Note: %s",
                w.getName(),
                w.getDomainTag() != null ? w.getDomainTag() : "无标签",
                getDocCount(w.getId()),
                w.getMasterNotePath() != null ? "有" : "无"))
            .collect(Collectors.joining("\n"));
    }

    @Tool("在指定 Workspace 的知识库中搜索内容，用于判断两个 Workspace 之间的内容重叠度。参数：workspaceSlug（AnythingLLM slug）, query（搜索关键词或问题）")
    public String searchKnowledgeBase(
            @P("AnythingLLM workspace slug") String workspaceSlug,
            @P("搜索关键词或问题") String query) {
        try {
            KnowledgeBaseAnswer result = knowledgeBasePort.query(workspaceSlug, query);
            return result.answer() != null ? result.answer() : "未找到相关内容";
        } catch (Exception e) {
            return "搜索失败：" + e.getMessage();
        }
    }
}
```

## 第四步：Agent B 巡检服务（核心）

创建 `backend/src/main/java/com/nexus/service/MindBankInspectAgent.java`：

```java
/**
 * 知识库巡检 Agent（Agent B）：定期或手动扫描整个知识库，自主发现体系性问题，
 * 产出结构化建议等待用户审批。
 *
 * 设计原则：只读不改，任何执行都需用户确认（human-in-the-loop）。
 * 基于 LangChain4j AiServices 构建 agent loop，@Tool 方法由 MindBankAgentTools 提供。
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

    // LangChain4j AI Service 接口
    interface InspectAssistant {
        String chat(String userMessage);
    }

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

    /**
     * 触发巡检任务（异步执行）。
     * @return 创建的 task ID，供前端轮询状态
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

    @Async("mindBankPipelineExecutor")
    public void runInspection(Long taskId) {
        try {
            // 1. 更新状态 → running
            updateTaskStatus(taskId, "running");

            // 2. 构建 LangChain4j AiServices
            ChatLanguageModel model = llmConfigService.resolveModel("mindbank_organize");
            if (model == null) {
                throw new IllegalStateException("请先在 Settings → Mindbank 中配置 mindbank_organize 模型");
            }

            // 使用 ToolExecutionResultListener 拦截每次工具调用，记录到 DB
            AtomicInteger stepIndex = new AtomicInteger(0);

            InspectAssistant assistant = AiServices.builder(InspectAssistant.class)
                .chatLanguageModel(model)
                .tools(agentTools)
                .chatMemory(MessageWindowChatMemory.withMaxMessages(40))
                .build();

            // 3. 执行 agent loop
            String result = assistant.chat("请开始巡检知识库。");

            // 4. 记录最终结果步骤
            recordStep(taskId, stepIndex.incrementAndGet(), result, null, null, null);

            // 5. 解析结构化建议
            parseSuggestions(taskId, result);

            // 6. 更新状态
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
     * 记录 Agent 执行步骤（用于前端轨迹可视化 + 调试）
     */
    private void recordStep(Long taskId, int index, String thought,
                           String toolCalled, String toolInput, String toolOutput) {
        // 截断 toolOutput 防止 DB 膨胀
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
     * 解析 Agent 最终输出中的 JSON 建议数组，写入 mindbank_agent_suggestions
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
            // 即使解析失败也不影响任务状态——巡检完成但没有结构化建议
        }
    }
}
```

**关于 Tool 调用轨迹记录**：

LangChain4j 的 AiServices 在执行 tool 时会自动处理 tool call → tool result 循环。要拦截每步记录到 DB，有两种方式：

1. **ChatModelListener**（推荐）：注册 `ChatModelListener` 监听 tool 调用事件
2. **自建 loop**：不用 AiServices，自己写 while 循环解析 tool_use → 调用方法 → 塞回上下文

建议先用方式 1（AiServices + Listener），如果 LangChain4j 版本不支持 Listener，再回退到方式 2。方式 2 的伪代码：

```java
// 自建 agent loop（备选）
ChatMemory memory = MessageWindowChatMemory.withMaxMessages(40);
memory.add(SystemMessage.from(SYSTEM_PROMPT));
memory.add(UserMessage.from("请开始巡检知识库。"));

int maxSteps = 25;
for (int i = 0; i < maxSteps; i++) {
    Response<AiMessage> response = model.generate(memory.messages(), toolSpecifications);
    AiMessage aiMessage = response.content();
    memory.add(aiMessage);

    if (!aiMessage.hasToolExecutionRequests()) {
        // Agent 完成（无 tool call，输出最终结论）
        recordStep(taskId, i, aiMessage.text(), null, null, null);
        return aiMessage.text();
    }

    // 执行 tool calls
    for (ToolExecutionRequest req : aiMessage.toolExecutionRequests()) {
        recordStep(taskId, i, aiMessage.text(), req.name(), req.arguments(), null);
        String toolResult = executeToolByName(req.name(), req.arguments());
        recordStep(taskId, i, null, req.name(), req.arguments(), toolResult);
        memory.add(ToolExecutionResultMessage.from(req, toolResult));
    }
}
```

## 第五步：Agent Controller

创建 `backend/src/main/java/com/nexus/controller/MindBankAgentController.java`：

```java
/**
 * Mindbank Agent 管理接口。
 * 提供巡检触发、任务查询、建议审批功能。
 */
@RestController
@RequestMapping("/api/v1/mindbank/agent")
@RequiredArgsConstructor
public class MindBankAgentController {

    private final MindBankInspectAgent inspectAgent;
    private final MindBankAgentTaskMapper taskMapper;
    private final MindBankAgentStepMapper stepMapper;
    private final MindBankAgentSuggestionMapper suggestionMapper;

    /** 触发知识库巡检 */
    @PostMapping("/inspect")
    public ApiResponse<Map<String, Long>> triggerInspection() {
        Long taskId = inspectAgent.createInspectionTask("manual");
        inspectAgent.runInspection(taskId); // @Async，不阻塞
        return ApiResponse.ok(Map.of("taskId", taskId));
    }

    /** 查询巡检历史列表 */
    @GetMapping("/tasks")
    public ApiResponse<List<MindBankAgentTask>> listTasks() {
        return ApiResponse.ok(taskMapper.selectList(
            new LambdaQueryWrapper<MindBankAgentTask>()
                .orderByDesc(MindBankAgentTask::getCreatedAt)));
    }

    /** 查询单次巡检详情（含执行步骤 + 建议列表） */
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

    /** 采纳建议 */
    @PostMapping("/suggestions/{id}/approve")
    public ApiResponse<Void> approveSuggestion(@PathVariable Long id) {
        MindBankAgentSuggestion suggestion = suggestionMapper.selectById(id);
        if (suggestion == null) return ApiResponse.error("建议不存在");
        suggestion.setStatus("accepted");
        suggestionMapper.updateById(suggestion);
        // Phase 6.8 可接入：根据 proposed_action 执行实际操作
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
```

`AgentTaskDetailResponse`：`record AgentTaskDetailResponse(MindBankAgentTask task, List<MindBankAgentStep> steps, List<MindBankAgentSuggestion> suggestions) {}`

## 第六步：前端 Agent Tab

### mindbank.api.ts 扩展

```typescript
// Agent
export const triggerInspection = () =>
  apiClient.post('/mindbank/agent/inspect').then(r => r.data.data)

export const listAgentTasks = () =>
  apiClient.get('/mindbank/agent/tasks').then(r => r.data.data)

export const getAgentTaskDetail = (taskId: number) =>
  apiClient.get(`/mindbank/agent/tasks/${taskId}`).then(r => r.data.data)

export const approveSuggestion = (id: number) =>
  apiClient.post(`/mindbank/agent/suggestions/${id}/approve`)

export const ignoreSuggestion = (id: number) =>
  apiClient.post(`/mindbank/agent/suggestions/${id}/ignore`)
```

### mindbank.types.ts 扩展

```typescript
export interface AgentTask {
  id: number; agentType: string; triggerType: string; status: string;
  summary: string | null; createdAt: string; updatedAt: string;
}
export interface AgentStep {
  id: number; stepIndex: number; thought: string | null;
  toolCalled: string | null; toolInput: string | null; toolOutput: string | null;
  createdAt: string;
}
export interface AgentSuggestion {
  id: number; suggestionType: string; description: string;
  affectedNotes: string; proposedAction: string; status: string; createdAt: string;
}
export interface AgentTaskDetail {
  task: AgentTask; steps: AgentStep[]; suggestions: AgentSuggestion[];
}
```

### AgentTab.tsx（Agent Tab 入口）

```
flex flex-col gap-4 p-4
├── 顶部操作区
│   ├── "巡检知识库"按钮（primary，含 Brain icon）
│   │   → 点击触发 triggerInspection mutation
│   │   → 返回 taskId 后自动选中该任务，开始轮询状态（3s）
│   └── 状态提示（running 时展示 spinner + "正在巡检..."）
├── 最新巡检报告区（若有 awaiting_approval 状态的 task）
│   └── <InspectionReport taskDetail={latestTask} />
├── 执行轨迹区（可展开的 Collapsible）
│   └── <AgentTraceView steps={latestTask.steps} />
└── 历史巡检区
    └── <InspectionHistory tasks={tasks} onSelect={setSelectedTask} />
```

### InspectionReport.tsx（建议卡片列表）

```
<div className="space-y-3">
  {suggestions.map(s => <SuggestionCard key={s.id} suggestion={s} />)}
</div>
```

### SuggestionCard.tsx（单条建议）

```
<div className="nexus-surface p-4 space-y-2">
  ├── 顶行：类型 chip（颜色编码：split_note=黄 merge=蓝 fix_index=紫 orphan=灰）
  │         + status badge（pending/accepted/ignored）
  ├── 描述文本（text-sm）
  ├── 涉及笔记列表（parsed from affectedNotes JSON，每项可点击跳转 Notes 页）
  ├── 建议操作（parsed from proposedAction JSON，灰色 text-xs）
  └── 操作按钮（仅 status=pending 时展示）：
      [采纳] primary 按钮 → approveSuggestion mutation
      [忽略] ghost 按钮 → ignoreSuggestion mutation
      （操作后刷新任务详情）
</div>
```

**类型 chip 中文映射**：
- split_note → 建议拆分
- merge_workspace → 建议合并
- resplit_workspace → 建议重新切分
- fix_index → 索引修正
- orphan_note → 孤立笔记

### AgentTraceView.tsx（执行轨迹）

```
<div className="space-y-2">
  {steps.map(step => (
    <div key={step.id} className="text-xs border-l-2 pl-3 py-1">
      ├── step.thought 非空：显示"💭 思考：{thought}"（灰色斜体）
      ├── step.toolCalled 非空：
      │   显示"🔧 调用 {toolCalled}"（蓝色）
      │   Collapsible 展开查看 toolInput / toolOutput（代码格式，截断）
      └── 无 tool 且有 thought：最终结论步骤
    </div>
  ))}
</div>
```

### InspectionHistory.tsx（历史巡检时间线）

```
<div className="space-y-2">
  {tasks.map(task => (
    <button onClick={() => onSelect(task.id)} className="w-full text-left nexus-surface p-3">
      ├── 日期 + 触发方式（手动/自动）
      ├── 状态 badge（对应颜色）
      └── summary 摘要（若有）
    </button>
  ))}
</div>
```

## 第七步：Mindbank Tab 接线

替换 Agent Tab 的占位区域：

```typescript
{activeTab === 'agent' && <AgentTab />}
```

AgentTab 不依赖当前选中的 Workspace（巡检是全局性的）。

## 第八步：验证

```bash
pnpm build
mise exec java@21 -- mvn -q test
mise exec java@21 -- mvn spring-boot:run -Dspring-boot.run.profiles=local
# 确认 V1_20 migration applied，无启动错误

# 手动测试（需至少 2 个 Workspace 已完成 Pipeline，有 Master Note）：
# 1. Mindbank → Agent Tab → 点击"巡检知识库"
# 2. 观察状态从 running → awaiting_approval / done
# 3. 查看执行轨迹：Agent 调用了哪些工具、思考了什么
# 4. 若有建议：点击采纳/忽略，验证状态变更
# 5. 查看历史巡检列表，点击可查看详情
```

**注意事项：**
- Agent B 系统提示词可能需要根据实际 LLM 表现调优（不同模型对工具调用的支持度不同）
- Agent 步骤轨迹截断规则：toolOutput > 5000 字符时截断，防止 DB 和前端膨胀
- 建议采纳后的实际执行逻辑（根据 proposed_action 拆分/合并 Workspace）在 Phase 6.8 实现
- 自建 agent loop vs AiServices：如果 LangChain4j 版本的 AiServices 对 tool 调用结果拦截支持不够，退回自建 while 循环（见第四步备选方案）
- JSON 解析建议时需容错：Agent 输出可能包含 markdown 代码块包裹或格式偏差
