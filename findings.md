# Findings

## 代码库现状分析

### 后端
- InboxController 已有 11 个端点（书签 CRUD + 文档 list/upload/detail + 笔记 write）
- BookmarkService 实现基本 CRUD，URL 归一化仅 trim + 去末尾 /
- PaperlessDocumentClient 代理 paperless-ngx API
- ObsidianMarkdownWriter 写入 YAML front matter Markdown
- LlmConfigService 支持 4 种 Provider: openai/anthropic/deepseek/ollama
- 预置 9 个工作流类型，需要新增 inbox 类型
- SystemConfigService 支持键值对存储，已有 6 个预置配置
- 加密: AES-256/ECB/PKCS5Padding，encrypt/decrypt 方法

### 前端
- Inbox 使用响应式架构: index.tsx 共享业务逻辑，DesktopView/MobileView 拆视图
- 三个面板组件: BookmarkPanel, DocumentPanel, QuickNotePanel
- API 层: inbox.api.ts 封装所有接口调用
- Settings 页面已存在 LLM 配置面板

### 需要新增的工作流类型
- `inbox` — 用于 Inbox 的 AI 分析（书签标签/标题/描述/分组建议、笔记分类/标签/合并建议）

### 需要新增的数据库表
- `bookmark_smart_groups` — 智能分组定义
- `bookmark_smart_group_assignments` — 书签到分组的分配

### 需要新增的 system_configs 键
- `inbox.paperless.enabled`
- `inbox.paperless.base_url`
- `inbox.paperless.api_token` (加密存储)
- `inbox.paperless.open_in_new_tab`
- `inbox.paperless.default_upload_tags`
- `inbox.obsidian.enabled`
- `inbox.obsidian.vault_path`
- `inbox.obsidian.inbox_dir`
- `inbox.obsidian.file_naming_pattern`
- `inbox.obsidian.consolidation_dir`
- `inbox.bookmarks.ai_assist_enabled`
- `inbox.bookmarks.bulk_import_enabled`
- `inbox.bookmarks.strip_tracking_params`
- `inbox.bookmarks.default_unread`
- `inbox.bookmarks.smart_groups_enabled`

### 依赖关系
- Phase 7 (Paperless Gateway) 依赖 Phase 6 (Settings)
- Phase 8/9 (Notes AI) 依赖 Phase 6 (Obsidian settings)
- Phase 3-5 (Bookmark AI) 依赖 Phase 2 (URL normalizer)
