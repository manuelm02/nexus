# Inbox Phase 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Inbox Phase 3 as a three-source capture workspace: Nexus-native bookmarks, paperless-ngx document access, and Obsidian Quick Note / Memo.

**Architecture:** Keep `/inbox` as one route and one shared data orchestration page. Backend should implement bookmarks as a first-party Nexus module that reproduces Linkding-style core workflows without depending on Linkding. paperless-ngx remains a pure integration layer and the source of truth for documents. Quick Note / Memo writes Markdown files to Obsidian and does not persist business rows in PostgreSQL. Frontend should expose three tabs with shared loading/error patterns and device-specific views only if layout complexity requires it.

**Tech Stack:** Spring Boot 3.3.5, Java 21, MyBatis-Plus existing app, React 18, Vite 5, TypeScript, TanStack Query, Tailwind CSS v3, Radix/shadcn-style local components.

---

## Required Confirmations Before Implementation

- `PAPERLESS_BASE_URL`
- `PAPERLESS_TOKEN`
- `OBSIDIAN_VAULT_PATH`
- `OBSIDIAN_INBOX_DIR` default can be `Inbox`
- Markdown file naming preference:
  - Recommended: `yyyy/MM/yyyy-MM-dd-HHmmss-slug.md`
  - Alternative: flat `Inbox/yyyy-MM-dd-HHmmss-title.md`

If paperless or Obsidian values are not available yet, implement configuration-driven adapters with disabled/empty states and unit tests using mocked clients. Do not hard-code private URLs or tokens.

## Phase 3 Scope

### In Scope

- Nexus-native bookmark list/create/update/delete with Linkding-like daily workflow.
- paperless-ngx document list/upload/detail through Nexus API.
- Obsidian Quick Note / Memo Markdown file creation through Nexus API.
- Inbox page redesign with tabs: `书签` / `文档` / `笔记`.
- Config missing empty states for paperless and Obsidian.
- Focused backend unit tests and frontend build verification.

### Out of Scope

- Full text search across paperless documents.
- OCR status polling beyond basic detail metadata.
- Bidirectional Obsidian sync or reading notes back from vault.
- Storing Quick Note / Memo in PostgreSQL.
- Mindbank ingestion workflow.
- Browser extension, automatic web archiving, screenshots, readability extraction, or background URL crawling for bookmarks.

## Bookmark Scope Decision

The bookmark module should **not** depend on Linkding. Linkding is only the product reference for interaction patterns.

### Recommended Phase 3 Bookmark Scope

Implement the core daily-use subset:

- Save URL with optional title, description/notes, tags.
- List bookmarks with search by title/url/description/tags.
- Filter by tags.
- Toggle unread/read.
- Toggle archived/unarchived.
- Edit title, description/notes, tags, unread, archived.
- Delete with confirmation.
- Basic URL metadata fallback: derive domain and default title from URL if title is empty.

### Defer Unless User Confirms

- Public sharing.
- Browser extension/import bookmarklet.
- Automatic metadata fetch from remote pages.
- Webpage snapshot/archive.
- Read-it-later article extraction.
- Bulk import/export.
- Collections/folders beyond tags.
- Duplicate detection beyond exact URL unique constraint.

If the user wants a deeper Linkding clone, confirm which deferred features to include before implementation.

## Backend File Structure

Create:

- `backend/src/main/java/com/nexus/config/InboxIntegrationProperties.java`
- `backend/src/main/java/com/nexus/entity/Bookmark.java`
- `backend/src/main/java/com/nexus/mapper/BookmarkMapper.java`
- `backend/src/main/java/com/nexus/dto/request/BookmarkListRequest.java`
- `backend/src/main/java/com/nexus/inbox/document/DocumentArchivePort.java`
- `backend/src/main/java/com/nexus/inbox/document/PaperlessDocumentClient.java`
- `backend/src/main/java/com/nexus/inbox/note/NoteSinkPort.java`
- `backend/src/main/java/com/nexus/inbox/note/ObsidianMarkdownWriter.java`
- `backend/src/main/java/com/nexus/dto/request/BookmarkCreateRequest.java`
- `backend/src/main/java/com/nexus/dto/request/BookmarkUpdateRequest.java`
- `backend/src/main/java/com/nexus/dto/request/QuickNoteRequest.java`
- `backend/src/main/java/com/nexus/dto/response/BookmarkResponse.java`
- `backend/src/main/java/com/nexus/dto/response/DocumentResponse.java`
- `backend/src/main/java/com/nexus/dto/response/QuickNoteResponse.java`
- `backend/src/test/java/com/nexus/inbox/note/ObsidianMarkdownWriterTest.java`
- `backend/src/test/java/com/nexus/service/BookmarkServiceTest.java`
- `backend/src/test/java/com/nexus/controller/InboxControllerTest.java`
- `backend/src/main/resources/db/migration/V1_7__init_bookmarks.sql`

Modify:

- `backend/src/main/resources/application.yml`
- `backend/src/main/java/com/nexus/controller/InboxController.java`
- `backend/src/main/java/com/nexus/service/InboxService.java`
- `backend/src/main/java/com/nexus/service/BookmarkService.java`

## Backend Contracts

### Configuration

Add under `nexus`:

```yaml
nexus:
  inbox:
    paperless:
      base-url: ${PAPERLESS_BASE_URL:}
      token: ${PAPERLESS_TOKEN:}
    obsidian:
      vault-path: ${OBSIDIAN_VAULT_PATH:}
      inbox-dir: ${OBSIDIAN_INBOX_DIR:Inbox}
```

Use `@ConfigurationProperties(prefix = "nexus.inbox")`. Add a concise class-level comment explaining that these are optional external integrations and empty values must produce UI-empty states, not startup failure.

Remove any Linkding configuration from the actual implementation. Bookmarks are first-party Nexus data.

### Nexus Bookmark API

Expose:

```http
GET    /api/v1/inbox/bookmarks
POST   /api/v1/inbox/bookmarks
PATCH  /api/v1/inbox/bookmarks/{id}
DELETE /api/v1/inbox/bookmarks/{id}
```

DTO:

```ts
BookmarkResponse {
  id: string
  url: string
  title?: string
  description?: string
  notes?: string
  tagNames: string[]
  unread?: boolean
  archived?: boolean
  domain?: string
  createdAt?: string
  updatedAt?: string
}
```

Implementation notes:

- Bookmarks are stored locally in PostgreSQL.
- Add a `bookmarks` table with URL, title, description, notes, tags JSONB, unread, archived, created_at, updated_at.
- Add a unique index on normalized URL if practical; otherwise exact URL unique is acceptable for Phase 3.
- Derive `domain` from URL in service or response mapping.
- Validate URL has `http://` or `https://`.
- Search should support a simple query across title/url/description/notes and tags.
- Avoid external page fetching in Phase 3 unless the user explicitly requests metadata fetch.

### paperless-ngx API

Expose:

```http
GET  /api/v1/inbox/documents
POST /api/v1/inbox/documents
GET  /api/v1/inbox/documents/{id}
```

Upload endpoint uses multipart:

```text
file: MultipartFile
title?: string
correspondent?: string
documentType?: string
tags?: string[]
```

DTO:

```ts
DocumentResponse {
  id: string
  title: string
  originalFileName?: string
  createdAt?: string
  addedAt?: string
  correspondent?: string
  documentType?: string
  tags: string[]
  downloadUrl?: string
  previewUrl?: string
}
```

Implementation notes:

- paperless-ngx is the source of truth; do not create a local document table.
- If config missing, return `PAPERLESS_NOT_CONFIGURED`.
- `POST /api/v1/inbox/documents` should forward multipart upload to paperless.
- Keep first implementation metadata-focused; preview/download links can be derived only if paperless API response provides enough info.

### Obsidian Quick Note / Memo

Expose:

```http
POST /api/v1/inbox/notes
```

Request:

```ts
QuickNoteRequest {
  title?: string
  content: string
  kind: 'quick_note' | 'memo'
  tags?: string[]
}
```

Response:

```ts
QuickNoteResponse {
  path: string
  fileName: string
  createdAt: string
}
```

Implementation notes:

- Do not write Quick Notes to `inbox_items`.
- Validate `content` is not blank.
- If `OBSIDIAN_VAULT_PATH` missing, return `OBSIDIAN_NOT_CONFIGURED`.
- Resolve final path under `vaultPath / inboxDir`; reject path traversal.
- Create directories if missing.
- Markdown template:

```markdown
---
source: nexus
type: quick_note
created: 2026-06-13T12:00:00+08:00
tags:
  - inbox
  - example
---

# Title

Content...
```

- File naming should slug title when present, otherwise use `note`.
- Use Java NIO `Path.normalize()` and verify final path starts with normalized vault path.

## Frontend File Structure

Create:

- `frontend/src/pages/Inbox/inbox.shared.ts`
- `frontend/src/pages/Inbox/InboxDesktopView.tsx`
- `frontend/src/pages/Inbox/InboxMobileView.tsx`
- `frontend/src/pages/Inbox/components/BookmarkPanel.tsx`
- `frontend/src/pages/Inbox/components/DocumentPanel.tsx`
- `frontend/src/pages/Inbox/components/QuickNotePanel.tsx`
- `frontend/src/pages/Inbox/components/IntegrationEmptyState.tsx`

Modify:

- `frontend/src/pages/Inbox/index.tsx`
- `frontend/src/api/inbox.api.ts`
- `frontend/src/types/domain.types.ts`

## Frontend UX

### Information Architecture

Use one route:

```text
/inbox
```

Top tabs:

```text
书签 / 文档 / 笔记
```

Header copy:

```text
Inbox
收集链接、文件和临时笔记。
```

### Bookmarks

Desktop:

- Compact create row: URL input, title optional, tags optional, save.
- Bookmark list shows title/domain/url, tags, unread state if available, actions.
- Delete requires confirmation.

Mobile:

- URL input first, optional fields can be collapsed.
- List cards show title, domain, tags, primary action.

### Documents

Desktop:

- Upload surface with file input, title optional, upload button.
- Document list with title, date, tags/type/correspondent metadata.
- Detail action opens a dialog/sheet showing metadata and available links.

Mobile:

- Upload button remains high priority but compact.
- Cards avoid dense metadata overflow.

### Quick Note / Memo

Desktop:

- Editor card with kind segmented control: Quick Note / Memo.
- Title optional.
- Content required.
- Tags optional.
- Save writes to Obsidian and shows saved path.

Mobile:

- Editor remains first-screen friendly: title/content/save.
- Tags can be collapsed or a compact comma input.

### Empty/Error States

Each area gets a scoped empty state:

- Bookmarks: show an ordinary empty state when there are no saved bookmarks.
- paperless not configured: explain required env vars and point to Settings only if Settings exposes those fields; otherwise say environment config required.
- Obsidian not configured: explain `OBSIDIAN_VAULT_PATH`.

Do not show one global red error for all tabs.

## Task Breakdown

### Task 1: Add Inbox integration configuration

- Add `InboxIntegrationProperties`.
- Add `application.yml` keys.
- Unit check: missing config does not fail app startup.

### Task 2: Implement Obsidian note sink first

- Implement `NoteSinkPort`.
- Implement `ObsidianMarkdownWriter`.
- Add path traversal guard tests.
- Add markdown rendering test for front matter, title, tags, content.

### Task 3: Add Quick Note API

- Add `QuickNoteRequest` and `QuickNoteResponse`.
- Add `POST /api/v1/inbox/notes`.
- Service delegates to `NoteSinkPort`.
- Test blank content validation and successful write via mocked port.

### Task 4: Implement Nexus-native bookmarks

- Create `bookmarks` Flyway migration.
- Implement `Bookmark` entity and `BookmarkMapper`.
- Implement `BookmarkService` with create/update/delete/list/search/tag filter/unread/archive behavior.
- Add controller endpoints.
- Add tests for URL validation, exact URL duplicate handling, tag filtering, unread/archive toggles, and delete.

### Task 5: Implement paperless adapter and API

- Implement `DocumentArchivePort`.
- Implement `PaperlessDocumentClient`.
- Add list/upload/detail endpoints.
- Add disabled/config-missing behavior.
- Add multipart forwarding test at service/controller boundary.

### Task 6: Refactor frontend Inbox API/types

- Add `Bookmark`, `InboxDocument`, `QuickNoteResponse` types.
- Add `inboxApi.bookmarks`, `inboxApi.documents`, `inboxApi.notes`.
- Preserve legacy `list/create/delete` only if still needed for compatibility; do not use it in new UI unless explicitly required.

### Task 7: Build Inbox page data orchestration

- `index.tsx` owns active tab, queries, mutations, error mapping.
- Use query keys:
  - `['inbox', 'bookmarks']`
  - `['inbox', 'documents']`
  - `['inbox', 'notes']` only for create mutation state, because notes are write-only.

### Task 8: Build desktop and mobile views

- Follow Nexus responsive rule: same route, shared business logic, view split only for layout.
- Desktop can use three tab panels.
- Mobile should use compact tabs and avoid giant cards.

### Task 9: Visual and interaction QA

- Verify bookmark empty state, bookmark CRUD, search, tag filter, unread/archive toggles.
- Verify empty states for missing paperless/Obsidian config.
- Verify note write success path displays saved file path.
- Verify bookmark create/delete and document upload flows against mocks or configured services.
- Run:

```bash
cd backend && JAVA_HOME=/Users/manuelm/.local/share/mise/installs/java/21.0.2 PATH=/Users/manuelm/.local/share/mise/installs/java/21.0.2/bin:$PATH mvn test
cd frontend && pnpm build
```

## Implementation Warnings

- Do store Nexus-native bookmarks in PostgreSQL.
- Do not store paperless documents in PostgreSQL unless explicitly asked later.
- Do not write Quick Note / Memo to `inbox_items`.
- Do not block app startup when an integration is missing.
- Do not leak tokens in logs or API error messages.
- Do not reuse ToDo-specific components in Inbox unless the component is generic or moved to shared components.
- Do not add new mobile routes.
- All exported React components need one-line Chinese purpose comments.
- Non-trivial public Java methods need Javadoc.

## Open Questions for User

1. Which deferred Linkding-like bookmark features should Phase 3 include beyond the recommended core subset?
2. What are the actual paperless base URL/token values for local dev?
3. What is the Obsidian vault absolute path?
4. Should notes be organized by day folder (`Inbox/2026/06/`) or flat under `Inbox/`?
5. Should `Memo` and `Quick Note` use separate Obsidian folders or only front matter `type`?
