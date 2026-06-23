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

- [x] Bookmark bulk import is included in the first implementation batch.
- [x] AI must not fetch webpage metadata/content in the first pass; analyze URL/title/notes only.
- [x] Bookmark smart groups are explicit persisted groups, not virtual tag-only groups.
- [x] Note consolidation scans only Nexus-created notes under `OBSIDIAN_INBOX_DIR`.
- [x] paperless configuration must be editable from Settings under an Inbox section.

Confirmed defaults:

```text
Bulk import: yes, but preview/commit only.
Metadata fetch: no for first pass; use URL/title only.
Smart groups: persisted bookmark groups with rules and assignments.
Note scan: Nexus-created notes only.
Settings: add scoped Inbox settings for paperless, Obsidian, and bookmark behavior.
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
- Create: `backend/src/main/java/com/nexus/service/BookmarkSmartGroupService.java`
- Create: `backend/src/main/java/com/nexus/dto/request/BookmarkAnalyzeRequest.java`
- Create: `backend/src/main/java/com/nexus/dto/response/BookmarkAnalyzeResponse.java`
- Create: `backend/src/main/resources/db/migration/V1_8__init_bookmark_smart_groups.sql`
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
- Evaluate persisted smart group rules and include matched/suggested groups in the response.
- If LLM missing, return `aiAvailable=false` and deterministic fields only.

Frontend:

- Paste URL.
- Click "AI 整理".
- Show review panel.
- User edits final title/tags/description.
- User confirms suggested smart group assignment.
- Save uses existing create endpoint.

Acceptance:

- Analyze does not create a bookmark.
- Duplicate/conflict is visible before saving.
- User can bypass AI and save manually.
- New bookmarks can be assigned to persisted smart groups.

## Phase 4: Bookmark Bulk Import

**Files:**

- Create: `backend/src/main/java/com/nexus/service/BookmarkImportService.java`
- Create: `backend/src/main/java/com/nexus/dto/request/BookmarkImportPreviewRequest.java`
- Create: `backend/src/main/java/com/nexus/dto/response/BookmarkImportPreviewResponse.java`
- Create: `backend/src/main/java/com/nexus/dto/request/BookmarkImportCommitRequest.java`
- Create: `backend/src/main/java/com/nexus/dto/response/BookmarkSmartGroupResponse.java`
- Modify: `backend/src/main/java/com/nexus/controller/InboxController.java`
- Create: `frontend/src/pages/Inbox/components/bookmarks/BookmarkImportDrawer.tsx`
- Create: `frontend/src/pages/Inbox/components/bookmarks/BookmarkConflictReview.tsx`
- Create: `frontend/src/pages/Inbox/components/bookmarks/BookmarkSmartGroupPanel.tsx`

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
- Include deterministic smart group matches and AI group suggestions.
- Never write data.

Commit behavior:

- Require explicit decisions for conflict items.
- Require explicit confirmation before assigning imported bookmarks to AI-suggested groups.
- Create/update/skip according to decisions.
- Return success/failure summary.

Acceptance:

- No import writes until commit.
- Conflict decisions are explicit.
- Smart group assignments are previewed before write.
- Invalid rows are visible and not silently dropped.

## Phase 5: Bookmark Tag And Smart Group Workbench

**Files:**

- Create: `backend/src/main/java/com/nexus/dto/response/BookmarkTagSummaryResponse.java`
- Create: `backend/src/main/java/com/nexus/dto/request/BookmarkSmartGroupRequest.java`
- Modify: `backend/src/main/java/com/nexus/service/BookmarkService.java`
- Modify: `backend/src/main/java/com/nexus/service/BookmarkSmartGroupService.java`
- Modify: `backend/src/main/java/com/nexus/controller/InboxController.java`
- Create: `frontend/src/pages/Inbox/components/bookmarks/BookmarkTagWorkbench.tsx`
- Create: `frontend/src/pages/Inbox/components/bookmarks/BookmarkSmartGroupPanel.tsx`

Endpoints:

```http
GET  /api/v1/inbox/bookmarks/tags
POST /api/v1/inbox/bookmarks/tags/suggest
GET  /api/v1/inbox/bookmarks/groups
POST /api/v1/inbox/bookmarks/groups
PATCH /api/v1/inbox/bookmarks/groups/{id}
DELETE /api/v1/inbox/bookmarks/groups/{id}
POST /api/v1/inbox/bookmarks/groups/preview
POST /api/v1/inbox/bookmarks/groups/apply
```

Behavior:

- Return tag counts.
- Suggest possible merges with AI when configured.
- Do not auto-merge tags in first pass.
- CRUD persisted smart groups.
- Preview group rule matches before applying.
- Apply group assignments only after confirmation.

Acceptance:

- User can filter by tag.
- User can see tag counts.
- AI suggestions remain advisory.
- User can create smart groups and use them for future classification.

## Phase 6: Settings Inbox Integration Panel

**Files:**

- Create: `backend/src/main/java/com/nexus/service/InboxSettingsService.java`
- Create: `backend/src/main/java/com/nexus/dto/request/InboxSettingsUpdateRequest.java`
- Create: `backend/src/main/java/com/nexus/dto/response/InboxSettingsResponse.java`
- Modify: `backend/src/main/java/com/nexus/controller/SettingsController.java`
- Modify: `frontend/src/pages/Settings/index.tsx`
- Modify: `frontend/src/pages/Settings/SettingsDesktopView.tsx`
- Modify: `frontend/src/pages/Settings/SettingsMobileView.tsx`
- Create: `frontend/src/pages/Settings/components/InboxSettingsPanel.tsx`
- Create: `frontend/src/pages/Settings/components/PaperlessSettingsCard.tsx`
- Create: `frontend/src/pages/Settings/components/ObsidianSettingsCard.tsx`
- Create: `frontend/src/pages/Settings/components/BookmarkSettingsCard.tsx`

Endpoints:

```http
GET   /api/v1/settings/inbox
PATCH /api/v1/settings/inbox
POST  /api/v1/settings/inbox/paperless/test
POST  /api/v1/settings/inbox/obsidian/test
```

Settings fields:

```text
inbox.paperless.enabled
inbox.paperless.base_url
inbox.paperless.api_token
inbox.paperless.open_in_new_tab
inbox.paperless.default_upload_tags

inbox.obsidian.enabled
inbox.obsidian.vault_path
inbox.obsidian.inbox_dir
inbox.obsidian.file_naming_pattern
inbox.obsidian.consolidation_dir

inbox.bookmarks.ai_assist_enabled
inbox.bookmarks.bulk_import_enabled
inbox.bookmarks.strip_tracking_params
inbox.bookmarks.default_unread
inbox.bookmarks.smart_groups_enabled
```

Behavior:

- Store paperless API token encrypted.
- Never return raw paperless token to frontend.
- Return `paperlessTokenConfigured` metadata instead.
- Token field supports replace and clear.
- Paperless test connection returns connected/not configured/unauthorized/unreachable/unexpected response.
- Obsidian test validates path and writability without leaving a permanent file.

Acceptance:

- Settings has a dedicated Inbox panel.
- User can configure paperless without editing env files.
- Inbox paperless empty state can link users to Settings.
- Token is masked and never appears in API responses.

## Phase 7: Paperless Gateway

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
- Gateway reads Settings first, with env/application properties as fallback.

## Phase 8: Note AI Analyze

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
- Existing-note hints scan only Nexus-created notes under the configured Obsidian Inbox directory.

## Phase 9: Note Consolidation Preview

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

## Phase 10: Verification

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
  - configure paperless in Settings and test connection
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
2. paperless：只做接入层和功能入口层。Nexus 不保存 documents 表，提供 Settings 配置、upload/list/detail/status 和 paperless 页面 deep links。
3. 笔记：Quick Note / Memo 仍写入 Obsidian Markdown。增加 AI 标题、分类、标签、folder、cleaned Markdown、action items 建议，以及后续 consolidation preview/write。

强制约束：
- 不要接入 Linkding API，不要添加 LINKDING_* 配置。
- 不要 hardcode DeepSeek/OpenAI key。
- LLM 必须走 Nexus 现有模型配置解析方式。
- AI endpoint 都是 advisory，preview/analyze 不能写数据。
- LLM 未配置时返回 aiAvailable=false，并保留非 AI 基础功能。
- paperless 是事实源，不要创建本地 documents 表。
- paperless base URL/token 必须可以在 Settings 的 Inbox 分区配置；token 加密保存且不回显。
- Quick Note / Memo 不落 PostgreSQL 业务表。
- UI 必须遵守 DESIGN.md：Compact Workbench、8px radius、无嵌套卡片、无营销 hero、无新 UI 库。
- 同一路由 /inbox，业务逻辑在 index.tsx 共享，复杂桌面/移动视图拆组件。

执行顺序：
1. 先完成 UI shell 重构，保证现有功能不回归。
2. 实现 BookmarkUrlNormalizer 和测试。
3. 实现持久化 Bookmark Smart Groups、/bookmarks/analyze 和前端 AI review panel。
4. 实现 /bookmarks/import/preview、/commit 和冲突 review UI，包含智能分组预览。
5. 实现 Settings Inbox 配置区，覆盖 paperless/Obsidian/bookmark 行为配置。
6. 实现 paperless status + entry grid，从 Settings 读取配置。
7. 实现 /notes/analyze 和 Note AI suggestion UI。
8. 最后实现 note consolidation preview/write，只扫描 Nexus 写入的 Obsidian Inbox。

验证：
- cd frontend && pnpm build
- cd backend && JAVA_HOME=/Users/manuelm/.local/share/mise/installs/java/21.0.2 PATH=/Users/manuelm/.local/share/mise/installs/java/21.0.2/bin:/Users/manuelm/.local/share/mise/installs/maven/3.9.2/apache-maven-3.9.2/bin:/usr/bin:/bin:/usr/sbin:/sbin mvn test

不要开始写代码前跳过上述文档。
```
