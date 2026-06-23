# Inbox Phase 3 DeepSeek Prompt

你是资深全栈工程师，请在 Nexus 项目中实施 Inbox Phase 3。

项目路径：

```text
/Users/manuelm/Workspace/Projects/Nexus/nexus
```

开始前必须阅读：

```text
AGENTS.md
DESIGN.md
docs/superpowers/plans/2026-06-13-inbox-phase-3.md
.planning/2026-06-09-product-roadmap/task_plan.md
```

## 目标

把当前简单 `inbox_items` CRUD 页面升级为三类能力：

```text
书签：Nexus 原生书签，复刻 Linkding 核心日常功能，但不依赖 Linkding
文档：paperless-ngx 接入层
笔记：Obsidian Markdown 写入
```

统一路由仍然是：

```text
/inbox
```

前端 tab：

```text
书签 / 文档 / 笔记
```

## 强制原则

1. 书签必须是 Nexus 原生能力，数据存储在 Nexus PostgreSQL，不能接入或依赖 Linkding。
2. Linkding 只是产品体验参考：URL 保存、标签、搜索、未读、归档、编辑、删除。
3. paperless-ngx 只做接入层，paperless 是文档事实源，不要新建本地 documents 表。
4. Quick Note / Memo 写入 Obsidian Markdown，不落 PostgreSQL 业务表。
5. paperless / Obsidian 未配置时，页面显示 scoped empty state，不要让应用启动失败。
6. 不要泄露 token 到日志或 API 响应。
7. 前端必须遵守 Nexus UI 规范和响应式规则：同一路由、业务逻辑共享、必要时拆 DesktopView / MobileView。
8. 不要引入新的 UI 库。

## 书签复刻范围

第一版只实现 Linkding 的核心日常子集：

```text
- 保存 URL，支持标题、描述、备注、标签
- 书签列表
- 按标题 / URL / 描述 / 备注 / 标签搜索
- 按标签过滤
- 未读 / 已读切换
- 归档 / 取消归档切换
- 编辑标题、描述、备注、标签、未读、归档
- 删除书签，前端需要二次确认
- 如果标题为空，默认从 URL 域名生成一个可读标题
- URL 必须校验 http:// 或 https://
```

暂不实现，除非用户明确确认：

```text
- 公开分享
- 浏览器扩展 / bookmarklet
- 自动抓取网页 metadata
- 网页快照 / 归档正文
- readability 文章提取
- 批量导入导出
- collections / folders
- 复杂重复检测，第一版 exact URL unique 即可
```

## 需要先确认的配置

如果下面配置没有现成值，请不要硬编码。先实现 env-driven adapter 和 missing-config empty state：

```text
PAPERLESS_BASE_URL
PAPERLESS_TOKEN
OBSIDIAN_VAULT_PATH
OBSIDIAN_INBOX_DIR
```

默认：

```text
OBSIDIAN_INBOX_DIR=Inbox
```

## 后端实现顺序

### 1. 配置

新增：

```text
backend/src/main/java/com/nexus/config/InboxIntegrationProperties.java
```

在 `application.yml` 增加：

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

要求：

```text
- 使用 @ConfigurationProperties(prefix = "nexus.inbox")
- 配置类顶部加中文注释，说明这些外部集成是可选配置，缺失时不能导致启动失败
- 不要添加任何 linkding 配置
```

### 2. Nexus 原生书签

新增：

```text
backend/src/main/resources/db/migration/V1_7__init_bookmarks.sql
backend/src/main/java/com/nexus/entity/Bookmark.java
backend/src/main/java/com/nexus/mapper/BookmarkMapper.java
backend/src/main/java/com/nexus/service/BookmarkService.java
backend/src/main/java/com/nexus/dto/request/BookmarkListRequest.java
backend/src/main/java/com/nexus/dto/request/BookmarkCreateRequest.java
backend/src/main/java/com/nexus/dto/request/BookmarkUpdateRequest.java
backend/src/main/java/com/nexus/dto/response/BookmarkResponse.java
```

接口：

```http
GET    /api/v1/inbox/bookmarks
POST   /api/v1/inbox/bookmarks
PATCH  /api/v1/inbox/bookmarks/{id}
DELETE /api/v1/inbox/bookmarks/{id}
```

建议表结构：

```text
bookmarks
- id uuid / varchar，与项目现有 ID 风格保持一致
- url varchar not null
- normalized_url varchar not null
- title varchar
- description text
- notes text
- tags jsonb not null default '[]'
- unread boolean not null default true
- archived boolean not null default false
- created_at timestamp not null
- updated_at timestamp not null
```

索引：

```text
- normalized_url unique
- archived
- unread
- created_at
```

业务规则：

```text
- URL 必须是 http:// 或 https://
- normalized_url 第一版可以 trim 后去掉末尾 slash，先不要做复杂 canonicalize
- title 为空时用 URL domain 兜底
- domain 可在 response mapping 时从 URL 解析，不一定入库
- tags 入库前去空、trim、去重
- list 支持 q、tag、archived、unread、page、size
- q 搜索 title/url/description/notes/tags
- delete 是硬删除，前端做二次确认
- 所有非平凡 public 方法按 AGENTS.md 写 Javadoc
```

### 3. paperless-ngx 接入层

新增：

```text
backend/src/main/java/com/nexus/inbox/document/DocumentArchivePort.java
backend/src/main/java/com/nexus/inbox/document/PaperlessDocumentClient.java
backend/src/main/java/com/nexus/dto/response/DocumentResponse.java
```

接口：

```http
GET  /api/v1/inbox/documents
POST /api/v1/inbox/documents
GET  /api/v1/inbox/documents/{id}
```

上传使用 multipart：

```text
file: MultipartFile
title?: string
correspondent?: string
documentType?: string
tags?: string[]
```

要求：

```text
- 配置缺失返回 PAPERLESS_NOT_CONFIGURED
- 不要本地落库
- 第一版只做列表、上传、详情元数据
- 不做全文搜索、不做 OCR 轮询
```

### 4. Obsidian Note Sink

新增：

```text
backend/src/main/java/com/nexus/inbox/note/NoteSinkPort.java
backend/src/main/java/com/nexus/inbox/note/ObsidianMarkdownWriter.java
backend/src/main/java/com/nexus/dto/request/QuickNoteRequest.java
backend/src/main/java/com/nexus/dto/response/QuickNoteResponse.java
```

接口：

```http
POST /api/v1/inbox/notes
```

请求：

```json
{
  "title": "可选标题",
  "content": "必填内容",
  "kind": "quick_note",
  "tags": ["inbox"]
}
```

要求：

```text
- content 必填
- kind 允许 quick_note / memo
- 写入 Markdown 文件
- 必须防路径穿越
- 必须创建缺失目录
- OBSIDIAN_VAULT_PATH 缺失时返回 OBSIDIAN_NOT_CONFIGURED
- 文件名建议 yyyy/MM/yyyy-MM-dd-HHmmss-slug.md
```

Markdown front matter：

```markdown
---
source: nexus
type: quick_note
created: 2026-06-13T12:00:00+08:00
tags:
  - inbox
---

# Title

Content
```

## 前端实现顺序

### 1. 类型和 API

修改：

```text
frontend/src/types/domain.types.ts
frontend/src/api/inbox.api.ts
```

新增类型：

```ts
Bookmark
InboxDocument
QuickNoteRequest
QuickNoteResponse
```

新增 API 分组：

```ts
inboxApi.bookmarks.list/create/update/delete
inboxApi.documents.list/upload/detail
inboxApi.notes.create
```

### 2. 页面结构

重构：

```text
frontend/src/pages/Inbox/index.tsx
```

新增：

```text
frontend/src/pages/Inbox/inbox.shared.ts
frontend/src/pages/Inbox/InboxDesktopView.tsx
frontend/src/pages/Inbox/InboxMobileView.tsx
frontend/src/pages/Inbox/components/BookmarkPanel.tsx
frontend/src/pages/Inbox/components/DocumentPanel.tsx
frontend/src/pages/Inbox/components/QuickNotePanel.tsx
frontend/src/pages/Inbox/components/IntegrationEmptyState.tsx
```

要求：

```text
- index.tsx 只做 query/mutation/state 编排
- 桌面端和移动端如果布局差异明显，拆 DesktopView / MobileView
- 不复制 API 调用和 mutation 逻辑
- 所有导出 React 组件顶部加一行中文注释说明用途
```

### 3. 书签 UI

桌面端：

```text
- 顶部快速保存 URL 表单：URL、标题可选、标签输入、保存按钮
- 左侧或顶部筛选：全部 / 未读 / 归档、标签、搜索框
- 列表卡片展示：标题、domain、URL、标签、描述/备注摘要、未读状态、归档状态、创建时间
- 卡片操作：标记已读/未读、归档/取消归档、编辑、删除
```

移动端：

```text
- 顶部紧凑搜索和新增按钮
- 新增/编辑用 sheet 或紧凑表单
- 列表优先展示标题、domain、标签、未读/归档状态
- 次要信息折叠或放在详情层
```

设计要求：

```text
- 遵守 DESIGN.md，不要做营销页
- 卡片 radius 不超过 8px，整体保持 Nexus 克制、工作台风格
- tag badge、状态 chip、按钮状态要和 ToDo 日期组件后的设计规范一致
```

### 4. 文档 UI

```text
- 展示 paperless 文档列表
- 支持上传文件
- 上传时 title/tags 可选
- 配置缺失时显示“paperless-ngx 未配置”的 scoped empty state
- 不要在前端假装本地保存成功，必须以后端响应为准
```

### 5. 笔记 UI

```text
- Quick Note / Memo 切换
- title 可选、content 必填、tags 可选
- 保存成功后清空输入并显示目标文件路径
- Obsidian 未配置时显示 scoped empty state
```

## 错误处理

后端错误码建议：

```text
BOOKMARK_URL_INVALID
BOOKMARK_DUPLICATE_URL
BOOKMARK_NOT_FOUND
PAPERLESS_NOT_CONFIGURED
PAPERLESS_REQUEST_FAILED
OBSIDIAN_NOT_CONFIGURED
OBSIDIAN_WRITE_FAILED
NOTE_CONTENT_REQUIRED
```

前端要求：

```text
- 使用项目现有 toast / error pattern
- 对 missing config 使用 panel 内 empty state，不要全页报错
- 删除书签必须二次确认
```

## 测试和验证

后端至少新增：

```text
BookmarkServiceTest
ObsidianMarkdownWriterTest
InboxControllerTest
```

覆盖：

```text
- bookmark 创建、URL 校验、重复 URL、搜索、tag filter、未读切换、归档切换、删除
- paperless 配置缺失返回 PAPERLESS_NOT_CONFIGURED
- Obsidian 配置缺失返回 OBSIDIAN_NOT_CONFIGURED
- Obsidian 写入时防路径穿越
```

必须运行：

```text
cd frontend && pnpm build
cd backend && JAVA_HOME=/Users/manuelm/.local/share/mise/installs/java/21.0.2 PATH=/Users/manuelm/.local/share/mise/installs/java/21.0.2/bin:/Users/manuelm/.local/share/mise/installs/maven/3.9.2/apache-maven-3.9.2/bin:/usr/bin:/bin:/usr/sbin:/sbin mvn test
```

注意：当前环境普通 `mvn` 可能走 Java 11，后端测试必须显式使用上面的 Java 21 环境。

## 禁止事项

```text
- 不要接入 Linkding API
- 不要添加 LINKDING_BASE_URL / LINKDING_TOKEN
- 不要创建 LinkdingBookmarkClient / BookmarkPort 这类外部书签 adapter
- 不要把 paperless documents 复制到 PostgreSQL
- 不要把 Obsidian note 写入 inbox_items
- 不要引入新的 UI 库
- 不要修改无关页面
- 不要绕过 AGENTS.md 注释规范
```

## 完成标准

```text
- /inbox 有 书签 / 文档 / 笔记 三个 tab
- 书签为 Nexus 原生 CRUD，支持搜索、标签、未读、归档
- paperless 只通过 Nexus 后端代理访问，未配置时有空状态
- Obsidian Quick Note / Memo 能写 Markdown，未配置时有空状态
- 桌面端和移动端布局均可用，不是简单压缩桌面端
- frontend build 通过
- backend test 通过
```
