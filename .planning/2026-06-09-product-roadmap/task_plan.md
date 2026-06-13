# Nexus Product Roadmap Task Plan

**Goal:** 按当前产品减法方向重排 Nexus 开发顺序，并作为后续实现工作的唯一阶段计划。

## Phases

- [x] Phase 0: 清理旧文档和旧阶段计划
- [x] Phase 1: ToDo 减法工作流
- [x] Phase 2: Translate 简化版翻译软件
- [ ] Phase 3: Inbox 三类接入
- [ ] Phase 4: Subscriptions 基础订阅管理
- [ ] Phase 5: Chat 日常问答
- [ ] Phase 6: Mindbank & Crawl 单独设计

## Phase 1: ToDo

- [x] 创建 ToDo 只包含内容和优先级，默认 `pending`
- [x] 待分配池支持取消和恢复：`pending ↔ cancelled`
- [x] 选入今日时写入 `scheduled_date=today`，`due_date` 用户选择，未选兜底今天
- [x] 今日状态支持 `not_started → in_progress → done`
- [x] 新增已过期分组：`status != done` 且 `scheduled_date < today` 或 `due_date < today`
- [x] 已过期分组支持直接调整状态、计划日期、截止日期
- [x] 历史列表支持按状态筛选和状态恢复
- [x] ToDo 不写 Notion，只维护 PostgreSQL
- [x] 页面增加退出登录按钮和用户信息页

## Phase 2: Translate

- [x] 抽象翻译 Provider，先保留 LLM，预留有道等专业 API
- [x] 输出包括译文、解释、关键词、备选表达
- [x] 前端提供输入、语言、风格、结果和历史
- [x] Provider 缺失时提供明确配置引导

## Phase 3: Inbox

- [ ] 复刻 Linkding 核心书签功能：Nexus 本地 bookmarks、URL 保存、标签、搜索、未读/归档、编辑删除
- [ ] paperless-ngx 文档上传、列表、详情展示
- [ ] Quick Note / Memo 写入 Obsidian Markdown，不落业务库
- [ ] 开发前确认 Obsidian vault 路径和文件组织规则

## Phase 4: Subscriptions

- [ ] 基础 CRUD
- [ ] 手动维护用量
- [ ] 到期提醒
- [ ] API 用量拉取和余额同步后置

## Phase 5: Chat

- [ ] 简单日常问答窗口
- [ ] 模型配置走 `chat` workflow
- [ ] 不承担 Mindbank 知识库问答职责

## Phase 6: Mindbank & Crawl

- [ ] 开发前重新讨论 Mindbank 具体流程
- [ ] 开发前重新讨论 Crawl / Radar 具体流程
- [ ] 不作为前五阶段的前置依赖

## Decisions

- 当前实现顺序固定为：ToDo、Translate、Inbox、Subscriptions、Chat、Mindbank & Crawl。
- ToDo 不再写入 Notion。
- Quick Note / Memo 计划写入 Obsidian，路径后续确认。
- Forge / Code Wiki 暂不做。
- 旧文档删除，避免与当前设计理念冲突。

## Errors Encountered

| Error | Attempt | Resolution |
|---|---|---|
| 旧文档与新方向冲突 | 读取 docs 与 .planning | 删除旧文档，只保留当前主开发文档和当前计划 |
| 默认 Java 不支持 release 21 | `mvn -q -Dtest=TodoServiceTest test` | 改用 `mise exec java@21 -- mvn ...` 运行后端验证 |
| Flyway V1.5 启动失败：`column "key" does not exist` | 启动 local profile | 将 `system_configs.key` 修正为 `system_configs.config_key`，并新增迁移脚本列名测试 |
