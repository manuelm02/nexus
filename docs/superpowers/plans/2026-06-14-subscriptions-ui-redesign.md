# Subscriptions UI 重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 按 task 逐项实施。步骤使用 checkbox（`- [ ]`）语法跟踪。

**Goal:** 在 `docs/superpowers/plans/2026-06-14-subscriptions-phase-4.md`（基础 CRUD/到期提醒）完成的基础上，把 Subscriptions 页面重构为按订阅类型（月度/年度/一次性/买断/按量）展示不同表单和卡片的产品形态，新增分类管理（Settings 可配置 + AI 识别/复用/生成）、按量充值与消费记录、自动续费滚动、归档、以及订阅统计面板。

**Architecture:**
- 后端 `subscriptions` 表新增字段（自动续费、归档、按量余额/消费/充值记录、欠费通知阈值），新增 `subscription_categories` 表用于 Settings 中维护可选分类；`SubscriptionCategoryAiService`（参照 `BookmarkAiService` / `NoteAiService` 的 `LlmConfigService.resolveModel` 用法）提供分类识别/复用/新建。
- `SubscriptionNotifyScheduler` 扩展：自动续费滚动（按 billingType 周期前移日期）、月初重置 `monthly_spend`、欠费提醒。
- 前端 `SubscriptionFormFields` 拆分为按 `billingType` 渲染的子表单；`SubscriptionCard` 按类型展示不同信息；新增 `SubscriptionsStatsBar`（4 个统计项）；Settings 新增"订阅分类管理"面板；分类输入框支持"AI 识别"按钮。

**Tech Stack:** Spring Boot 3.3.5, Java 21, MyBatis-Plus, Flyway, LangChain4j 0.35.0；React 18, Vite 5, TypeScript, TanStack Query, Tailwind v3, Radix, shadcn/ui。

---

## Background Decisions（已与用户确认，无需再问）

1. **billingType 不改名**：沿用现有 5 个值 `monthly|yearly|one_time|lifetime|per_token`，对应 月度/年度/一次性/买断/按量（`per_token` 中文标签已是"按量"，前端 label 不变）。
2. **自动续费滚动覆盖 Phase 4 的 non-goal**：仅当 `autoRenew=true`（monthly/yearly 专属字段）且 `status=active` 时，每日任务把已过期的 `expireDate`/`nextBillingDate` 按 billingType 周期（月度 +1 月，年度 +1 年）前移，重复直到 >= today，且**不**置为 `expired`。`autoRenew=false` 的 monthly/yearly、以及 `one_time` 继续走现有 `autoExpireOverdue`（过期即 `expired`）。`lifetime` 和 `per_token` 不参与到期/续费扫描。
3. **归档（archived）是独立布尔字段，不是 status**：所有类型都有"归档"开关。归档订阅默认从列表和统计中排除，列表提供"显示归档"筛选 chip 查看。
4. **按量类型新增**：`remaining_balance`（剩余金额）、`monthly_spend`（当月消费金额，月初自动清零）、`recharge_records`（JSONB 数组，倒序展示）、`low_balance_notify` + `low_balance_threshold`（欠费通知）。"记录消费"和"充值"是两个独立动作：充值增加 `remaining_balance` 并追加一条 `recharge_records`；记录消费减少 `remaining_balance` 并累加 `monthly_spend`，不写入 `recharge_records`。
5. **订阅分类**：新增 `subscription_categories` 表（id, name, created_at），Settings 页面提供增删管理。`Subscription.category` 仍是字符串字段（不做外键约束，允许历史脏数据），但新增/编辑表单的分类输入框提供"AI 识别"按钮：
   - 调用新增端点，传入订阅名称（+可选备注/URL）；
   - 若 `subscription_categories` 为空：AI 直接生成一个合适分类名，写入表并返回；
   - 若非空：AI 在现有分类列表中选择最合适的一个并返回；若都不合适，AI 生成新分类名、写入表并返回；
   - 前端拿到返回值后自动填充分类输入框（用户仍可手动修改/覆盖）。
6. **统计面板 4 项**：订阅中数量（`status=active && !archived`）、月度订阅费（`billingType=monthly && active && !archived`，按币种分组求和）、年度订阅费（`billingType=yearly && active && !archived`，按币种分组）、本月待支付订阅费（见下方"统计口径"）。`per_token` 和 `lifetime` 不计入金额类统计。
7. **表单按类型动态渲染**，字段集合严格按用户给出的 5 张表（见下方"按类型字段矩阵"），不混用。

## Non-Goals（明确不做）

- 不做多货币汇率换算；统计按币种分组展示，不合并成单一数字。
- 不做 `recharge_records` 的编辑/删除，只支持追加（充值记录是流水，不可篡改）。
- 不做分类的合并/重命名 UI（Settings 只提供新增/删除）；删除分类不会级联修改已使用该分类名的订阅。
- 不做 `monthly_spend` 的历史归档（月初清零后不保留上月快照）。
- 不实现微信/短信欠费通知渠道，仅复用现有 `NotificationService` 多实现扩展点（与 Phase 4 一致）。
- API 余额自动拉取（`api_*` 字段）继续保持 Phase 4 的"不暴露"状态，本次不涉及。

## 按类型字段矩阵（前端表单 + 卡片展示依据）

| 字段 | 月度/年度 | 一次性 | 买断 | 按量 |
|---|---|---|---|---|
| 名称 name | ✅ | ✅ | ✅ | ✅ |
| 分类 category（含 AI 识别） | ✅ | ✅ | ✅ | ✅ |
| 价格+货币 price/currency | ✅ | ✅ | ✅ | — |
| 开始日期 startDate | ✅（订阅开始） | ✅（开始） | ✅（购买日期，复用 startDate，仅改 label） | — |
| 结束日期 expireDate | ✅ | ✅（结束） | — | — |
| 是否自动续费 autoRenew | ✅ | — | — | — |
| 通知开关+提前天数 notifyEnabled/notifyDaysBefore | ✅（续费/到期提醒） | ✅（结束提醒） | — | — |
| 状态 status | ✅（编辑时） | ✅（编辑时） | ✅（编辑时，仅 active/cancelled/paused，不参与 autoExpire） | ✅ |
| 剩余金额 remainingBalance | — | — | — | ✅ |
| 当月消费金额 monthlySpend（只读+记录消费动作） | — | — | — | ✅ |
| 充值记录 rechargeRecords（只读列表+充值动作） | — | — | — | ✅ |
| 欠费通知 lowBalanceNotify/lowBalanceThreshold | — | — | — | ✅ |
| 订阅链接 url | ✅ | ✅ | — | — |
| 备注 notes | ✅ | ✅ | ✅ | ✅ |
| 归档 archived | ✅ | ✅ | ✅ | ✅ |

> `lifetime` 不参与到期扫描，`status` 字段在编辑时仍可手动设为 `cancelled`/`paused`（如"不再使用但留作记录"），但白名单去掉 `expired`（lifetime 不应被系统标记为过期）。

## 统计口径（dueThisMonth / 本月待支付订阅费）

按币种分组求和，纳入条件（`active && !archived`）：
- monthly/yearly 且 `autoRenew=true`：`nextBillingDate` 落在本月。
- monthly/yearly 且 `autoRenew=false`：`expireDate` 落在本月。
- `one_time`：`expireDate` 落在本月。
- `lifetime` / `per_token`：不纳入。

> 自动续费滚动任务会在到期当天把日期前移到下一周期，因此"本月待支付"天然只包含尚未滚动过的、真正待处理的项目。

---

## Database Migration

### 新增 `backend/src/main/resources/db/migration/V1_10__subscriptions_redesign.sql`

```sql
ALTER TABLE subscriptions
    ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS remaining_balance NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS monthly_spend NUMERIC(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS recharge_records JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS low_balance_notify BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS low_balance_threshold NUMERIC(12,2);

CREATE TABLE IF NOT EXISTS subscription_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(64) NOT NULL UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);
```

- 不要修改 V1_2 ~ V1_9（V1_9 是 Phase 4 基础 CRUD 的迁移，按其计划保持原样）。
- `gen_random_uuid()` 需确认项目已启用 `pgcrypto` 扩展（沿用其他表的 UUID 生成方式；若其他表用应用层生成 UUID 而非数据库默认值，`subscription_categories.id` 改为与现有表一致的写法，不要引入新的 UUID 生成约定）。
- 新增迁移列存在性测试（参考 `ModuleTableNamingMigrationTest` / Phase 4 迁移测试风格）。

---

## Backend Tasks

### 1. 实体与 DTO

- [ ] `entity/Subscription.java`：新增 `autoRenew`(boolean)、`archived`(boolean)、`remainingBalance`(BigDecimal)、`monthlySpend`(BigDecimal)、`rechargeRecords`(`List<RechargeRecordItem>`，`@TableField(typeHandler = JacksonTypeHandler.class)`，参照现有 `apiBalanceJson` 的写法)、`lowBalanceNotify`(boolean)、`lowBalanceThreshold`(BigDecimal)。
- [ ] 新增 `entity/SubscriptionCategory.java`（id, name, createdAt），对应 `subscription_categories` 表，新增 `mapper/SubscriptionCategoryMapper.java`。
- [ ] 新增内部值对象 `dto/RechargeRecordItem.java`（或放在合适的包内）：`{ id: String(UUID), amount: BigDecimal, date: LocalDate, note: String, balanceAfter: BigDecimal, createdAt: LocalDateTime }`，需可被 Jackson 序列化/反序列化用于 JSONB。
- [ ] `SubscriptionCreateRequest` / `SubscriptionUpdateRequest`：新增上述新字段（`autoRenew`/`archived`/`lowBalanceNotify`/`lowBalanceThreshold`/`remainingBalance` 等可空，遵循现有 PATCH 语义；`monthlySpend`/`rechargeRecords` **不**通过通用 update 修改，单独走专用端点）。
- [ ] `SubscriptionResponse`：补充新字段（含 `rechargeRecords`），保持不暴露 `api_*` 字段的既有约定。
- [ ] 新增 `dto/request/SubscriptionRechargeRequest.java`：`{ amount: BigDecimal(必填,>0), date: LocalDate(可空,默认今天), note: String(可空) }`。
- [ ] 新增 `dto/request/SubscriptionConsumeRequest.java`：`{ amount: BigDecimal(必填,>0), note: String(可空) }`。
- [ ] 新增 `dto/response/SubscriptionStatsResponse.java`：`{ activeCount: int, monthlyTotal: Map<String,BigDecimal>, yearlyTotal: Map<String,BigDecimal>, dueThisMonth: Map<String,BigDecimal> }`（key 为 currency code）。
- [ ] 新增 `dto/request/SubscriptionCategorySuggestRequest.java`：`{ name: String(必填), notes: String(可空) }`。
- [ ] 新增 `dto/response/SubscriptionCategorySuggestResponse.java`：`{ category: String, isNew: boolean }`。
- [ ] 新增 `dto/response/SubscriptionCategoryResponse.java` / `dto/request/SubscriptionCategoryCreateRequest.java`：`{ id, name, createdAt }` / `{ name: String(必填) }`。

### 2. Service 层

`SubscriptionService.java` 新增/调整：

- [ ] `create()`/`update()` 写入新字段；`update()` 中 `status` 白名单：
  - 通用四态 `active|expired|cancelled|paused` 保持；
  - 若订阅 `billingType == "lifetime"`，禁止将 `status` 设为 `expired`（抛出与现有风格一致的 `IllegalArgumentException`）。
- [ ] 新增 `SubscriptionResponse recharge(String id, SubscriptionRechargeRequest req)`：
  - `remainingBalance = (remainingBalance ?? 0) + amount`；
  - 向 `rechargeRecords` **头部**插入一条 `{id: UUID随机, amount, date: req.date ?? today, note, balanceAfter: 新余额, createdAt: now}`；
  - 仅适用于 `billingType == "per_token"`，否则抛出 `IllegalArgumentException`。
- [ ] 新增 `SubscriptionResponse consume(String id, SubscriptionConsumeRequest req)`：
  - `remainingBalance = (remainingBalance ?? 0) - amount`（允许为负，代表欠费）；
  - `monthlySpend = (monthlySpend ?? 0) + amount`；
  - 不写入 `rechargeRecords`；仅适用于 `billingType == "per_token"`。
- [ ] 新增 `SubscriptionStatsResponse stats()`：按 Background Decisions #6 / 统计口径计算，使用 `list()` 已有数据在内存中按 `currency` 分组求和（订阅总量级别小，不需要 SQL 聚合；若现有同类统计已有 SQL 聚合写法，按现有写法为准）。
- [ ] 新增 `int rollAutoRenewals()`：
  ```text
  对所有 status=active && autoRenew=true && billingType in (monthly, yearly) 的记录：
    while expireDate != null && expireDate < today:
        period = billingType == "monthly" ? 1个月 : 1年
        expireDate = expireDate.plus(period)
        if nextBillingDate != null: nextBillingDate = nextBillingDate.plus(period)
    保存变更，返回受影响记录数
  ```
- [ ] 新增 `int resetMonthlySpend()`：把所有 `billingType=per_token` 的 `monthlySpend` 置 0，返回受影响记录数（每月 1 日调用）。
- [ ] 新增 `List<SubscriptionResponse> findLowBalance()`（或在 scheduler 内直接查询）：`billingType=per_token && lowBalanceNotify=true && remainingBalance < lowBalanceThreshold && !archived`，供欠费通知使用。

新增 `SubscriptionCategoryService`：

- [ ] `list()`：返回全部分类，按 `name` 排序。
- [ ] `create(String name)`：去重（已存在则直接返回已有记录，不抛异常——AI 识别流程会频繁尝试插入同名分类）。
- [ ] `delete(id)`。

新增 `SubscriptionCategoryAiService`（参照 `BookmarkAiService`/`NoteAiService` 的 `LlmConfigService.resolveModel(workflowType)` 用法，确认是否需要新增 workflow type，若现有某个通用/兜底 workflow type 适用则复用，不要新增 system_configs 迁移除非必要）：

- [ ] `suggest(SubscriptionCategorySuggestRequest req)`：
  1. 读取 `subscription_categories` 全部 `name`；
  2. 若为空：让 LLM 根据 `name`(+`notes`) 直接生成一个简短分类名（如"AI 工具"、"云服务"、"流媒体"），写入 `subscription_categories`，返回 `{category, isNew: true}`；
  3. 若非空：把现有分类列表传给 LLM，要求其在列表中选择最匹配的一个，或在都不合适时生成新分类名；若 LLM 选择新分类名，写入 `subscription_categories`（去重）；返回 `{category, isNew}`；
  4. LLM 调用失败时降级：返回 `{category: req.getName() 的简单规则推断 或 "未分类", isNew: false}`，不抛异常（与 `BookmarkAiService` 的"AI 失败自动降级"原则一致）。

### 3. Controller

`SubscriptionController.java` 新增端点：

```text
POST   /api/v1/subscriptions/{id}/recharge        -> recharge()
POST   /api/v1/subscriptions/{id}/consume         -> consume()
GET    /api/v1/subscriptions/stats                -> stats()
POST   /api/v1/subscriptions/category-suggest     -> SubscriptionCategoryAiService.suggest()
```

新增 `SubscriptionCategoryController`：

```text
GET    /api/v1/subscription-categories        -> list
POST   /api/v1/subscription-categories        -> create
DELETE /api/v1/subscription-categories/{id}   -> delete
```

> 注意路由顺序：`/api/v1/subscriptions/stats` 和 `/api/v1/subscriptions/category-suggest` 是静态路径，必须在 `@PathVariable` 的 `/{id}` 系列映射中不产生歧义（Spring 按特定度优先匹配，一般无需特殊处理，但写完后用 manual curl 验证一次 `/stats` 不会被 `/{id}` 误捕获）。

### 4. Scheduler

`SubscriptionNotifyScheduler.java`：

- [ ] 新增 `rollAutoRenewals()`：`@Scheduled(cron = "0 5 0 * * *")`（与现有 `markExpiredSubscriptions` 同时段，可在同一方法内顺序调用：先 `rollAutoRenewals()` 再 `markExpiredSubscriptions()`，避免 `autoRenew=true` 的记录被误判过期——顺序很重要）。
- [ ] 新增 `resetMonthlySpend()`：`@Scheduled(cron = "0 10 0 1 * *")`（每月 1 日 00:10）。
- [ ] 新增 `checkLowBalance()`：可与现有 `checkSubscriptionExpiry()`（09:00）同时段调用，对 `findLowBalance()` 结果发送 `NotificationEvent.SUBSCRIPTION_LOW_BALANCE`（若 `NotificationEvent` 是枚举，新增该常量；payload 含 `{name, remainingBalance, threshold}`）。

### 5. 后端测试

- [ ] `SubscriptionServiceTest` 新增用例：
  - `recharge`：余额正确累加，`rechargeRecords` 头部插入新记录且包含 `balanceAfter`；对非 `per_token` 类型抛异常。
  - `consume`：余额正确扣减（可为负），`monthlySpend` 正确累加；对非 `per_token` 类型抛异常。
  - `rollAutoRenewals`：`autoRenew=true` 的 monthly/yearly 过期记录被前移到 >= today 且仍为 `active`；`autoRenew=false` 不受影响。
  - `resetMonthlySpend`：所有 `per_token` 记录 `monthlySpend` 清零。
  - `stats()`：按 currency 分组的 monthly/yearly/dueThisMonth 计算正确，`archived=true` 和非 `active` 不计入。
  - `lifetime` 类型 `update status=expired` 抛异常。
- [ ] 新增 `SubscriptionCategoryServiceTest`：`create` 去重、`list` 排序。
- [ ] 新增 `SubscriptionCategoryAiServiceTest`：空分类列表时生成并持久化；非空列表时复用已有分类；LLM 异常时降级返回，不抛异常（可参照 `BookmarkAiService` 测试中 mock `ChatLanguageModel` 的写法）。
- [ ] V1_10 迁移列/表存在性测试。

---

## Frontend Tasks

### 1. 类型与 API

- [ ] `frontend/src/types/domain.types.ts`：`Subscription` 接口补充 `autoRenew`、`archived`、`remainingBalance?`、`monthlySpend`、`rechargeRecords: RechargeRecord[]`、`lowBalanceNotify`、`lowBalanceThreshold?`；新增 `RechargeRecord { id, amount, date, note?, balanceAfter, createdAt }`；新增 `SubscriptionCategory { id, name, createdAt }`；新增 `SubscriptionStats { activeCount, monthlyTotal, yearlyTotal, dueThisMonth }`（后三者 `Record<string, number>`）。
- [ ] `frontend/src/api/subscription.api.ts`：新增 `recharge(id, {amount, date?, note?})`、`consume(id, {amount, note?})`、`stats()`、`suggestCategory({name, notes?})`。
- [ ] 新增 `frontend/src/api/subscriptionCategory.api.ts`：`list/create/delete`。

### 2. 共享逻辑 `subscriptions.shared.ts`

- [ ] 补充按类型的字段可见性映射（驱动表单和卡片渲染），即"按类型字段矩阵"表格的代码化（例如 `FIELD_VISIBILITY: Record<billingType, Set<fieldKey>>` 或每类型一个白名单数组）。
- [ ] `isDue(item)` / `dueDateLabel(item)`：按类型返回应展示的"到期/结束/续费"日期及其语义标签（月度/年度展示 `nextBillingDate` 或 `expireDate`，一次性展示 `expireDate`，买断展示购买日期，按量不展示）。
- [ ] `formatRechargeRecord()` 等展示辅助函数。

### 3. Settings：订阅分类管理

- [ ] 新增 `frontend/src/pages/Settings/components/SubscriptionCategoriesPanel.tsx`：展示分类列表（chip + 删除按钮）+ 新增输入框，参照现有 Settings 面板（如 `InboxSettingsPanel`）的卡片/列表样式和 mutation 写法。
- [ ] 接入 `SettingsDesktopView.tsx` / `SettingsMobileView.tsx`。

### 4. Subscriptions 页面重构

新增/调整文件：

```text
frontend/src/pages/Subscriptions/index.tsx                          # 编排：新增 stats query、category list query
frontend/src/pages/Subscriptions/SubscriptionsDesktopView.tsx
frontend/src/pages/Subscriptions/SubscriptionsMobileView.tsx
frontend/src/pages/Subscriptions/components/SubscriptionsStatsBar.tsx   # 新增：4 个统计卡
frontend/src/pages/Subscriptions/components/SubscriptionCard.tsx       # 改造：按类型渲染不同信息
frontend/src/pages/Subscriptions/components/SubscriptionFormFields.tsx # 改造：按类型渲染不同字段集合
frontend/src/pages/Subscriptions/components/CategoryInput.tsx          # 新增：分类输入框 + "AI 识别"按钮 + 现有分类下拉建议
frontend/src/pages/Subscriptions/components/UsagePopover.tsx           # 改造为按量专用：充值 + 记录消费 + 充值记录列表
frontend/src/pages/Subscriptions/components/SummaryBar.tsx             # 保留"即将到期/已到期"筛选，与 StatsBar 并存或合并
```

#### SubscriptionsStatsBar

- 4 个统计卡：订阅中数量（单一数字）、月度订阅费、年度订阅费、本月待支付订阅费（后三者按币种展示，多币种时每个卡内可堆叠多行，如 `¥128.00` 一行 `$9.99` 一行）。
- 数据来自 `GET /subscriptions/stats`，loading 态用 skeleton，沿用 `.nexus-surface` 卡片样式。

#### CategoryInput

- 文本输入框（可手动输入任意分类名）+ 右侧"AI 识别"按钮（图标按钮，loading 态用 spinner）。
- 点击 AI 识别：调用 `suggestCategory({name: 当前表单 name 字段值, notes: 当前 notes 字段值})`，成功后把返回的 `category` 写入分类字段；若返回 `isNew: true` 且本地分类列表缓存未包含该分类，触发 `subscription-categories` query 的 invalidate。
- 输入框下方/旁提供现有分类的快捷选择（如简单的 datalist 或 Radix Popover 列表，点击直接填充），数据来自 `subscriptionCategory.api.list()`。
- name 为空时禁用"AI 识别"按钮（无法识别）。

#### SubscriptionFormFields（按类型动态渲染）

按 `billingType` 的当前选中值，从"按类型字段矩阵"决定渲染哪些字段组：

```text
通用：name*、category（CategoryInput）、billingType（Select，5 选项，切换时清空/隐藏不适用字段，不清空已填的通用字段如 name/category/notes）、归档开关（archived，所有类型都在表单底部，编辑时可见；新建时默认 false 不强制展示，可放在编辑表单）

monthly/yearly：price+currency、startDate、expireDate、nextBillingDate（DatePicker）、autoRenew（Switch）、notifyEnabled+notifyDaysBefore（autoRenew 和 notify 是两个独立开关）、url、notes、status（编辑时）

one_time：price+currency、startDate、expireDate（label 为"结束日期"）、notifyEnabled+notifyDaysBefore（label 为"结束提醒"）、url、notes、status（编辑时）

lifetime：price+currency、startDate（label 为"购买日期"）、notes、status（编辑时，去掉 expired 选项）

per_token：category、status（编辑时）、remainingBalance（只读展示，通过 UsagePopover 的充值/消费动作修改，新建表单允许填初始值）、monthlySpend（只读展示）、lowBalanceNotify+lowBalanceThreshold、notes
  -- 新建表单：允许填 remainingBalance 作为初始余额；rechargeRecords/monthlySpend 新建时为空/0，不在新建表单展示
  -- 编辑表单：remainingBalance/monthlySpend 只读，通过 UsagePopover 的"充值"/"记录消费"动作变更
```

- 切换 `billingType` 时，被隐藏字段的值在表单 state 中保留（不清空），避免用户来回切换丢失输入；提交时只发送当前类型适用的字段（其余置 `undefined`，PATCH 语义不修改；新建时不适用字段不传）。

#### SubscriptionCard（按类型展示）

- 通用：name、category badge、归档徽标（`archived=true` 时显示"已归档"灰色 chip，归档项默认从列表隐藏，由筛选 chip 控制是否显示）。
- monthly/yearly：price+billingType、`autoRenew` 标识（小图标/文案"自动续费"）、到期/续费日期（`isExpiringSoon`/`isExpired` 用 warning/destructive chip）、status chip。
- one_time：price、结束日期（同上 chip 逻辑）、status chip。
- lifetime：price、购买日期、status chip（无到期概念）。
- per_token：剩余金额（`remainingBalance < lowBalanceThreshold` 时用 destructive 色高亮）、当月消费、status chip、"充值/记录消费"按钮（打开 `UsagePopover`）。
- 编辑/删除按钮位置和交互沿用 Phase 4 既有实现（删除用按钮旁上浮二次确认）。

#### UsagePopover（按量专用重构）

- 展示：剩余金额、当月消费金额、欠费阈值（若设置）。
- "充值" tab/区域：金额输入 + 日期（默认今天）+ 备注，提交调用 `recharge()`。
- "记录消费" tab/区域：金额输入 + 备注，提交调用 `consume()`。
- 充值记录列表：倒序展示 `rechargeRecords`（日期、金额、备注、充值后余额），列表过长时限制显示最近 N 条（如 10 条）+ "查看全部"（可选，若实现复杂度过高可先全部展示，不分页——以保持改动可控为先）。

### 5. 即将到期 / 已到期 / 归档筛选

- [ ] 筛选 chip 扩展：`all | expiring | expired | archived`（`archived` 筛选展示 `archived=true` 的所有记录，忽略其状态）。默认视图（`all`）排除 `archived=true`。

---

## Manual Verification

```bash
cd frontend && pnpm build
cd backend && JAVA_HOME=/Users/manuelm/.local/share/mise/installs/java/21.0.2 \
  PATH=/Users/manuelm/.local/share/mise/installs/java/21.0.2/bin:/Users/manuelm/.local/share/mise/installs/maven/3.9.2/apache-maven-3.9.2/bin:/usr/bin:/bin:/usr/sbin:/sbin \
  mvn test
```

启动本地后端验证 V1_10 迁移成功应用；手动调用：
- `POST /api/v1/subscriptions`（创建一条 `per_token` 类型）→ `POST /{id}/recharge` → `POST /{id}/consume` → `GET /{id}`（确认 `remainingBalance`/`monthlySpend`/`rechargeRecords` 正确）。
- `GET /api/v1/subscriptions/stats`（确认返回结构和分组）。
- `POST /api/v1/subscriptions/category-suggest`（空分类表 → 验证生成并持久化；再次调用同名场景 → 验证复用）。

前端：在 `/subscriptions` 页面分别创建 5 种类型订阅，确认表单字段集合符合"按类型字段矩阵"；Settings 页面增删分类后表单分类建议同步更新；统计卡数字随新增/编辑/归档变化正确刷新。

---

## Open Questions for User（实现过程中如遇到，暂停并询问）

1. `subscription_categories.id` 的 UUID 生成方式：是否所有现有表都用应用层（Java）生成 UUID 而非 `gen_random_uuid()`？若是，迁移和实体需统一改为应用层生成，保持与项目惯例一致。
2. `SubscriptionCategoryAiService` 使用的 `workflowType`：是否存在可直接复用的现有 workflow type（如 Bookmark 的标签/分组识别用的那个），还是需要新增一个（涉及 `system_configs`/`WorkflowOverrideSection` 改动）？默认本计划假设可复用现有"内容分类/标签"类 workflow，若不存在再询问用户是否新增。
3. `recharge_records` 列表过长（如 >10 条）时是否需要分页/虚拟列表，还是全部渲染即可（个人使用场景，预期数据量很小）？默认本计划全部渲染。
4. "归档"和现有 `status=paused` 是否存在语义重叠？是否需要在 UI 文案上明确区分（如 paused="暂停使用但仍计入统计的临时状态"，archived="完全不再关注，退出所有统计"）？默认本计划严格按 archived 排除统计、paused 不排除统计实现，但需要在卡片上让两者视觉上可区分。
