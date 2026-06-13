# Inbox AI Workspace Design

> Status: draft for review  
> Scope: Inbox UI / interaction / AI-assisted workflows only. No code implementation in this phase.  
> Base state: Phase 3 already has Nexus-native bookmarks, paperless-ngx adapter, and Obsidian Quick Note / Memo writer.

## 1. Product Direction

Inbox should become a compact capture and triage workspace, not a generic three-tab CRUD page.

The core idea:

- **Bookmarks**: Nexus-native Linkding-like bookmark manager with AI-assisted import, tagging, conflict review, and smart grouping.
- **Documents**: paperless-ngx gateway layer. Nexus provides upload, search/list entry points, status, and deep links. paperless remains the document system.
- **Notes**: lightweight Quick Note / Memo capture with AI-assisted title, tags, category, folder suggestion, and later consolidation. It should not become a full note-taking system.

The page should remain consistent with Nexus' current design standard: compact workbench, dense but readable, quiet navy system, 8px surfaces, no marketing hero, no decorative gradients, no large card stacks.

## 2. Existing State Summary

Current frontend:

- `/inbox` uses shared data orchestration in `frontend/src/pages/Inbox/index.tsx`.
- Desktop and mobile views already split into `InboxDesktopView.tsx` and `InboxMobileView.tsx`.
- Three shared panels exist:
  - `BookmarkPanel.tsx`
  - `DocumentPanel.tsx`
  - `QuickNotePanel.tsx`

Current backend:

- `BookmarkService` implements Nexus-native bookmark CRUD, search, tag filter, unread/archive, and duplicate protection through `normalized_url`.
- `PaperlessDocumentClient` proxies paperless-ngx list/upload/detail.
- `ObsidianMarkdownWriter` writes Quick Note / Memo Markdown files to Obsidian.

Current weakness:

- UI is functionally correct but too flat: each tab is a simple single-column panel.
- Bookmarks do not yet use AI for tag governance, conflict review, import preview, or grouping.
- paperless is represented as a small upload/list panel rather than a clear integration gateway.
- Notes are a plain form; no AI title/category/tag/folder suggestion, no follow-up consolidation flow.
- Mobile uses the same panel logic but still feels like compressed desktop interaction.

## 3. Design Alternatives

### Option A: Minimal Visual Uplift

Keep the current three panels and only redesign cards, spacing, and form density.

Pros:

- Fastest.
- Lowest backend risk.
- Mostly CSS/component work.

Cons:

- Does not use AI meaningfully.
- Does not solve import/conflict/tagging workflow.
- Inbox still feels like three unrelated forms.

### Option B: AI Capture Workbench

Keep three top-level areas, but redesign each around a primary workflow:

- Bookmarks: paste/import -> AI analyze -> conflict/tag review -> save.
- Documents: paperless gateway -> upload/list/deep link.
- Notes: capture -> AI classify -> save/consolidate.

Pros:

- Best fit for Nexus as an AI Knowledge OS.
- Builds on current backend instead of replacing it.
- Keeps scope controlled while introducing strong product differentiation.
- Easy to implement incrementally.

Cons:

- Requires several new backend AI endpoints and UI states.
- Needs careful fallback when LLM config is missing.

Recommendation: **Option B**.

### Option C: Full Knowledge Hub

Merge bookmarks, documents, and notes into one universal inbox timeline with cross-source search, AI clustering, and relationship graph.

Pros:

- Ambitious long-term direction.

Cons:

- Too large for Phase 3.1.
- Blurs source ownership.
- Risks turning paperless/Obsidian into duplicated systems.

Reject for now. Consider after Mindbank / Crawl are redesigned.

## 4. Recommended Information Architecture

Use `/inbox` as one route.

Desktop layout:

```text
Header
  Title: Inbox
  Subtitle: 捕获、整理和分发信息入口
  Right: integration status chips

Capture Rail
  One-line command input:
    URL / note / file drop
  Mode chips:
    书签 / 文档 / 笔记
  Primary action changes by mode

Workspace Tabs
  书签整理
  Paperless
  Quick Note

Main Workspace
  Left: active workflow panel
  Right: context / AI suggestions / recent activity
```

Mobile layout:

```text
Header
  Inbox + compact status icon

Segmented tabs
  书签 / 文档 / 笔记

Primary action
  Sticky compact capture input or bottom action button

Panel
  Single-column list
  AI review and edit flows open as bottom sheets
```

Do not put page sections inside nested cards. Use full-width workbench bands and individual cards only for repeated rows, dialogs, and review items.

## 5. Bookmark Workflow

### 5.1 Core User Stories

1. User pastes one URL and saves it with minimal typing.
2. Nexus normalizes the URL and strips tracking parameters.
3. Nexus asks the LLM to suggest title, tags, summary/description, and smart group.
4. Nexus checks duplicates and potential conflicts.
5. User can accept AI suggestions, edit them, or save without AI.
6. User can bulk import URL/title data and review the import plan before writing anything.

### 5.2 Script Features To Productize

Reference script:

```text
/Users/manuelm/Knowledge/homelab/linkding/import_to_linkding.py
```

Useful behaviors to convert into Nexus features:

- `normalize_url`:
  - remove tracking params
  - lower-case host
  - remove fragment
  - trim trailing slash
- `detect_conflicts`:
  - exact URL + title -> skip
  - normalized URL same but title differs -> conflict
  - otherwise create
- `resolve_conflicts_with_ai`:
  - AI can decide if new and existing bookmark are the same content
  - output confidence
  - user still confirms conflict handling
- `categorize_with_ai`:
  - prefer existing tags
  - create short Chinese tags when no match
  - keep tag names consistent
- `sync_bundles`:
  - map Linkding bundle idea into Nexus "smart groups"
  - first version should be virtual groups derived from tags, not a new complex hierarchy

Do not carry over:

- hardcoded Linkding token / DeepSeek key
- direct Linkding API dependency
- CLI confirmation flow
- any secret logging

### 5.3 Bookmark UI Design

Primary desktop components:

- `BookmarkCaptureBar`
  - URL input
  - optional title field hidden behind "更多"
  - Save button
  - "AI 整理" toggle, default on when LLM is configured
- `BookmarkAiReviewPanel`
  - normalized URL diff
  - suggested title
  - suggested description
  - suggested tags
  - conflict status
  - final action: 保存 / 跳过 / 继续编辑
- `BookmarkImportDrawer`
  - paste YAML/JSON/CSV-like text
  - upload file
  - dry-run analysis
  - result groups: will create / duplicate skip / conflict review / invalid
- `BookmarkConflictReview`
  - side-by-side new vs existing
  - AI verdict: same / different / low confidence
  - user action: 更新旧记录 / 作为新书签 / 跳过
- `BookmarkTagWorkbench`
  - all tags
  - AI suggested merges
  - unused tags
  - per-tag counts
- `BookmarkList`
  - filters: 全部 / 未读 / 已归档 / 未分类 / 冲突待处理
  - search
  - tag chips
  - compact rows with title, domain, tags, unread/archive, created date

Mobile behavior:

- Single "添加" button opens a bottom sheet.
- URL paste is the first field.
- AI suggestions appear as editable chips, not a second full-width panel.
- Conflict review uses stacked cards: new item first, existing item second, action bar at bottom.
- Bulk import is allowed on mobile only through text paste; file upload can remain desktop-first.

### 5.4 Bookmark Backend Additions

Add AI-assisted endpoints without changing existing CRUD contract:

```http
POST /api/v1/inbox/bookmarks/analyze
POST /api/v1/inbox/bookmarks/import/preview
POST /api/v1/inbox/bookmarks/import/commit
POST /api/v1/inbox/bookmarks/tags/suggest
```

Suggested DTOs:

```text
BookmarkAnalyzeRequest
- url
- title?
- existingTags?

BookmarkAnalyzeResponse
- originalUrl
- normalizedUrl
- trackingParamsRemoved[]
- domain
- suggestedTitle
- suggestedDescription
- suggestedTags[]
- suggestedGroup?
- duplicateStatus: none | exact_duplicate | possible_conflict
- conflictCandidate?
- aiAvailable
- confidence

BookmarkImportPreviewRequest
- items[] { url, title? }

BookmarkImportPreviewResponse
- summary { createCount, skipCount, conflictCount, invalidCount }
- createItems[]
- skipItems[]
- conflictItems[]
- invalidItems[]

BookmarkImportCommitRequest
- decisions[] { sourceIndex, action: create | update | skip, finalTitle?, finalTags?, finalDescription? }
```

LLM usage rule:

- Use existing Nexus model resolution pattern, not hardcoded DeepSeek config.
- If no model is configured, return `aiAvailable=false` and deterministic non-AI results.
- AI suggestions must be advisory; user confirmation controls writes.

## 6. Paperless Gateway Workflow

paperless should be a gateway, not a clone.

### 6.1 Product Boundary

Nexus should provide:

- Configuration status.
- Upload document.
- Recent documents.
- Basic search/list entry.
- Document metadata preview.
- Deep links into paperless for advanced pages.

Nexus should not provide:

- local document table
- OCR pipeline
- full paperless settings clone
- correspondent/type/tag management unless exposed as simple deep links first
- local document editing as source of truth

### 6.2 Paperless UI Design

Desktop panel:

```text
Paperless Gateway
  Status strip:
    Connected / Not configured / Request failed

  Primary actions:
    Upload Document
    Open paperless

  Entry grid:
    Documents
    Inbox
    Tags
    Correspondents
    Document Types
    Saved Views
    Tasks / Processing
    Settings

  Recent Documents:
    compact list from API
```

Each entry card should have:

- icon
- label
- short description
- count if cheap to fetch
- action: open in Nexus if supported, otherwise open in paperless

Mobile:

- Status row at top.
- Upload button as main action.
- Entry grid becomes two-column compact tiles.
- Recent documents list below.

### 6.3 Backend Additions

Keep existing document list/upload/detail.

Add optional gateway status endpoint:

```http
GET /api/v1/inbox/documents/status
```

Response:

```text
configured
reachable
baseUrlConfigured
lastCheckedAt
message?
entryLinks[]
```

Entry links can be generated from `PAPERLESS_BASE_URL`:

- `/documents`
- `/inbox`
- `/tags`
- `/correspondents`
- `/document_types`
- `/saved_views`
- `/tasks`
- `/settings`

If exact paperless route differs by version, make these centralized constants and keep UI labels decoupled.

## 7. Quick Note / Memo AI Workflow

### 7.1 Product Boundary

Notes are not a full notes app.

They are two capture types:

- **Quick Note**: longer rough note, can become a permanent note later.
- **Memo**: short fact, reminder, idea, or daily log fragment.

Nexus should help the user save, classify, and periodically consolidate. It should not replace Obsidian browsing, backlinking, or long-form editing.

### 7.2 AI Capabilities

First version:

- suggest title
- suggest kind: quick_note / memo
- suggest tags
- suggest category
- suggest Obsidian subfolder
- suggest cleaned-up Markdown
- extract action items if present

Second version:

- existing note hints:
  - "可能相关的历史笔记"
  - "建议合并到某个主题"
- consolidation:
  - select multiple memos
  - generate a digest note
  - preserve source links in front matter

### 7.3 Notes UI Design

Desktop:

```text
Quick Capture
  Kind segmented control: Quick Note / Memo
  Title optional
  Content textarea
  Tags input
  AI Assist button

AI Suggestions side panel
  suggested title
  suggested type
  suggested tags
  suggested folder
  cleaned markdown preview
  action items

Save actions
  Save raw
  Apply suggestions and save
```

Mobile:

- Content field first.
- Kind control and tags collapsed under "整理选项".
- AI suggestions appear in a bottom sheet.
- Final save action is sticky at bottom.

### 7.4 Backend Additions

Add endpoints:

```http
POST /api/v1/inbox/notes/analyze
POST /api/v1/inbox/notes/consolidate/preview
POST /api/v1/inbox/notes/consolidate/write
```

Suggested DTOs:

```text
NoteAnalyzeRequest
- title?
- content
- kind?
- tags?

NoteAnalyzeResponse
- suggestedTitle
- suggestedKind
- suggestedTags[]
- suggestedCategory
- suggestedFolder
- cleanedMarkdown
- actionItems[]
- aiAvailable
- confidence

NoteConsolidatePreviewRequest
- sourcePaths[]
- mode: daily | topic | manual
- topic?

NoteConsolidatePreviewResponse
- title
- markdown
- sourcePaths[]
- suggestedPath
```

Important:

- Do not scan the whole Obsidian vault in Phase 3.1 unless explicitly approved.
- For "existing note hints", start with files created by Nexus under `OBSIDIAN_INBOX_DIR`.
- Avoid writing anything during preview endpoints.

## 8. Visual Design Rules

Use the existing Nexus `DESIGN.md` direction:

- Compact Workbench
- L1 interaction
- quiet navy primary
- white cards
- blue-gray muted text
- 8px button/card radius
- no nested cards
- no large marketing hero
- no decorative gradient/orb backgrounds

Recommended interaction level: **L1+**, not L2/L3.

Rationale:

- Inbox is a repeated-use productivity page.
- Users need speed and trust more than cinematic motion.
- AI suggestions need clear review states, not visual spectacle.

Allowed motion:

- subtle panel enter
- row hover
- segmented control active transition
- loading spinner
- AI analysis progress steps

Avoid:

- scroll-driven effects
- parallax
- animated background
- oversized hero blocks

## 9. Frontend Architecture Plan

Keep:

```text
frontend/src/pages/Inbox/index.tsx
frontend/src/pages/Inbox/InboxDesktopView.tsx
frontend/src/pages/Inbox/InboxMobileView.tsx
frontend/src/pages/Inbox/inbox.shared.ts
```

Refactor panels into feature subfolders:

```text
frontend/src/pages/Inbox/components/bookmarks/
  BookmarkPanel.tsx
  BookmarkCaptureBar.tsx
  BookmarkAiReviewPanel.tsx
  BookmarkImportDrawer.tsx
  BookmarkConflictReview.tsx
  BookmarkTagWorkbench.tsx
  BookmarkList.tsx
  BookmarkCard.tsx

frontend/src/pages/Inbox/components/documents/
  DocumentPanel.tsx
  PaperlessGateway.tsx
  PaperlessEntryGrid.tsx
  DocumentUploadPanel.tsx
  RecentDocumentList.tsx

frontend/src/pages/Inbox/components/notes/
  QuickNotePanel.tsx
  NoteComposer.tsx
  NoteAiSuggestionPanel.tsx
  NoteSavedState.tsx
  NoteConsolidationPanel.tsx
```

Shared components:

```text
frontend/src/pages/Inbox/components/shared/
  IntegrationEmptyState.tsx
  StatusChip.tsx
  ReviewDecisionBar.tsx
  CompactToolbar.tsx
```

`index.tsx` remains the only data orchestration layer:

- queries
- mutations
- active tab
- selected import session
- selected conflict item
- last note analysis
- integration statuses

Do not duplicate API logic inside Desktop/Mobile components.

## 10. Backend Architecture Plan

Add services with clear boundaries:

```text
BookmarkAiService
  analyze single bookmark
  analyze import batch
  suggest tag cleanup

BookmarkImportService
  parse pasted/imported items
  dry-run conflicts
  commit user decisions

BookmarkUrlNormalizer
  deterministic URL cleanup, tracking param removal

NoteAiService
  analyze note content
  generate cleanup/category/tags
  preview consolidation

PaperlessGatewayService
  status check
  generate entry links
```

LLM integration:

- Use existing Nexus LLM configuration service.
- Define an Inbox workflow type if one does not exist yet.
- AI prompt output must be strict JSON.
- Always parse defensively and fall back to deterministic behavior.

No secrets:

- Do not hardcode model keys.
- Do not log prompt content if it may contain personal notes or URLs.
- Do not log tokens.

## 11. Implementation Phases

### Phase 3.1-A: UI Shell Redesign

- Redesign desktop layout into header + capture rail + workspace + context panel.
- Redesign mobile into segmented tabs + compact capture + bottom-sheet review.
- Keep existing APIs and behavior.
- No AI endpoints yet.

Acceptance:

- Current bookmark/document/note features still work.
- Mobile is not a compressed desktop layout.
- UI matches Nexus compact workbench style.

### Phase 3.1-B: Bookmark AI Analyze

- Add URL normalizer based on the import script.
- Add `/bookmarks/analyze`.
- Add AI review panel in create flow.
- If LLM missing, still normalize URL and show `aiAvailable=false`.

Acceptance:

- Paste URL -> review normalized URL, suggested title/tags when AI available.
- User can save without AI.
- Duplicate/conflict is visible before save.

### Phase 3.1-C: Bookmark Bulk Import

- Add import preview and commit endpoints.
- Add desktop import drawer.
- Add conflict review UI.
- Preserve explicit user decision for every conflict.

Acceptance:

- Import does not write until commit.
- Summary counts are clear.
- Conflicts are not auto-resolved silently.

### Phase 3.1-D: Paperless Gateway

- Add status endpoint.
- Add entry grid and deep links.
- Keep upload/list/detail.

Acceptance:

- Not configured state is scoped to paperless panel.
- Connected state shows entry points for core paperless pages.
- Unsupported paperless functions open in paperless directly.

### Phase 3.1-E: Note AI Assist

- Add `/notes/analyze`.
- Add AI suggestion panel.
- Add "save raw" and "apply suggestions and save".
- Do not scan full vault yet.

Acceptance:

- User can write a note, ask AI for title/tags/folder/category, edit suggestions, then save.
- LLM missing does not block raw note saving.

### Phase 3.1-F: Note Consolidation Preview

- Only for Nexus-created notes under `OBSIDIAN_INBOX_DIR`.
- Add preview endpoint and UI.
- Write consolidation only after explicit confirmation.

Acceptance:

- Preview never writes files.
- Consolidation output preserves source paths.
- User confirms before write.

## 12. Open Decisions For User Confirmation

Recommended defaults:

1. Bookmark AI scope: include single URL analyze + bulk import preview in Phase 3.1.
2. Smart groups: implement as virtual groups derived from tags, not a new table.
3. Notes existing context: only scan Nexus-created notes under Obsidian inbox dir, not full vault.
4. Interaction level: L1+ compact workbench, no L2/L3 motion.
5. Paperless: gateway cards + deep links, not a paperless clone.

Need confirmation:

- Should Phase 3.1 include bookmark bulk import immediately, or ship single URL AI analyze first?
- Should AI be allowed to fetch webpage metadata/content, or only use user-provided URL/title?
- Should notes consolidation scan only Nexus-created notes, or do you want a broader Obsidian vault scan later?
- Should smart groups remain tag-derived, or do you want explicit group management similar to Linkding bundles?
