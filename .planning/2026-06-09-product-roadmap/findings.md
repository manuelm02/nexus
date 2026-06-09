# Nexus Product Roadmap Findings

## 2026-06-09

- 用户明确新的实现顺序：ToDo、Translate、Inbox、Subscriptions、Chat、Mindbank & Crawl。
- ToDo 从旧 Focus 工作流减法为待分配池 + 今日执行 + 历史状态恢复，不再写入 Notion。
- ToDo 需要新增“已过期”分组，用于集中展示过了今天仍未 done 的任务；用户可在该分组内调整状态、规划日期、截止日期。
- Inbox 改为三类能力：Linkding 书签、paperless-ngx 文档接入、Obsidian Quick Note / Memo。
- Translate 需要从单次 LLM 翻译扩展为简化版翻译软件，并预留专业翻译 API。
- Subscriptions 保留基础 CRUD、用量和到期提醒，API 用量拉取后置。
- Chat 是轻量日常问答，不承担 Mindbank 知识库职责。
- Mindbank 和 Crawl 保留为后续单独讨论模块。
- Phase 1 实现后，ToDo 不再通过 scheduler 把过期任务自动滚动到今天；过期任务保留原日期并进入“已过期”分组，便于用户集中修正。
- ToDo 创建请求已收束为 title + priority，scheduledDate/dueDate 只在选入今日或后续调整时写入。
- 当前后端验证需使用 Java 21；默认 `mvn` 所在 Java 不支持 `--release 21`。

## Open Questions

- ToDo 的 `in_progress` 是否只允许同时存在一个，还是允许多个并行。
- ToDo 的状态切换 UI 是否最终采用单选框三态交互。
- Translate 首版是否只实现 LLM，还是同时接入一个专业翻译 API。
- Obsidian vault 路径、目录结构和文件命名规则待确认。
- Chat 首版是否需要保存会话历史。
