# Nexus Product Roadmap Findings

## 2026-06-09

- 用户明确新的实现顺序：ToDo、Translate、Inbox、Subscriptions、Chat、Mindbank & Crawl。
- ToDo 从旧 Focus 工作流减法为待分配池 + 今日执行 + 历史状态恢复，不再写入 Notion。
- ToDo 需要新增“已过期”分组，用于集中展示过了今天仍未 done 的任务；用户可在该分组内调整状态、规划日期、截止日期。
- Inbox 改为三类能力：Nexus 原生书签（复刻 Linkding 核心功能，不依赖 Linkding）、paperless-ngx 文档接入、Obsidian Quick Note / Memo。
- Translate 需要从单次 LLM 翻译扩展为简化版翻译软件，并预留专业翻译 API。
- Subscriptions 保留基础 CRUD、用量和到期提醒，API 用量拉取后置。
- Chat 是轻量日常问答，不承担 Mindbank 知识库职责。
- Mindbank 和 Crawl 保留为后续单独讨论模块。
- Phase 1 实现后，ToDo 不再通过 scheduler 把过期任务自动滚动到今天；过期任务保留原日期并进入“已过期”分组，便于用户集中修正。
- ToDo 创建请求已收束为 title + priority，scheduledDate/dueDate 只在选入今日或后续调整时写入。
- 当前后端验证需使用 Java 21；默认 `mvn` 所在 Java 不支持 `--release 21`。
- `system_configs` 表列名是 `config_key/config_val`，不是 `key/value`；后续配置迁移脚本必须按 V1_4 的实际 schema 写。
- Translate Phase 2 已落地为结构化翻译工作台：主译文、解释、关键词、备选表达和 provider 元数据均已进入后端/前端契约。
- ToDo 日期控件已上升为 Nexus 设计规范：产品界面不应裸露原生 date input，清空日期必须是 DatePicker 内部能力。
- Phase 3 Inbox 当前不是增强现有 `inbox_items` CRUD；书签改为 Nexus 本地事实源，paperless-ngx 是外部文档事实源，Obsidian Markdown 是笔记文件输出。

## Open Questions

- ToDo 的 `in_progress` 是否只允许同时存在一个，还是允许多个并行。
- ToDo 的状态切换 UI 是否最终采用单选框三态交互。
- 书签复刻范围待确认：是否包含公开分享、浏览器扩展/bookmarklet、自动抓取 metadata、网页归档、readability 正文提取、批量导入导出、collections/folders。
- paperless-ngx 的服务地址和 token 待确认：`PAPERLESS_BASE_URL`、`PAPERLESS_TOKEN`。
- Obsidian vault 路径、目录结构和文件命名规则待确认。
- Chat 首版是否需要保存会话历史。
