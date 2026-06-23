# Phase 6 Closeout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining Phase 6 gaps so Mindbank & Crawl can be considered feature-complete at code, UI, database-mapping, and documentation levels.

**Architecture:** Keep the existing Phase 6 architecture: Crawl creates `MindBankDocument`, Pipeline writes Obsidian + AnythingLLM through `StoragePort` / `NotePort` / `KnowledgeBasePort`, and Agent tasks persist traces and suggestions. Fix the known incompleteness without broad refactors: add missing UI surfaces, correct PostgreSQL JSONB mappings, move filesystem archive behavior behind `NotePort`, and update project status documents.

**Tech Stack:** Java 21, Spring Boot 3.3.5, MyBatis-Plus 3.5.7, PostgreSQL JSONB, React 18, Vite 5, TypeScript, Tailwind CSS v3, TanStack Query.

---

## Current Confirmed Gaps

1. `Mindbank` documents tab does not expose Master Note viewer or Session Note list, even though backend endpoints already exist:
   - `GET /api/v1/mindbank/workspaces/{id}/master-note`
   - `GET /api/v1/mindbank/workspaces/{id}/session-notes`
2. Agent JSONB columns are mapped as plain `String` fields without `JsonbTypeHandler`, which can fail against PostgreSQL JSONB columns:
   - `mindbank_agent_steps.tool_input`
   - `mindbank_agent_steps.tool_output`
   - `mindbank_agent_suggestions.affected_notes`
   - `mindbank_agent_suggestions.proposed_action`
3. `MindBankSuggestionExecutor.executeOrphanNote()` directly uses `Files.move(...)` instead of going through `NotePort`; it also needs vault-boundary protection for archive operations.
4. Project status docs are stale: roadmap/README still mark parts of Phase 6 as incomplete or planning even though most Agent-layer code exists.
5. `AnythingLlmMindBank` / `MindBankPort` still contains old TODO implementation. It is not used by the active Phase 6 path, but should be clearly marked deprecated or removed if no injection depends on it.

---

## File Impact Map

### Backend

- Modify `backend/src/main/java/com/nexus/entity/MindBankAgentStep.java`
  - Add `autoResultMap = true`
  - Add `@TableField(typeHandler = JsonbTypeHandler.class)` to JSONB fields.
- Modify `backend/src/main/java/com/nexus/entity/MindBankAgentSuggestion.java`
  - Add `autoResultMap = true`
  - Add `@TableField(typeHandler = JsonbTypeHandler.class)` to JSONB fields.
- Modify `backend/src/main/java/com/nexus/port/NotePort.java`
  - Add a method for safe archive/move inside vault.
- Modify `backend/src/main/java/com/nexus/adapter/note/ObsidianNoteAdapter.java`
  - Implement safe archive operation using existing `resolveSafePath`.
- Modify `backend/src/main/java/com/nexus/service/MindBankSuggestionExecutor.java`
  - Replace direct `Files.move(...)` with `notePort.archiveNote(...)`.
  - Remove now-unused direct filesystem imports.
- Add or modify tests:
  - `backend/src/test/java/com/nexus/handler/JsonbTypeHandlerTest.java`
  - `backend/src/test/java/com/nexus/adapter/note/ObsidianNoteAdapterTest.java` or existing nearby note adapter test if present.
  - Optional focused service test for `MindBankSuggestionExecutor` orphan archive dispatch.
- Optional cleanup:
  - `backend/src/main/java/com/nexus/adapter/mindbank/AnythingLlmMindBank.java`
  - `backend/src/main/java/com/nexus/port/MindBankPort.java`

### Frontend

- Modify `frontend/src/api/mindbank.api.ts`
  - Existing `getMasterNote` and `getSessionNotes` already exist; confirm response shapes and reuse.
- Modify `frontend/src/types/mindbank.types.ts`
  - Add explicit `MasterNote` and `SessionNote` types if not already present.
- Modify `frontend/src/pages/Mindbank/components/DocumentList.tsx`
  - Add a top section with Master Note and Session Note panels.
  - Keep existing document card grid.
- Add `frontend/src/pages/Mindbank/components/MasterNotePanel.tsx`
  - Fetch and render Master Note markdown.
- Add `frontend/src/pages/Mindbank/components/SessionNotesPanel.tsx`
  - Fetch and render Session Note list/timeline.
- Modify `frontend/src/pages/Mindbank/MindBankDesktopView.tsx`
  - Ensure the documents tab has enough height and does not hide the new note panels.
- Modify `frontend/src/pages/Mindbank/MindBankMobileView.tsx`
  - Ensure the mobile documents view also uses the same `DocumentList` and remains usable.

### Docs

- Modify `README.md`
  - Update Phase 6 status to reflect code reality after fixes.
- Modify `docs/roadmap/task_plan.md`
  - Check off Phase 6-4 through Phase 6-8 after implementation is verified.
- Optional: append a closeout note to `docs/plans/2026-06-17-mindbank-crawl-phase6.md`.

---

## Task 1: Fix Agent JSONB Mapping

**Files:**
- Modify: `backend/src/main/java/com/nexus/entity/MindBankAgentStep.java`
- Modify: `backend/src/main/java/com/nexus/entity/MindBankAgentSuggestion.java`
- Test: `backend/src/test/java/com/nexus/handler/JsonbTypeHandlerTest.java`

- [ ] **Step 1: Add failing assertions for JSONB handler coverage**

Extend `JsonbTypeHandlerTest` with reflection-based tests that fail until the Agent JSONB fields declare `JsonbTypeHandler`:

```java
@Test
void agentStepJsonbFieldsUseJsonbTypeHandler() throws Exception {
    assertThat(MindBankAgentStep.class.getAnnotation(TableName.class).autoResultMap()).isTrue();
    assertThat(MindBankAgentStep.class.getDeclaredField("toolInput").getAnnotation(TableField.class).typeHandler())
            .isEqualTo(JsonbTypeHandler.class);
    assertThat(MindBankAgentStep.class.getDeclaredField("toolOutput").getAnnotation(TableField.class).typeHandler())
            .isEqualTo(JsonbTypeHandler.class);
}

@Test
void agentSuggestionJsonbFieldsUseJsonbTypeHandler() throws Exception {
    assertThat(MindBankAgentSuggestion.class.getAnnotation(TableName.class).autoResultMap()).isTrue();
    assertThat(MindBankAgentSuggestion.class.getDeclaredField("affectedNotes").getAnnotation(TableField.class).typeHandler())
            .isEqualTo(JsonbTypeHandler.class);
    assertThat(MindBankAgentSuggestion.class.getDeclaredField("proposedAction").getAnnotation(TableField.class).typeHandler())
            .isEqualTo(JsonbTypeHandler.class);
}
```

Imports required:

```java
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.nexus.entity.MindBankAgentStep;
import com.nexus.entity.MindBankAgentSuggestion;
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```bash
cd backend
JAVA_HOME=/Users/manuelm/.local/share/mise/installs/java/21.0.2 \
PATH=/Users/manuelm/.local/share/mise/installs/java/21.0.2/bin:/Users/manuelm/.local/share/mise/installs/maven/3.9.2/apache-maven-3.9.2/bin:/usr/bin:/bin:/usr/sbin:/sbin \
mvn -Dtest=JsonbTypeHandlerTest test
```

Expected before implementation: test fails because Agent entities either lack `autoResultMap = true` or JSONB fields lack `JsonbTypeHandler`.

- [ ] **Step 3: Implement JSONB mapping**

Update `MindBankAgentStep`:

```java
import com.nexus.handler.JsonbTypeHandler;

@TableName(value = "mindbank_agent_steps", autoResultMap = true)
public class MindBankAgentStep {
    ...
    /** 工具入参，JSONB 存储 */
    @TableField(typeHandler = JsonbTypeHandler.class)
    private String toolInput;
    /** 工具返回，JSONB 存储（截断至 5000 字符防膨胀） */
    @TableField(typeHandler = JsonbTypeHandler.class)
    private String toolOutput;
    ...
}
```

Update `MindBankAgentSuggestion`:

```java
import com.nexus.handler.JsonbTypeHandler;

@TableName(value = "mindbank_agent_suggestions", autoResultMap = true)
public class MindBankAgentSuggestion {
    ...
    /** 涉及的笔记/Workspace 名称列表，JSONB */
    @TableField(typeHandler = JsonbTypeHandler.class)
    private String affectedNotes;
    /** 建议的具体操作，JSONB */
    @TableField(typeHandler = JsonbTypeHandler.class)
    private String proposedAction;
    ...
}
```

- [ ] **Step 4: Run focused test and confirm GREEN**

Run the same command from Step 2.

Expected: `JsonbTypeHandlerTest` passes.

---

## Task 2: Move Orphan Note Archive Behind NotePort

**Files:**
- Modify: `backend/src/main/java/com/nexus/port/NotePort.java`
- Modify: `backend/src/main/java/com/nexus/adapter/note/ObsidianNoteAdapter.java`
- Modify: `backend/src/main/java/com/nexus/service/MindBankSuggestionExecutor.java`
- Test: `backend/src/test/java/com/nexus/adapter/note/ObsidianNoteAdapterTest.java` or create it if absent.

- [ ] **Step 1: Extend `NotePort`**

Add an archive method to `NotePort`:

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

- [ ] **Step 2: Add Obsidian adapter tests**

Create `backend/src/test/java/com/nexus/adapter/note/ObsidianNoteAdapterTest.java` if no suitable file exists. Use a temporary directory and mocked `SystemConfigService`.

Test cases:

```java
@ExtendWith(MockitoExtension.class)
class ObsidianNoteAdapterTest {

    @Mock
    private SystemConfigService systemConfigService;

    private Path vault;
    private ObsidianNoteAdapter adapter;

    @BeforeEach
    void setUp() throws IOException {
        vault = Files.createTempDirectory("nexus-vault-");
        when(systemConfigService.get("notes.obsidian.vault_path")).thenReturn(vault.toString());
        adapter = new ObsidianNoteAdapter(systemConfigService);
    }

    @Test
    void archiveNoteMovesFileInsideVaultAndReturnsRelativePath() throws IOException {
        Path sourceDir = vault.resolve("Mindbank");
        Files.createDirectories(sourceDir);
        Files.writeString(sourceDir.resolve("orphan.md"), "# Orphan");

        String archivedPath = adapter.archiveNote("Mindbank/orphan.md", "_archive");

        assertThat(archivedPath).isEqualTo("_archive/orphan.md");
        assertThat(Files.exists(vault.resolve("Mindbank/orphan.md"))).isFalse();
        assertThat(Files.readString(vault.resolve("_archive/orphan.md"))).isEqualTo("# Orphan");
    }

    @Test
    void archiveNoteRejectsPathTraversal() {
        assertThatThrownBy(() -> adapter.archiveNote("../outside.md", "_archive"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("非法路径");
    }
}
```

Imports:

```java
import com.nexus.adapter.note.ObsidianNoteAdapter;
import com.nexus.service.SystemConfigService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;
```

- [ ] **Step 3: Run the adapter test and confirm RED**

Run:

```bash
cd backend
JAVA_HOME=/Users/manuelm/.local/share/mise/installs/java/21.0.2 \
PATH=/Users/manuelm/.local/share/mise/installs/java/21.0.2/bin:/Users/manuelm/.local/share/mise/installs/maven/3.9.2/apache-maven-3.9.2/bin:/usr/bin:/bin:/usr/sbin:/sbin \
mvn -Dtest=ObsidianNoteAdapterTest test
```

Expected before implementation: compile/test failure because `archiveNote` does not exist.

- [ ] **Step 4: Implement `ObsidianNoteAdapter.archiveNote`**

Add to `ObsidianNoteAdapter`:

```java
@Override
public String archiveNote(String sourceRelativePath, String archiveFolder) {
    Path source = resolveSafePath(sourceRelativePath);
    if (!Files.exists(source)) {
        throw new IllegalArgumentException("笔记不存在: " + sourceRelativePath);
    }

    String folder = sanitizeSubFolder(archiveFolder);
    Path archiveDir = resolveSafePath(folder);
    Path target = archiveDir.resolve(source.getFileName()).normalize();
    Path vaultRoot = getVaultRoot();
    if (!target.startsWith(vaultRoot)) {
        throw new IllegalArgumentException("非法归档路径: " + archiveFolder);
    }

    try {
        Files.createDirectories(archiveDir);
        target = nextAvailableArchivePath(target);
        Files.move(source, target);
        return vaultRoot.relativize(target).toString().replace('\\', '/');
    } catch (IOException e) {
        throw new RuntimeException("归档笔记失败: " + sourceRelativePath, e);
    }
}

private Path nextAvailableArchivePath(Path target) {
    if (!Files.exists(target)) {
        return target;
    }
    String name = target.getFileName().toString();
    int dot = name.lastIndexOf('.');
    String baseName = dot >= 0 ? name.substring(0, dot) : name;
    String ext = dot >= 0 ? name.substring(dot) : "";
    int suffix = 2;
    Path candidate = target;
    while (Files.exists(candidate)) {
        candidate = target.getParent().resolve(baseName + "-" + suffix + ext);
        suffix++;
    }
    return candidate;
}
```

- [ ] **Step 5: Update `MindBankSuggestionExecutor.executeOrphanNote`**

Replace direct filesystem logic with:

```java
private String executeOrphanNote(MindBankAgentSuggestion suggestion) {
    List<String> notePaths = parseAffectedNotes(suggestion);

    int archivedCount = 0;
    for (String notePath : notePaths) {
        try {
            notePort.archiveNote(notePath, "_archive");
            archivedCount++;
        } catch (Exception e) {
            log.error("归档笔记失败 {}：{}", notePath, e.getMessage());
        }
    }

    return String.format("已归档 %d 篇孤立笔记至 _archive 目录", archivedCount);
}
```

Remove unused imports:

```java
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
```

- [ ] **Step 6: Run backend focused tests**

Run:

```bash
cd backend
JAVA_HOME=/Users/manuelm/.local/share/mise/installs/java/21.0.2 \
PATH=/Users/manuelm/.local/share/mise/installs/java/21.0.2/bin:/Users/manuelm/.local/share/mise/installs/maven/3.9.2/apache-maven-3.9.2/bin:/usr/bin:/bin:/usr/sbin:/sbin \
mvn -Dtest=ObsidianNoteAdapterTest,JsonbTypeHandlerTest,CrawlServiceTest test
```

Expected: focused tests pass.

---

## Task 3: Add Master Note and Session Note UI

**Files:**
- Modify: `frontend/src/types/mindbank.types.ts`
- Modify: `frontend/src/api/mindbank.api.ts`
- Create: `frontend/src/pages/Mindbank/components/MasterNotePanel.tsx`
- Create: `frontend/src/pages/Mindbank/components/SessionNotesPanel.tsx`
- Modify: `frontend/src/pages/Mindbank/components/DocumentList.tsx`

- [ ] **Step 1: Add explicit frontend types**

In `frontend/src/types/mindbank.types.ts`, add:

```typescript
/** Workspace Master Note 响应 */
export interface MasterNote {
  content: string | null
  path: string | null
  message: string | null
}

/** Workspace Session Note 响应 */
export interface SessionNote {
  content: string
  path: string
  date: string
}
```

- [ ] **Step 2: Use explicit API response types**

In `frontend/src/api/mindbank.api.ts`, import the new types and update methods:

```typescript
import type {
  ...
  MasterNote,
  SessionNote,
} from '../types/mindbank.types'
```

Update:

```typescript
getMasterNote: (workspaceId: number) =>
  apiClient.get<ApiResponse<MasterNote>>(
    `/mindbank/workspaces/${workspaceId}/master-note`,
  ),

getSessionNotes: (workspaceId: number) =>
  apiClient.get<ApiResponse<SessionNote[]>>(
    `/mindbank/workspaces/${workspaceId}/session-notes`,
  ),
```

- [ ] **Step 3: Create `MasterNotePanel.tsx`**

Create `frontend/src/pages/Mindbank/components/MasterNotePanel.tsx`:

```tsx
import { useQuery } from '@tanstack/react-query'
import { BookOpen, ExternalLink, Loader2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { mindbankApi } from '../../../api/mindbank.api'

/** MasterNotePanel 展示当前 Workspace 的 Master Note 内容和本地路径。 */
export function MasterNotePanel({ workspaceId }: { workspaceId: number }) {
  const query = useQuery({
    queryKey: ['mindbank', 'master-note', workspaceId],
    queryFn: async () => {
      const res = await mindbankApi.getMasterNote(workspaceId)
      return res.data.data ?? null
    },
  })

  if (query.isLoading) {
    return (
      <section className="nexus-surface p-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          加载 Master Note...
        </div>
      </section>
    )
  }

  const note = query.data
  const hasContent = note?.content && note.content.trim().length > 0

  return (
    <section className="nexus-surface overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-extrabold text-foreground">Master Note</h3>
        </div>
        {note?.path && (
          <span className="min-w-0 truncate font-mono text-[10px] text-muted-foreground" title={note.path}>
            {note.path}
          </span>
        )}
      </div>
      {hasContent ? (
        <div className="max-h-80 overflow-y-auto px-3 py-3">
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{note.content ?? ''}</ReactMarkdown>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-3 py-4 text-xs text-muted-foreground">
          <ExternalLink className="h-3.5 w-3.5" />
          {note?.message ?? '尚未生成 Master Note'}
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 4: Create `SessionNotesPanel.tsx`**

Create `frontend/src/pages/Mindbank/components/SessionNotesPanel.tsx`:

```tsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { mindbankApi } from '../../../api/mindbank.api'

/** SessionNotesPanel 按导入时间展示当前 Workspace 的 Session Note 列表。 */
export function SessionNotesPanel({ workspaceId }: { workspaceId: number }) {
  const [expandedPath, setExpandedPath] = useState<string | null>(null)
  const query = useQuery({
    queryKey: ['mindbank', 'session-notes', workspaceId],
    queryFn: async () => {
      const res = await mindbankApi.getSessionNotes(workspaceId)
      return res.data.data ?? []
    },
  })

  if (query.isLoading) {
    return (
      <section className="nexus-surface p-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          加载 Session Notes...
        </div>
      </section>
    )
  }

  const notes = query.data ?? []

  return (
    <section className="nexus-surface overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-extrabold text-foreground">Session Notes</h3>
        </div>
        <span className="text-[10px] font-bold text-muted-foreground">{notes.length} 条</span>
      </div>

      {notes.length === 0 ? (
        <p className="px-3 py-4 text-xs text-muted-foreground">暂无导入速记。</p>
      ) : (
        <div className="divide-y divide-border">
          {notes.map((note) => {
            const expanded = expandedPath === note.path
            return (
              <div key={note.path}>
                <button
                  type="button"
                  onClick={() => setExpandedPath(expanded ? null : note.path)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground">{note.date}</p>
                    <p className="truncate font-mono text-[10px] text-muted-foreground">{note.path}</p>
                  </div>
                  {expanded ? (
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                </button>
                {expanded && (
                  <div className="max-h-64 overflow-y-auto bg-muted/20 px-3 py-3">
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{note.content}</ReactMarkdown>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 5: Wire panels into `DocumentList`**

Modify `DocumentList.tsx` imports:

```tsx
import { MasterNotePanel } from './MasterNotePanel'
import { SessionNotesPanel } from './SessionNotesPanel'
```

Replace the final return with:

```tsx
return (
  <div className="space-y-4 p-4 md:p-6">
    <div className="grid gap-3 lg:grid-cols-2">
      <MasterNotePanel workspaceId={workspace.id} />
      <SessionNotesPanel workspaceId={workspace.id} />
    </div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {documents.map((doc) => (
        <DocumentCard
          key={doc.id}
          document={doc}
          onRetryStep={(step) => onRetryStep(doc.id, step)}
        />
      ))}
    </div>
  </div>
)
```

For the empty-document branch, keep note panels visible because a workspace may already have notes even when the document list is empty:

```tsx
if (documents.length === 0) {
  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="grid gap-3 lg:grid-cols-2">
        <MasterNotePanel workspaceId={workspace.id} />
        <SessionNotesPanel workspaceId={workspace.id} />
      </div>
      <DocumentListEmpty workspaceId={workspace.id} />
    </div>
  )
}
```

- [ ] **Step 6: Run frontend build**

Run:

```bash
cd frontend
pnpm build
```

Expected: TypeScript and Vite build pass. Existing Vite large chunk warning is acceptable.

---

## Task 4: Clean Up Stale Phase 6 Status Docs

**Files:**
- Modify: `README.md`
- Modify: `docs/roadmap/task_plan.md`

- [ ] **Step 1: Update README Phase 6 rows**

Update the Phase 6 status table so it reflects the implemented state after Tasks 1-3:

```markdown
| Phase 6-1~6-3 | Mindbank 基础设施 + Settings/Crawl + Notes 页面 | ✅ |
| Phase 6-4~6-5 | Port 抽象层、Workspace/文档管理 UI、5 步 Pipeline、Q&A、Prompt 模板（Layer 1 闭环） | ✅ |
| Phase 6-6~6-8 | Mindbank Agent 双层架构：知识库巡检 Agent、融合自检、检索增强、巡检建议自动执行（Layer 2） | ✅ |
```

Add a note:

```markdown
> Phase 6 closeout 已补齐：Agent JSONB 映射、Master/Session Note 前端查看入口、orphan note 归档 Port 化。
```

- [ ] **Step 2: Update `docs/roadmap/task_plan.md`**

Change:

```markdown
- [ ] Phase 6: Mindbank & Crawl（Pipeline + Agent 双层架构）
...
- [ ] Phase 6-4 ...
- [ ] Phase 6-5 ...
- [ ] Phase 6-6 ...
- [ ] Phase 6-7 ...
- [ ] Phase 6-8 ...
```

To:

```markdown
- [x] Phase 6: Mindbank & Crawl（Pipeline + Agent 双层架构）
...
- [x] Phase 6-4：Port 抽象层 + Mindbank 核心页面（NotePort/StoragePort、Workspace CRUD、文档管理 UI）
- [x] Phase 6-5：5 步确定性 Pipeline + Q&A 基础 + Prompt 模板管理（Layer 1 完整闭环）
- [x] Phase 6-6：Agent 基础设施 + Agent B 知识库巡检（Layer 2，LangChain4j agent loop + 只读巡检 + 审批流）
- [x] Phase 6-7：Agent A 融合自检 + Agent C 检索增强（接入 Pipeline Step 2 + Q&A Agent 模式）
- [x] Phase 6-8：巡检建议自动执行（采纳后自动拆分/合并/修正 Workspace）
```

- [ ] **Step 3: Scan for stale Phase 6 placeholders**

Run:

```bash
rg -n "待 Phase|Phase 6\\.6 接入|占位|规划中|TODO 阶段2|尚未实现" README.md docs/roadmap docs/plans frontend/src/pages/Mindbank backend/src/main/java/com/nexus -S
```

Expected after cleanup:
- No stale Phase 6 placeholder remains in active Mindbank UI or active Phase 6 backend path.
- `AnythingLlmMindBank` may still match if Task 5 is skipped; document it explicitly as deprecated legacy code or remove it in Task 5.

---

## Task 5: Decide Legacy `MindBankPort` Cleanup

**Files:**
- Inspect: `backend/src/main/java/com/nexus/port/MindBankPort.java`
- Inspect: `backend/src/main/java/com/nexus/adapter/mindbank/AnythingLlmMindBank.java`
- Modify or delete depending on decision.

- [ ] **Step 1: Confirm no active injection depends on `MindBankPort`**

Run:

```bash
rg -n "MindBankPort|AnythingLlmMindBank" backend/src/main/java backend/src/test -S
```

Expected current state: only the interface and legacy adapter reference it.

- [ ] **Step 2A: Preferred cleanup if no usage exists**

Delete:

```text
backend/src/main/java/com/nexus/port/MindBankPort.java
backend/src/main/java/com/nexus/adapter/mindbank/AnythingLlmMindBank.java
```

Run:

```bash
cd backend
JAVA_HOME=/Users/manuelm/.local/share/mise/installs/java/21.0.2 \
PATH=/Users/manuelm/.local/share/mise/installs/java/21.0.2/bin:/Users/manuelm/.local/share/mise/installs/maven/3.9.2/apache-maven-3.9.2/bin:/usr/bin:/bin:/usr/sbin:/sbin \
mvn -DskipTests compile
```

Expected: compile passes.

- [ ] **Step 2B: If keeping for future compatibility**

Do not leave active TODO warnings. Add `@Deprecated` and update the class comment:

```java
/**
 * Legacy Phase 1-5 MindBankPort adapter. Phase 6 uses KnowledgeBasePort / AnythingLlmClient.
 * Kept only for backward compatibility; do not inject this into new code.
 */
@Deprecated
```

Also set the conditional default to disabled:

```java
@ConditionalOnProperty(name = "nexus.mindbank.legacy-store.enabled", havingValue = "true")
```

This prevents an unfinished legacy component from being registered by default.

---

## Final Verification

Run focused verification first:

```bash
cd backend
JAVA_HOME=/Users/manuelm/.local/share/mise/installs/java/21.0.2 \
PATH=/Users/manuelm/.local/share/mise/installs/java/21.0.2/bin:/Users/manuelm/.local/share/mise/installs/maven/3.9.2/apache-maven-3.9.2/bin:/usr/bin:/bin:/usr/sbin:/sbin \
mvn -Dtest=JsonbTypeHandlerTest,ObsidianNoteAdapterTest,CrawlServiceTest test
```

Run frontend build:

```bash
cd frontend
pnpm build
```

Run backend compile:

```bash
cd backend
JAVA_HOME=/Users/manuelm/.local/share/mise/installs/java/21.0.2 \
PATH=/Users/manuelm/.local/share/mise/installs/java/21.0.2/bin:/Users/manuelm/.local/share/mise/installs/maven/3.9.2/apache-maven-3.9.2/bin:/usr/bin:/bin:/usr/sbin:/sbin \
mvn -DskipTests compile
```

Optional full backend test:

```bash
cd backend
JAVA_HOME=/Users/manuelm/.local/share/mise/installs/java/21.0.2 \
PATH=/Users/manuelm/.local/share/mise/installs/java/21.0.2/bin:/Users/manuelm/.local/share/mise/installs/maven/3.9.2/apache-maven-3.9.2/bin:/usr/bin:/bin:/usr/sbin:/sbin \
mvn test
```

Known risk from current repo state: full backend tests may fail because old migration tests reference removed migration files (`V1_5__rename_module_keys.sql`, `V1_9__subscriptions_phase4_cleanup.sql`, `V1_10__subscriptions_redesign.sql`). If that still happens, report it as pre-existing and do not hide it.

---

## Acceptance Criteria

- Agent task steps and suggestions can be inserted into PostgreSQL JSONB columns without type errors.
- `orphan_note` suggestion execution archives files through `NotePort` and rejects path traversal.
- Mindbank documents tab shows:
  - Master Note content or clear empty state.
  - Session Note list/timeline or clear empty state.
  - Existing document card grid and retry behavior unchanged.
- Prompt template selection during Crawl import remains functional.
- README and roadmap no longer mark implemented Phase 6 Agent work as planning.
- `pnpm build` passes.
- Focused backend tests pass.
