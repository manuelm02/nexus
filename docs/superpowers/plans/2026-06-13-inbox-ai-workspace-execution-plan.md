# Inbox AI Workspace Execution Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor Inbox into a compact AI-assisted capture workspace for bookmarks, paperless gateway access, and Quick Note / Memo workflows.

**Architecture:** Keep `/inbox` as one route with one shared orchestration layer. Extend the existing Phase 3 backend instead of replacing it: bookmarks remain Nexus-native, paperless remains an adapter, and notes remain Obsidian Markdown writes. Add AI endpoints as advisory preview/analyze flows so users confirm before writes.

**Tech Stack:** Spring Boot 3.3.5, Java 21, MyBatis-Plus, PostgreSQL, React 18, Vite 5, TypeScript, TanStack Query, Tailwind CSS v3, existing Nexus UI classes.

---

## Required Reading

- `AGENTS.md`
- `DESIGN.md`
- `docs/superpowers/specs/2026-06-13-inbox-ai-workspace-design.md`
- `docs/superpowers/plans/2026-06-13-inbox-phase-3.md`
- `frontend/src/pages/Inbox/index.tsx`
- `backend/src/main/java/com/nexus/service/BookmarkService.java`

## Non-Negotiable Constraints

- Do not depend on Linkding.
- Do not create local paperless document tables.
- Do not turn Quick Note / Memo into a full notes app.
- Do not hardcode DeepSeek/OpenAI/API keys.
- Use existing Nexus LLM configuration resolution patterns.
- Missing LLM config must degrade to deterministic non-AI behavior.
- Preview endpoints must not write data.
- All frontend UI must match existing compact Nexus `DESIGN.md`.

## Phase 0: Confirm Scope Before Coding

- [ ] Confirm whether bookmark bulk import is included in first implementation batch.
- [ ] Confirm whether AI may fetch webpage metadata/content or only analyze URL/title supplied by the user.
- [ ] Confirm whether smart groups are virtual tag-derived groups or explicit persisted groups.
- [ ] Confirm whether note consolidation scans only Nexus-created notes under `OBSIDIAN_INBOX_DIR`.

Recommended answer for all four:

```text
Bulk import: yes, but preview/commit only.
Metadata fetch: no for first pass; use URL/title only.
Smart groups: virtual tag-derived groups.
Note scan: Nexus-created notes only.
```

## Phase 1: Frontend UI Shell Redesign

**Files:**

- Modify: `frontend/src/pages/Inbox/index.tsx`
- Modify: `frontend/src/pages/Inbox/InboxDesktopView.tsx`
- Modify: `frontend/src/pages/Inbox/InboxMobileView.tsx`
- Modify: `frontend/src/pages/Inbox/inbox.shared.ts`
- Create: `frontend/src/pages/Inbox/components/shared/StatusChip.tsx`
- Create: `frontend/src/pages/Inbox/components/shared/CompactToolbar.tsx`
- Move/refactor existing panels into subfolders.

Steps:

- [ ] Snapshot current behavior by running `cd frontend && pnpm build`.
- [ ] Keep `index.tsx` as the single query/mutation/state owner.
- [ ] Redesign desktop shell as:

```text
Header
Capture Rail
Workspace Tabs
Main Panel + Context Panel
```

- [ ] Redesign mobile shell as:

```text
Header
Segmented Tabs
Compact Capture Action
Single Panel
Bottom Sheet for review flows
```

- [ ] Do not implement AI behavior in this phase; preserve existing create/list/upload/save flows.
- [ ] Run `cd frontend && pnpm build`.

Acceptance:

- Existing bookmark CRUD, paperless upload/list, and note save still work.
- Desktop and mobile have separate view components.
- No nested cards, no oversized hero, no new UI library.

## Phase 2: Bookmark URL Normalization

**Files:**

- Create: `backend/src/main/java/com/nexus/service/BookmarkUrlNormalizer.java`
- Modify: `backend/src/main/java/com/nexus/service/BookmarkService.java`
- Test: `backend/src/test/java/com/nexus/service/BookmarkUrlNormalizerTest.java`
- Test: `backend/src/test/java/com/nexus/service/BookmarkServiceTest.java`

Steps:

- [ ] Implement tracking parameter removal based on the reference script.
- [ ] Normalize URL by lowercasing host, removing fragment, trimming trailing slash, preserving meaningful query params.
- [ ] Replace the current simple `normalizeUrl` method in `BookmarkService`.
- [ ] Add tests:
  - removes `utm_source`
  - removes `fbclid`
  - lowercases host
  - removes fragment
  - preserves non-tracking query params
  - keeps `http://` and `https://` validation
- [ ] Run backend targeted tests with Java 21.

Command:

```bash
cd backend && JAVA_HOME=/Users/manuelm/.local/share/mise/installs/java/21.0.2 PATH=/Users/manuelm/.local/share/mise/installs/java/21.0.2/bin:/Users/manuelm/.local/share/mise/installs/maven/3.9.2/apache-maven-3.9.2/bin:/usr/bin:/bin:/usr/sbin:/sbin mvn test -Dtest=BookmarkUrlNormalizerTest,BookmarkServiceTest
```

## Phase 3: Bookmark AI Analyze

**Files:**

- Create: `backend/src/main/java/com/nexus/service/BookmarkAiService.java`
- Create: `backend/src/main/java/com/nexus/dto/request/BookmarkAnalyzeRequest.java`
- Create: `backend/src/main/java/com/nexus/dto/response/BookmarkAnalyzeResponse.java`
- Modify: `backend/src/main/java/com/nexus/controller/InboxController.java`
- Modify: `frontend/src/api/inbox.api.ts`
- Modify: `frontend/src/types/domain.types.ts`
- Create: `frontend/src/pages/Inbox/components/bookmarks/BookmarkCaptureBar.tsx`
- Create: `frontend/src/pages/Inbox/components/bookmarks/BookmarkAiReviewPanel.tsx`

Endpoint:

```http
POST /api/v1/inbox/bookmarks/analyze
```

Behavior:

- Deterministically normalize URL.
- Detect exact duplicate by normalized URL.
- Detect possible conflict when normalized URL matches but title differs.
- If LLM configured, suggest title, description, tags, and group.
- If LLM missing, return `aiAvailable=false` and deterministic fields only.

Frontend:

- Paste URL.
- Click "AI 整理".
- Show review panel.
- User edits final title/tags/description.
- Save uses existing create endpoint.

Acceptance:

- Analyze does not create a bookmark.
- Duplicate/conflict is visible before saving.
- User can bypass AI and save manually.

## Phase 4: Bookmark Bulk Import

**Files:**

- Create: `backend/src/main/java/com/nexus/service/BookmarkImportService.java`
- Create: `backend/src/main/java/com/nexus/dto/request/BookmarkImportPreviewRequest.java`
- Create: `backend/src/main/java/com/nexus/dto/response/BookmarkImportPreviewResponse.java`
- Create: `backend/src/main/java/com/nexus/dto/request/BookmarkImportCommitRequest.java`
- Modify: `backend/src/main/java/com/nexus/controller/InboxController.java`
- Create: `frontend/src/pages/Inbox/components/bookmarks/BookmarkImportDrawer.tsx`
- Create: `frontend/src/pages/Inbox/components/bookmarks/BookmarkConflictReview.tsx`

Endpoints:

```http
POST /api/v1/inbox/bookmarks/import/preview
POST /api/v1/inbox/bookmarks/import/commit
```

Preview behavior:

- Accept pasted text or parsed array from frontend.
- Support simple YAML list with `url` and `title`.
- Categorize items into create / skip / conflict / invalid.
- Use AI only for advisory conflict confidence and tag suggestions.
- Never write data.

Commit behavior:

- Require explicit decisions for conflict items.
- Create/update/skip according to decisions.
- Return success/failure summary.

Acceptance:

- No import writes until commit.
- Conflict decisions are explicit.
- Invalid rows are visible and not silently dropped.

## Phase 5: Bookmark Tag Workbench

**Files:**

- Create: `backend/src/main/java/com/nexus/dto/response/BookmarkTagSummaryResponse.java`
- Modify: `backend/src/main/java/com/nexus/service/BookmarkService.java`
- Modify: `backend/src/main/java/com/nexus/controller/InboxController.java`
- Create: `frontend/src/pages/Inbox/components/bookmarks/BookmarkTagWorkbench.tsx`

Endpoints:

```http
GET  /api/v1/inbox/bookmarks/tags
POST /api/v1/inbox/bookmarks/tags/suggest
```

Behavior:

- Return tag counts.
- Suggest possible merges with AI when configured.
- Do not auto-merge tags in first pass.

Acceptance:

- User can filter by tag.
- User can see tag counts.
- AI suggestions remain advisory.

## Phase 6: Paperless Gateway

**Files:**

- Create: `backend/src/main/java/com/nexus/dto/response/PaperlessGatewayStatusResponse.java`
- Create: `backend/src/main/java/com/nexus/service/PaperlessGatewayService.java`
- Modify: `backend/src/main/java/com/nexus/controller/InboxController.java`
- Modify: `frontend/src/api/inbox.api.ts`
- Modify: `frontend/src/types/domain.types.ts`
- Create: `frontend/src/pages/Inbox/components/documents/PaperlessGateway.tsx`
- Create: `frontend/src/pages/Inbox/components/documents/PaperlessEntryGrid.tsx`
- Create: `frontend/src/pages/Inbox/components/documents/RecentDocumentList.tsx`

Endpoint:

```http
GET /api/v1/inbox/documents/status
```

Entry cards:

- Documents
- Inbox
- Tags
- Correspondents
- Document Types
- Saved Views
- Tasks / Processing
- Settings

Acceptance:

- Missing config state is scoped to paperless panel.
- Entry cards open paperless pages through generated links.
- Existing list/upload/detail remains available.

## Phase 7: Note AI Analyze

**Files:**

- Create: `backend/src/main/java/com/nexus/service/NoteAiService.java`
- Create: `backend/src/main/java/com/nexus/dto/request/NoteAnalyzeRequest.java`
- Create: `backend/src/main/java/com/nexus/dto/response/NoteAnalyzeResponse.java`
- Modify: `backend/src/main/java/com/nexus/controller/InboxController.java`
- Modify: `frontend/src/api/inbox.api.ts`
- Modify: `frontend/src/types/domain.types.ts`
- Create: `frontend/src/pages/Inbox/components/notes/NoteComposer.tsx`
- Create: `frontend/src/pages/Inbox/components/notes/NoteAiSuggestionPanel.tsx`
- Create: `frontend/src/pages/Inbox/components/notes/NoteSavedState.tsx`

Endpoint:

```http
POST /api/v1/inbox/notes/analyze
```

Behavior:

- Suggest title.
- Suggest kind.
- Suggest tags.
- Suggest category.
- Suggest folder.
- Produce cleaned Markdown.
- Extract action items.
- If LLM missing, return `aiAvailable=false`.

Frontend:

- "保存原文"
- "应用建议并保存"

Acceptance:

- Analyze does not write files.
- Save still works without LLM.
- User can edit all suggestions before saving.

## Phase 8: Note Consolidation Preview

**Files:**

- Create: `backend/src/main/java/com/nexus/service/NoteConsolidationService.java`
- Create: `backend/src/main/java/com/nexus/dto/request/NoteConsolidatePreviewRequest.java`
- Create: `backend/src/main/java/com/nexus/dto/response/NoteConsolidatePreviewResponse.java`
- Modify: `backend/src/main/java/com/nexus/controller/InboxController.java`
- Create: `frontend/src/pages/Inbox/components/notes/NoteConsolidationPanel.tsx`

Endpoints:

```http
POST /api/v1/inbox/notes/consolidate/preview
POST /api/v1/inbox/notes/consolidate/write
```

Rules:

- Only read Nexus-created notes under `OBSIDIAN_INBOX_DIR`.
- Preview endpoint does not write files.
- Write endpoint requires explicit confirmation.
- Source paths must be included in final Markdown front matter.

Acceptance:

- User can generate a consolidation preview.
- User can edit before write.
- Files outside Obsidian inbox dir are not read.

## Phase 9: Verification

Backend:

```bash
cd backend && JAVA_HOME=/Users/manuelm/.local/share/mise/installs/java/21.0.2 PATH=/Users/manuelm/.local/share/mise/installs/java/21.0.2/bin:/Users/manuelm/.local/share/mise/installs/maven/3.9.2/apache-maven-3.9.2/bin:/usr/bin:/bin:/usr/sbin:/sbin mvn test
```

Frontend:

```bash
cd frontend && pnpm build
```

Manual QA:

- Desktop `/inbox`:
  - save bookmark
  - analyze bookmark
  - import preview
  - resolve conflict
  - upload document
  - open paperless entry link
  - save raw note
  - apply note AI suggestion and save
- Mobile `/inbox`:
  - tab switching
  - add bookmark bottom sheet
  - conflict review bottom sheet
  - paperless entry grid
  - note AI suggestion sheet

## DeepSeek Implementation Prompt

Use this after the design scope is confirmed:

```text
你是资深全栈工程师，请在 Nexus 项目中实施 Inbox Phase 3.1：AI Capture Workspace。

必须先阅读：
- AGENTS.md
- DESIGN.md
- docs/superpowers/specs/2026-06-13-inbox-ai-workspace-design.md
- docs/superpowers/plans/2026-06-13-inbox-ai-workspace-execution-plan.md
- docs/superpowers/plans/2026-06-13-inbox-phase-3.md

目标：
把当前 /inbox 从简单三 tab CRUD 重构为 AI 辅助收纳工作台：
1. 书签：Nexus 原生，不依赖 Linkding。增加 URL 归一化、AI 标签/标题/描述建议、冲突检测、批量导入 preview/commit、标签工作台。
2. paperless：只做接入层和功能入口层。Nexus 不保存 documents 表，提供 upload/list/detail/status 和 paperless 页面 deep links。
3. 笔记：Quick Note / Memo 仍写入 Obsidian Markdown。增加 AI 标题、分类、标签、folder、cleaned Markdown、action items 建议，以及后续 consolidation preview/write。

强制约束：
- 不要接入 Linkding API，不要添加 LINKDING_* 配置。
- 不要 hardcode DeepSeek/OpenAI key。
- LLM 必须走 Nexus 现有模型配置解析方式。
- AI endpoint 都是 advisory，preview/analyze 不能写数据。
- LLM 未配置时返回 aiAvailable=false，并保留非 AI 基础功能。
- paperless 是事实源，不要创建本地 documents 表。
- Quick Note / Memo 不落 PostgreSQL 业务表。
- UI 必须遵守 DESIGN.md：Compact Workbench、8px radius、无嵌套卡片、无营销 hero、无新 UI 库。
- 同一路由 /inbox，业务逻辑在 index.tsx 共享，复杂桌面/移动视图拆组件。

执行顺序：
1. 先完成 UI shell 重构，保证现有功能不回归。
2. 实现 BookmarkUrlNormalizer 和测试。
3. 实现 /bookmarks/analyze 和前端 AI review panel。
4. 实现 /bookmarks/import/preview、/commit 和冲突 review UI。
5. 实现 paperless status + entry grid。
6. 实现 /notes/analyze 和 Note AI suggestion UI。
7. 最后实现 note consolidation preview/write。

验证：
- cd frontend && pnpm build
- cd backend && JAVA_HOME=/Users/manuelm/.local/share/mise/installs/java/21.0.2 PATH=/Users/manuelm/.local/share/mise/installs/java/21.0.2/bin:/Users/manuelm/.local/share/mise/installs/maven/3.9.2/apache-maven-3.9.2/bin:/usr/bin:/bin:/usr/sbin:/sbin mvn test

不要开始写代码前跳过上述文档。
```
