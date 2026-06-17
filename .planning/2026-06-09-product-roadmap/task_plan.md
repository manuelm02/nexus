# Nexus Product Roadmap Task Plan

**Goal:** 按当前产品减法方向重排 Nexus 开发顺序，并作为后续实现工作的唯一阶段计划。

## Phases

- [x] Phase 0: 清理旧文档和旧阶段计划
- [x] Phase 1: ToDo 减法工作流
- [x] Phase 2: Translate 简化版翻译软件
- [x] Phase 3: Inbox 三类接入
- [x] Phase 4: Subscriptions 基础订阅管理
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

- [x] 复刻 Linkding 核心书签功能：Nexus 本地 bookmarks、URL 保存、标签、搜索、未读/归档、编辑删除
- [x] paperless-ngx 文档上传、列表、详情展示
- [x] Quick Note / Memo 写入 Obsidian Markdown，不落业务库
- [x] 开发前确认 Obsidian vault 路径和文件组织规则

## Phase 4: Subscriptions

详细计划见 `docs/superpowers/plans/2026-06-14-subscriptions-phase-4.md`，提示词见 `docs/superpowers/prompts/2026-06-14-subscriptions-phase-4-deepseek.md`。

- [x] 新增 V1_9 迁移，删除 `notion_page_url` / `notion_synced` / `task_id` 三列及对应实体字段
- [x] 新增 `SubscriptionResponse`，屏蔽 `api_*` 五个字段，列保留供后续阶段
- [x] 基础 CRUD（实体/DTO/Controller 改为返回 `SubscriptionResponse`）
- [x] 手动维护用量（`usageUsed` 编辑 + 进度条 + 前端 +1 快捷操作）
- [x] 到期提醒：每日自动把过期 `active` 置为 `expired`（`autoExpireOverdue`）+ 沿用现有 `NotificationService`
- [x] 站内可见的”即将到期 / 已到期”汇总和 chip，不依赖通知渠道配置
- [x] 前端按 AGENTS.md 拆 `SubscriptionsDesktopView` / `SubscriptionsMobileView`，提取通用 `DatePicker`
- [x] API 用量拉取和余额同步后置（不在本阶段实现）

### Phase 4 扩展：订阅类型 UI 重构

详细计划见 `docs/superpowers/plans/2026-06-14-subscriptions-ui-redesign.md`，提示词见 `docs/superpowers/prompts/2026-06-14-subscriptions-ui-redesign-deepseek.md`。

- [x] 新增 V1_10 迁移：auto_renew/archived/remaining_balance/monthly_spend/recharge_records/low_balance_notify/low_balance_threshold + subscription_categories 表
- [x] 表单按 billingType（月度/年度/一次性/买断/按量）渲染不同字段集合
- [x] 按量类型充值/记录消费/欠费通知，月初自动清零当月消费
- [x] 月度/年度自动续费：到期自动滚动到下一周期，不标记 expired
- [x] 归档（archived）独立开关，默认从列表和统计排除
- [x] Settings 新增订阅分类管理 + AI 分类识别/复用/生成
- [x] 统计面板：订阅中数量 / 月度订阅费 / 年度订阅费 / 本月待支付订阅费

### Phase 4 扩展 v2：订阅表单/状态/归档体验打磨

详细计划见 `docs/superpowers/plans/2026-06-14-subscriptions-ui-polish.md`，提示词见 `docs/superpowers/prompts/2026-06-14-subscriptions-ui-polish-deepseek.md`。

- [x] 弹层统一为响应式 Dialog（删除 SubscriptionFormSheet，参照 ToDo 弹层模式）
- [x] 分类字段改为下拉框（来源 Settings 分类），AI 自动分类按钮 hover 提示并自动写回
- [x] 月度/年度开始日期联动自动填充到期日期/下次扣费日期（+1 月/年）
- [x] 字段重命名："下次扣费"→"下次扣费日期"，"网址"→"订阅地址"
- [x] 重排"到期提醒+提前天数"为单卡片
- [x] 状态改为自动计算（active/expired/paused，去除 cancelled），表单移除手动状态选择；新增 V1_11 迁移
- [x] 新增"已归档" Tab + 取消归档操作
- [x] Settings 订阅模块新增"专用模型"配置（workflowType=subscriptions），修正 SubscriptionCategoryAiService 的 resolveModel 调用

### Phase 4 扩展 v3：用量面板隔离 + DeepSeek 余额自动监控 + 概览图表

详细计划见 `docs/superpowers/plans/2026-06-16-subscriptions-usage-redesign.md`，提示词见 `docs/superpowers/prompts/2026-06-16-subscriptions-usage-redesign-deepseek.md`。

- [x] 新增 V1_13 迁移：`subscription_balance_snapshots` 余额历史快照表
- [x] `DeepSeekBalanceClient` 调用 DeepSeek `/user/balance`，复用 `LlmConfigService` 加密存储 API Key
- [x] `SubscriptionService` 新增 `syncBalance` / `getBalanceHistory` / `syncAllEnabledBalances`；创建用量账户时立即同步一次余额（失败则整体回滚）
- [x] 新增每日定时余额同步任务
- [x] "用量面板"Tab 完全独立：独立 hooks/组件树（`pages/Subscriptions/usage/`），不再与"订阅"共用概览/汇总组件
- [x] 新建用量账户改为下拉选择监控 Provider（目前仅 DeepSeek）+ 填写 API Key，创建即自动获取余额
- [x] 用量账户卡片：内联充值/消费输入框、可折叠流水（替代弹窗）、余额迷你趋势图、"刷新余额"按钮
- [x] 概览 Tab 移除用量信息，只服务订阅；新增三块图表：未来 6 个月支出预测、分类支出占比（全币种折算为 CNY）、未来 90 天到期时间线
- [x] 新增 V1_14 迁移：`exchange_rates` 汇率缓存表；`ExchangeRateClient` 调用 Frankfurter 实时汇率 API，`ExchangeRateService` 提供 24h 缓存与定时刷新
- [x] 新增每日 00:20 `syncExchangeRates` 定时任务（早于 00:30 余额同步），新增 `GET /exchange-rates` 接口
- [x] 新增 `recharts` 依赖

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
- Subscriptions 删除 Notion 同步遗留字段（notion_page_url/notion_synced/task_id）；API 余额相关字段（api_*）保留列但 Phase 4 不暴露，等后续 API 用量拉取阶段再开放。
- Subscriptions 到期提醒新增每日自动 expired 状态扫描，并要求站内可见的到期汇总，不依赖通知渠道是否配置；微信/短信等渠道只保留 NotificationService 可插拔扩展点，不在 Phase 4 实现。
- ToDo 的通用日期组件（TodoDatePicker）在 Phase 4 中提升为 components/ui/DatePicker 供 Subscriptions 复用。

## Errors Encountered

| Error | Attempt | Resolution |
|---|---|---|
| 旧文档与新方向冲突 | 读取 docs 与 .planning | 删除旧文档，只保留当前主开发文档和当前计划 |
| 默认 Java 不支持 release 21 | `mvn -q -Dtest=TodoServiceTest test` | 改用 `mise exec java@21 -- mvn ...` 运行后端验证 |
| Flyway V1.5 启动失败：`column "key" does not exist` | 启动 local profile | 将 `system_configs.key` 修正为 `system_configs.config_key`，并新增迁移脚本列名测试 |
