# Inbox Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 Inbox 书签、文档、Quick Note & Memo 的布局、导入、保存、筛选、上传 UI、AI 整理和去重合并问题。

**Architecture:** 继续遵守 Nexus “同一路由、业务共享、视图按复杂度拆分”的响应式架构。`frontend/src/pages/Inbox/index.tsx` 保持业务状态和 mutation 编排，桌面/移动视图只消费 props；可复用复杂逻辑抽到 `Inbox` 子组件或 `utils`。后端只补齐书签保存的业务异常返回，不改变现有 API 路径。

**Tech Stack:** React 18 + TypeScript + Vite + Tailwind v3 + TanStack Query；Spring Boot 3.3.5 + MyBatis-Plus + PostgreSQL。

---

## Scope / Issues

1. 书签和文档页面内容区域没有和整体 Web 页面等宽。
2. 书签批量导入页面异常，当前前端只解析 JSON，却提示 YAML；commit 只提交 createItems，冲突决策会丢。
3. 书签保存接口异常报错，后端 `createBookmark` 未兜底 `IllegalArgumentException`。
4. 书签搜索框旁的 “全局/未读/归档” 选择后无法取消。
5. 文档页上传文件组件 UI 风格不统一。
6. Quick Note & Memo 需要一键清空按钮。
7. 缺少 AI 整理动作的明确启动按钮。
8. Quick Note & Memo title 需要 title 模板。
9. title 里的日期时间格式 `2026-06-14-000952` 时间难读。
10. AI 建议应用后，若当前笔记已有类似原文，必须合并/去重，不能新增重复笔记内容。

## Files To Modify

- `frontend/src/pages/Inbox/index.tsx`
  - 共享状态与 handlers：筛选切换、导入解析/提交、笔记清空、title 模板、AI 建议应用合并。
- `frontend/src/pages/Inbox/InboxDesktopView.tsx`
  - 桌面布局宽度统一；补齐 notes props；确认书签/文档和全站页面同宽。
- `frontend/src/pages/Inbox/InboxMobileView.tsx`
  - 移动端接入同一批 handlers，避免复制业务逻辑。
- `frontend/src/pages/Inbox/components/BookmarkPanel.tsx`
  - 筛选按钮可取消；文案从 “全局” 或 “全部” 统一为产品最终文案。
- `frontend/src/pages/Inbox/components/bookmarks/BookmarkImportDrawer.tsx`
  - 支持 JSON、YAML-like、纯 URL 行三类输入；展示解析错误；commit 包含 create + conflict 决策；移动端 bottom sheet。
- `frontend/src/pages/Inbox/components/documents/PaperlessGateway.tsx`
  - 重做上传组件风格；删除文件内重复定义的 `PaperlessEntryGrid`，改用独立组件。
- `frontend/src/pages/Inbox/components/documents/PaperlessEntryGrid.tsx`
  - 保持单一入口网格实现。
- `frontend/src/pages/Inbox/components/notes/NoteComposer.tsx`
  - 增加一键清空、AI 整理按钮、title 模板选择/应用、可读日期时间生成。
- `frontend/src/pages/Inbox/components/notes/NoteAiSuggestionPanel.tsx`
  - “应用建议”文案明确为“合并到当前笔记”，避免暗示新增。
- `frontend/src/lib/utils.ts`
  - 增加本地可读日期时间格式 helper，例如 `formatLocalDateTimeForTitle()` 返回 `2026-06-14 00:09`。
- `backend/src/main/java/com/nexus/controller/InboxController.java`
  - `createBookmark` 捕获 `IllegalArgumentException` 返回 `ApiResponse.error("BOOKMARK_CREATE_FAILED", e.getMessage())`。
- `backend/src/test/java/com/nexus/controller/InboxControllerTest.java`
  - 增加非法 URL / 重复 URL 创建书签错误响应测试。
- `frontend` 测试文件（如果当前项目没有对应测试基建，至少补手动验收并执行 `pnpm build`）。

## Implementation Tasks

### Task 1: Normalize Inbox Desktop Width

**Files:**
- Modify: `frontend/src/pages/Inbox/InboxDesktopView.tsx`

- [ ] Change desktop root container from `max-w-[1280px]` to the same width pattern used by the main app pages. If other pages use `max-w-[1400px]`, use that; otherwise use `max-w-[1280px] w-full` consistently and remove narrower content columns for bookmarks/documents.
- [ ] For `activeTab === 'bookmarks'` and `activeTab === 'documents'`, change grid from `grid-cols-[minmax(0,760px)_320px]` to `grid-cols-[minmax(0,1fr)_320px]` so the main content fills available width.
- [ ] For documents, keep `PaperlessGateway` in the main column and only keep the explanatory sidebar in `aside`.
- [ ] Verify notes layout remains unchanged except for any new controls added later.

**Acceptance:**
- Desktop `/inbox` bookmarks and documents align visually with other Nexus pages.
- Bookmarks list/search and document gateway no longer feel capped at 760px on wide screens.

### Task 2: Fix Bookmark Filter Toggle State

**Files:**
- Modify: `frontend/src/pages/Inbox/components/BookmarkPanel.tsx`
- Modify: `frontend/src/pages/Inbox/index.tsx`

- [ ] Replace one-way filter clicks with toggle behavior:
  - Clicking active “全局/全部” clears `archived` and `unread`.
  - Clicking active “未读” clears `unread` and keeps/sets `archived: false` only if needed.
  - Clicking active “归档” clears `archived`.
- [ ] Prefer a small helper in `BookmarkPanel`, e.g. `handleFilterClick(mode)`, so the state rules are readable.
- [ ] Ensure every filter change resets `page: 1`.
- [ ] In `index.tsx`, when merging query partials, preserve explicit `undefined` values so clearing works:
  `setBookmarkQuery(prev => ({ ...prev, ...partial }))` is already acceptable; do not filter out undefined.

**Acceptance:**
- “未读” selected -> click “未读” again -> list returns to unfiltered/all state.
- “归档” selected -> click “归档” again -> unfiltered/all state.
- “全局/全部” selected -> click again -> no stuck selected state.

### Task 3: Repair Bookmark Import Parse + Commit

**Files:**
- Modify: `frontend/src/pages/Inbox/index.tsx`
- Modify: `frontend/src/pages/Inbox/components/bookmarks/BookmarkImportDrawer.tsx`

- [ ] Add import drawer local error display via existing `previewError` / `commitError` props.
- [ ] In `index.tsx`, add `importParseError` state and pass it to `BookmarkImportDrawer.previewError`.
- [ ] Implement parser for:
  - JSON array: `[{"url":"https://example.com","title":"Example"}]`
  - YAML-like lines:
    ```
    - url: https://example.com
      title: Example
    ```
  - Plain URL-per-line:
    ```
    https://example.com Example title
    https://openai.com
    ```
- [ ] If parsing yields zero valid URLs, show a clear error and do not call preview.
- [ ] On successful preview, expand at least the “将创建” and “冲突” sections by default to prevent a blank-looking drawer.
- [ ] Fix commit decisions:
  - Include all `preview.createItems` with default `action: 'create'`.
  - Include all `preview.conflictItems` with `decisions.get(sourceIndex) || 'skip'`.
  - Do not include skipItems/invalidItems.
  - For create items, include AI suggestion fields: `finalTitle`, `finalDescription`, `finalTags`, `acceptSuggestedGroup: Boolean(item.suggestedGroupId)`.
- [ ] After successful commit, clear paste text and decisions.

**Acceptance:**
- JSON, YAML-like, and plain URL lists all preview correctly.
- Conflict “更新旧记录/作为新书签/跳过” choices reach backend commit.
- Drawer never appears “异常空白” after clicking preview.

### Task 4: Make Bookmark Save Errors User-Safe

**Files:**
- Modify: `backend/src/main/java/com/nexus/controller/InboxController.java`
- Test: `backend/src/test/java/com/nexus/controller/InboxControllerTest.java`
- Modify if needed: `frontend/src/pages/Inbox/index.tsx`

- [ ] Wrap `createBookmark` body:
  - `IllegalArgumentException` -> `ApiResponse.error("BOOKMARK_CREATE_FAILED", e.getMessage())`
  - unexpected exception -> log error and return `ApiResponse.error("BOOKMARK_CREATE_FAILED", "书签保存失败")`
- [ ] Preserve successful response shape.
- [ ] Add controller tests for invalid URL returning `success=false`, `errorCode=BOOKMARK_CREATE_FAILED`, readable message.
- [ ] Add or verify duplicate URL test returns readable duplicate message.
- [ ] Frontend `createError` should prefer `error.response.data.message`, then `Error.message`, then `保存失败`.

**Acceptance:**
- Saving invalid URL no longer produces raw 500 UI.
- Duplicate bookmark shows “该书签已存在” or equivalent readable message.

### Task 5: Unify Document Upload UI

**Files:**
- Modify: `frontend/src/pages/Inbox/components/documents/PaperlessGateway.tsx`
- Modify: `frontend/src/pages/Inbox/components/documents/PaperlessEntryGrid.tsx`

- [ ] Replace bare `<input type="file">` with a compact Nexus-styled drop/select zone:
  - dashed border or normal `nexus-surface`
  - file icon + selected filename
  - “选择文件” utility button
  - title/tags use `nexus-input`
  - submit/cancel use `nexus-button-primary` / `nexus-button-utility`
- [ ] Keep the actual file input hidden and trigger it from the styled button.
- [ ] Respect disabled state when paperless status is not `connected`.
- [ ] Remove the duplicate `PaperlessEntryGrid` function from `PaperlessGateway.tsx`; import the existing component file and pass `onOpen`.
- [ ] Ensure mobile layout does not overflow.

**Acceptance:**
- Upload area visually matches the rest of Nexus forms/cards.
- There is only one `PaperlessEntryGrid` component implementation.

### Task 6: Add Quick Note & Memo Clear + Title Templates

**Files:**
- Modify: `frontend/src/pages/Inbox/index.tsx`
- Modify: `frontend/src/pages/Inbox/InboxDesktopView.tsx`
- Modify: `frontend/src/pages/Inbox/InboxMobileView.tsx`
- Modify: `frontend/src/pages/Inbox/components/notes/NoteComposer.tsx`
- Modify: `frontend/src/lib/utils.ts`

- [ ] Add helper in `utils.ts`:
  - `formatLocalDateTimeForTitle(date = new Date())` -> `YYYY-MM-DD HH:mm`
  - Do not use `yyyy-MM-dd-HHmmss` for human-facing title templates.
- [ ] In `index.tsx`, add `clearNoteDraft()` that clears title/content/tags, resets kind to current or default according to UX choice, clears `noteAiResult`, clears `lastNoteResult`.
- [ ] Add title template options in `NoteComposer`:
  - Quick Note: `Quick Note - 2026-06-14 00:09`
  - Memo: `Memo - 2026-06-14 00:09`
  - Meeting: `Meeting Notes - 2026-06-14 00:09`
  - Idea: `Idea - 2026-06-14 00:09`
- [ ] Add a small menu/select/button group near title input to apply template. Applying a template overwrites title only, not content/tags.
- [ ] Add “清空” utility button near save actions. If content/title/tags are non-empty, use `window.confirm('清空当前草稿？')` before clearing.

**Acceptance:**
- One click clears current Quick Note/Memo draft.
- Title templates produce readable time like `2026-06-14 00:09`, not `2026-06-14-000952`.

### Task 7: Add Explicit AI Organize Button

**Files:**
- Modify: `frontend/src/pages/Inbox/components/notes/NoteComposer.tsx`
- Modify: `frontend/src/pages/Inbox/InboxDesktopView.tsx`
- Modify: `frontend/src/pages/Inbox/InboxMobileView.tsx`

- [ ] Rename or add the action button so the primary AI action is explicit:
  - Button text: `AI 整理`
  - Tooltip/title: `根据当前内容生成标题、标签和整理后的 Markdown`
- [ ] Keep disabled state: disabled when content is empty, AI unavailable, or analyzing.
- [ ] Keep existing API call `inboxApi.notes.analyze`; this is an organize/analyze preview, not direct save.
- [ ] In the suggestion panel, use wording “应用到当前草稿” or “合并到当前笔记”，not “新增笔记”。

**Acceptance:**
- User can clearly find and trigger AI organization.
- AI response does not auto-save and does not create a new note.

### Task 8: Merge AI Suggestions Without Duplicating Current Note Text

**Files:**
- Modify: `frontend/src/pages/Inbox/index.tsx`
- Modify: `frontend/src/pages/Inbox/components/notes/NoteAiSuggestionPanel.tsx`

- [ ] Add a frontend helper in `index.tsx` or a new local utility:
  - `mergeNoteContent(current: string, suggested?: string): string`
- [ ] Conservative merge rule:
  - If `suggested` is empty: return current.
  - Normalize whitespace and compare paragraphs.
  - If suggested normalized text contains current normalized text, use suggested.
  - If current normalized text contains suggested normalized text, keep current.
  - Otherwise append only suggested paragraphs that are not similar to any existing paragraph.
  - Similarity threshold can be simple Jaccard over lowercase tokens, e.g. >= 0.75 means duplicate.
- [ ] In `onApplySuggestion`:
  - Apply `suggestedTitle`, `suggestedKind`, `suggestedTags`.
  - If `suggestion.cleanedMarkdown` exists, call `setNoteContent(mergeNoteContent(noteContent, suggestion.cleanedMarkdown))`.
  - Clear `noteAiResult` after merge.
- [ ] Add a short Chinese comment above merge helper explaining why conservative merge exists: duplicate notes/content explosion is unacceptable.

**Acceptance:**
- Applying AI suggestion to content that is already similar does not duplicate paragraphs.
- Applying AI suggestion with genuinely new organized sections merges those sections into the current draft.
- No save occurs until user clicks save.

### Task 9: Verification

**Commands:**

- [ ] Frontend build:
  ```bash
  cd frontend && pnpm build
  ```
  Expected: build succeeds.

- [ ] Backend tests:
  ```bash
  cd backend && mvn test
  ```
  Expected: tests pass, including new `InboxControllerTest` cases.

- [ ] Manual browser checks:
  ```bash
  cd frontend && pnpm dev
  ```
  Open `/inbox`.

**Manual Acceptance Checklist:**

- [ ] Bookmarks tab is full page width; list column is not artificially narrow.
- [ ] Documents tab is full page width; upload component matches Nexus input/button/card style.
- [ ] Bookmark save invalid URL shows readable error.
- [ ] Bookmark duplicate URL shows readable error.
- [ ] Bookmark import works for JSON, YAML-like, and plain URL lines.
- [ ] Import conflict decisions commit correctly.
- [ ] “全局/未读/归档” can be toggled off.
- [ ] Quick Note/Memo has clear button and title templates.
- [ ] Title template time is human-readable.
- [ ] `AI 整理` button is visible and disabled/enabled correctly.
- [ ] Applying AI suggestions merges into current draft without duplicate paragraphs.

## Suggested Commit Slices

1. `fix: normalize inbox bookmark and document layout`
2. `fix: repair bookmark filters import and create errors`
3. `feat: improve inbox document upload experience`
4. `feat: add note templates clear and ai merge apply`

