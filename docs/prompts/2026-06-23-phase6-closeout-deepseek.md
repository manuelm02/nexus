# Phase 6 Closeout — 遗留点修复提示词

执行计划：`docs/plans/2026-06-23-phase6-closeout.md`

---

你正在开发 Nexus 项目，路径为：

```text
/Users/manuelm/Workspace/Projects/Nexus/nexus
```

项目技术栈：

- 后端：Java 21 / Spring Boot 3.3.5 / MyBatis-Plus 3.5.7 / PostgreSQL / Flyway / LangChain4j
- 前端：React 18 / Vite 5 / TypeScript / Tailwind CSS v3 / TanStack Query

请先完整阅读：

1. `AGENTS.md`
2. `CLAUDE.md`
3. `docs/plans/2026-06-23-phase6-closeout.md`
4. 当前 Phase 6 相关代码：
   - `backend/src/main/java/com/nexus/entity/MindBankAgentStep.java`
   - `backend/src/main/java/com/nexus/entity/MindBankAgentSuggestion.java`
   - `backend/src/main/java/com/nexus/port/NotePort.java`
   - `backend/src/main/java/com/nexus/adapter/note/ObsidianNoteAdapter.java`
   - `backend/src/main/java/com/nexus/service/MindBankSuggestionExecutor.java`
   - `frontend/src/pages/Mindbank/components/DocumentList.tsx`
   - `frontend/src/api/mindbank.api.ts`
   - `frontend/src/types/mindbank.types.ts`

本次目标：把 Phase 6 剩余明确遗留点收口，不做无关重构，不启动服务，不改业务命名。

---

## 必须修复的问题

### 1. 修复 Agent JSONB 字段映射

当前迁移 `V1_7__init_mindbank_agent.sql` 中以下字段是 `JSONB`：

- `mindbank_agent_steps.tool_input`
- `mindbank_agent_steps.tool_output`
- `mindbank_agent_suggestions.affected_notes`
- `mindbank_agent_suggestions.proposed_action`

但实体中是普通 `String` 字段，没有 `JsonbTypeHandler`。请修复：

- `MindBankAgentStep` 加 `@TableName(value = "mindbank_agent_steps", autoResultMap = true)`
- `toolInput`、`toolOutput` 加 `@TableField(typeHandler = JsonbTypeHandler.class)`
- `MindBankAgentSuggestion` 加 `@TableName(value = "mindbank_agent_suggestions", autoResultMap = true)`
- `affectedNotes`、`proposedAction` 加 `@TableField(typeHandler = JsonbTypeHandler.class)`

新增或扩展测试，确保这些注解存在。

推荐测试位置：

```text
backend/src/test/java/com/nexus/handler/JsonbTypeHandlerTest.java
```

测试需通过反射断言 `autoResultMap` 和 `typeHandler`，不要只靠人工检查。

---

### 2. 将 orphan note 归档逻辑下沉到 NotePort

当前 `MindBankSuggestionExecutor.executeOrphanNote()` 直接使用 `Files.move(...)` 操作 Obsidian vault。请改为 Port 化：

1. 在 `NotePort` 增加：

```java
/**
 * 将 vault 内的笔记移动到归档目录。实现方必须校验 sourceRelativePath 不能逃逸 vault 根路径。
 *
 * @param sourceRelativePath vault 内相对路径
 * @param archiveFolder      vault 内归档目录名，例如 "_archive"
 * @return 归档后的 vault 内相对路径
 */
String archiveNote(String sourceRelativePath, String archiveFolder);
```

2. 在 `ObsidianNoteAdapter` 实现：

- 使用现有 `resolveSafePath(...)` 做路径安全校验。
- 目标目录也必须在 vault 内。
- 文件名冲突时追加 `-2`、`-3` 等后缀。
- 返回归档后的 vault 内相对路径，使用 `/` 分隔。

3. 修改 `MindBankSuggestionExecutor.executeOrphanNote()`：

- 只调用 `notePort.archiveNote(notePath, "_archive")`
- 不再直接使用 `Files` / `Path`
- 单个归档失败只记录日志，不中断其他文件归档

新增测试：

- `archiveNoteMovesFileInsideVaultAndReturnsRelativePath`
- `archiveNoteRejectsPathTraversal`

推荐测试位置：

```text
backend/src/test/java/com/nexus/adapter/note/ObsidianNoteAdapterTest.java
```

---

### 3. 补齐 Mindbank 文档页的 Master Note / Session Note UI

后端接口已经存在：

- `mindbankApi.getMasterNote(workspaceId)`
- `mindbankApi.getSessionNotes(workspaceId)`

但 `DocumentList.tsx` 目前只渲染文档卡片，没有查看 Master Note 和 Session Note 的 UI。请补齐。

要求：

1. 在 `frontend/src/types/mindbank.types.ts` 增加类型：

```typescript
export interface MasterNote {
  content: string | null
  path: string | null
  message: string | null
}

export interface SessionNote {
  content: string
  path: string
  date: string
}
```

2. 更新 `frontend/src/api/mindbank.api.ts` 中 `getMasterNote` / `getSessionNotes` 的返回类型。

3. 新建：

```text
frontend/src/pages/Mindbank/components/MasterNotePanel.tsx
frontend/src/pages/Mindbank/components/SessionNotesPanel.tsx
```

4. `MasterNotePanel` 要求：

- 用 `useQuery` 拉取 Master Note。
- 加载时显示 spinner。
- 有内容时用 `ReactMarkdown + remarkGfm` 渲染。
- 无内容时显示后端 `message` 或“尚未生成 Master Note”。
- 展示本地路径时要 truncate，不要撑破布局。

5. `SessionNotesPanel` 要求：

- 用 `useQuery` 拉取 Session Notes。
- 显示数量。
- 没有数据时显示“暂无导入速记”。
- 有数据时按列表展示，每条可展开查看 Markdown。
- 使用 `path` 作为 key。

6. 修改 `DocumentList.tsx`：

- 在文档卡片 grid 上方加入两个 panel：

```tsx
<div className="grid gap-3 lg:grid-cols-2">
  <MasterNotePanel workspaceId={workspace.id} />
  <SessionNotesPanel workspaceId={workspace.id} />
</div>
```

- 文档为空时仍然显示这两个 panel，再显示原来的空态。
- 保留原有 `DocumentCard` 和 `PipelineStatus` 行为，不改变 retry step 行为。

---

### 4. 清理 Phase 6 状态文档

修复后更新：

- `README.md`
- `docs/roadmap/task_plan.md`

要求：

- Phase 6-4 到 Phase 6-8 改为完成状态。
- README 中 `Mindbank Agent 层` 不再写“规划中”。
- 增加一句 closeout 说明：Agent JSONB 映射、Master/Session Note UI、orphan note 归档 Port 化已补齐。

执行扫描：

```bash
rg -n "待 Phase|Phase 6\\.6 接入|占位|规划中|TODO 阶段2|尚未实现" README.md docs/roadmap docs/plans frontend/src/pages/Mindbank backend/src/main/java/com/nexus -S
```

如果只剩 legacy `AnythingLlmMindBank` 相关结果，请按下面第 5 点处理。

---

### 5. 处理 legacy `MindBankPort` / `AnythingLlmMindBank`

先确认是否被使用：

```bash
rg -n "MindBankPort|AnythingLlmMindBank" backend/src/main/java backend/src/test -S
```

如果只有接口和 legacy adapter 本身在引用，优先删除：

```text
backend/src/main/java/com/nexus/port/MindBankPort.java
backend/src/main/java/com/nexus/adapter/mindbank/AnythingLlmMindBank.java
```

删除后运行后端 compile。

如果你判断必须保留，则必须：

- 加 `@Deprecated`
- 注释说明 Phase 6 已使用 `KnowledgeBasePort / AnythingLlmClient`
- 不允许默认注册该未实现 bean，把条件改为显式开启：

```java
@ConditionalOnProperty(name = "nexus.mindbank.legacy-store.enabled", havingValue = "true")
```

不要继续保留 `matchIfMissing = true`。

---

## 验证命令

后端 focused tests：

```bash
cd /Users/manuelm/Workspace/Projects/Nexus/nexus/backend
JAVA_HOME=/Users/manuelm/.local/share/mise/installs/java/21.0.2 \
PATH=/Users/manuelm/.local/share/mise/installs/java/21.0.2/bin:/Users/manuelm/.local/share/mise/installs/maven/3.9.2/apache-maven-3.9.2/bin:/usr/bin:/bin:/usr/sbin:/sbin \
mvn -Dtest=JsonbTypeHandlerTest,ObsidianNoteAdapterTest,CrawlServiceTest test
```

后端 compile：

```bash
cd /Users/manuelm/Workspace/Projects/Nexus/nexus/backend
JAVA_HOME=/Users/manuelm/.local/share/mise/installs/java/21.0.2 \
PATH=/Users/manuelm/.local/share/mise/installs/java/21.0.2/bin:/Users/manuelm/.local/share/mise/installs/maven/3.9.2/apache-maven-3.9.2/bin:/usr/bin:/bin:/usr/sbin:/sbin \
mvn -DskipTests compile
```

前端构建：

```bash
cd /Users/manuelm/Workspace/Projects/Nexus/nexus/frontend
pnpm build
```

不要启动前后端服务；用户会自己验证服务运行。

---

## 验收标准

完成后请在最终回复中明确列出：

1. 修改了哪些文件。
2. 哪些 Phase 6 遗留点已关闭。
3. 运行了哪些验证命令，结果是什么。
4. 如果 full backend test 仍失败，说明是否为既有 migration test 文件缺失问题，不要隐瞒。

必须满足：

- Agent JSONB 字段有 `JsonbTypeHandler`。
- orphan note 归档通过 `NotePort`，路径穿越测试通过。
- Mindbank documents tab 能查看 Master Note 和 Session Notes。
- `pnpm build` 通过。
- 后端 focused tests 通过。
