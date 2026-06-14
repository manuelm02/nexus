# Subscriptions Phase 4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把现存的旧版 Subscriptions CRUD（Forge 时代遗留，含 Notion 同步字段、未使用的 API 余额字段、不符合当前 DESIGN.md 的 UI）改造为 Phase 4 定义的“基础订阅管理”：CRUD、手动用量、到期提醒（含到期自动状态、站内可见提示），API 用量拉取继续后置。

**Architecture:** 后端保留 `subscriptions` 表为唯一数据源，删除 Notion 同步遗留列，保留（但不暴露）API 余额相关列供后续阶段使用；新增 `SubscriptionResponse` DTO 屏蔽未启用字段；新增每日自动到期状态扫描，复用现有 `NotificationService` 多实现机制做到期提醒（不新增渠道，但要在代码中保留可插拔扩展点说明）。前端按 AGENTS.md 响应式规范重构为 `index.tsx` 编排 + `SubscriptionsDesktopView` / `SubscriptionsMobileView`，并把 `TodoDatePicker` 提升为通用 `DatePicker` 共享组件复用于订阅日期字段。

**Tech Stack:** Spring Boot 3.3.5, Java 21, MyBatis-Plus, Flyway；React 18, Vite 5, TypeScript, TanStack Query, Tailwind v3, Radix。

---

## Background Decisions (已与用户确认，无需再问)

1. 删除 `subscriptions.notion_page_url` / `notion_synced` / `task_id` 三列（新增 Flyway 迁移 `DROP COLUMN`），同步清理实体、DTO、前端类型中的引用（前端类型当前已不含这些字段）。
2. 保留 `api_provider` / `api_key_masked` / `api_fetch_enabled` / `api_last_fetched_at` / `api_balance_json` 五列（schema 不动），但 Phase 4 的 Service / Response DTO / 前端完全不暴露这些字段，等后续“API 用量拉取”阶段再开放。
3. 新增每日定时任务：`status = 'active'` 且 `expire_date < today` 的订阅自动置为 `expired`；用户仍可手动改回 `active` 或设为 `cancelled` / `paused` 续期。
4. 到期提醒：沿用现有 `NotificationService`（当前仅 Telegram 实现）按 `NotificationEvent.SUBSCRIPTION_EXPIRING` 发送；**同时**前端页面本身要展示“即将到期 / 已到期”的站内可见提示（汇总卡 + 列表 chip），即使未配置任何通知渠道也能看到。微信/短信等新增渠道的开发入口 = 新增一个实现 `NotificationService` 的 `@Component`（接口已是 `List<NotificationService>` 注入，天然可插拔），本阶段只需在代码注释中说明这一扩展点，不实现具体渠道。

## Non-Goals（明确不做）

- 不实现 API 用量/余额自动拉取（`api_*` 字段保持休眠）。
- 不实现微信、短信等新通知渠道的具体逻辑，只保留架构扩展点。
- 不自动滚动 `next_billing_date`（用户手动维护，与 ToDo 不自动 rollover 的产品哲学一致）。
- 不引入新的 UI 组件库；新增的通用 `DatePicker` 仍基于现有 Radix Popover 实现。
- 不做多用户/多账本，沿用现有单用户模型。

---

## Database Migration

### 新增 `backend/src/main/resources/db/migration/V1_9__subscriptions_phase4_cleanup.sql`

```sql
ALTER TABLE subscriptions
    DROP COLUMN IF EXISTS notion_page_url,
    DROP COLUMN IF EXISTS notion_synced,
    DROP COLUMN IF EXISTS task_id;
```

- 不要修改 `V1_2__init_core_modules.sql`（已应用，不可改）。
- 新增迁移脚本测试（见后端测试章节）防止再次出现列名/写法回归。

---

## Backend Tasks

### 1. 实体清理

- [ ] `backend/src/main/java/com/nexus/entity/Subscription.java`：删除 `notionPageUrl` / `notionSynced` / `taskId` 三个字段；保留 `apiProvider` / `apiKeyMasked` / `apiFetchEnabled` / `apiLastFetchedAt` / `apiBalanceJson`（仅实体层保留映射，不在 Phase 4 响应中暴露）。

### 2. 新增 `SubscriptionResponse` DTO

新增 `backend/src/main/java/com/nexus/dto/response/SubscriptionResponse.java`，字段：

```text
id, name, category, price, currency, billingType,
startDate, expireDate, nextBillingDate,
usageLimit, usageUsed, usageUnit,
url, notes, status,
notifyEnabled, notifyDaysBefore,
createdAt, updatedAt
```

- 不包含任何 `api_*`、Notion 相关字段。
- 提供 `static SubscriptionResponse from(Subscription entity)` 静态工厂方法，Javadoc 说明“Phase 4 不暴露 API 余额字段，等待后续阶段”。

### 3. Service 层调整 — `SubscriptionService.java`

- [ ] `list()` / `create()` / `update()` / `updateUsage()` 返回类型改为 `SubscriptionResponse`（内部仍用 `Subscription` 实体操作 mapper，最后统一 `SubscriptionResponse.from(...)`）。
- [ ] `update()` 中 `status` 字段做白名单校验：仅允许 `active|expired|cancelled|paused`，非法值抛 `IllegalArgumentException("Subscription 状态不合法: " + status)`（与现有 `getOrThrow` 的错误处理风格一致，不引入新的全局异常处理器）。
- [ ] 新增 `int autoExpireOverdue()`：

```java
/**
 * 将状态为 active 且已过期的订阅自动置为 expired。
 * 由 SubscriptionNotifyScheduler 每日调用；用户仍可手动改回 active/cancelled/paused。
 * @return 本次自动置为 expired 的记录数，便于调度日志和测试断言
 */
public int autoExpireOverdue() {
    return subscriptionMapper.update(null, new LambdaUpdateWrapper<Subscription>()
            .set(Subscription::getStatus, "expired")
            .eq(Subscription::getStatus, "active")
            .isNotNull(Subscription::getExpireDate)
            .lt(Subscription::getExpireDate, LocalDate.now()));
}
```

- [ ] `create()` 中 `currency` 默认值、`status` 默认 `"active"` 等现有逻辑保留。

### 4. Controller 调整 — `SubscriptionController.java`

- [ ] 所有返回类型从 `Subscription` / `List<Subscription>` 改为 `SubscriptionResponse` / `List<SubscriptionResponse>`。
- [ ] 路由不变（`/api/v1/subscriptions`，保留 `/api/v1/ledger` 兼容别名）。

### 5. Scheduler 调整 — `SubscriptionNotifyScheduler.java`

- [ ] 新增方法 `markExpiredSubscriptions()`，`@Scheduled(cron = "0 5 0 * * *")`（每天 00:05，早于 09:00 的到期提醒任务），调用 `subscriptionService.autoExpireOverdue()` 并记录日志（自动置为 expired 的数量）。
- [ ] 在类顶部 Javadoc 补充一句说明：“到期提醒目前仅 Telegram；新增提醒渠道（微信/短信）只需新增实现 `NotificationService` 的 `@Component`，本类按 `List<NotificationService>` 自动遍历，无需修改本类逻辑。”
- [ ] 现有 `checkSubscriptionExpiry()` 逻辑不变（仍基于 `selectExpiringSoon`）。

### 6. 后端测试

新增 `backend/src/test/java/com/nexus/service/SubscriptionServiceTest.java`，覆盖：

```text
- create 默认 status=active、currency 默认 CNY
- update 修改 status 为非法值时抛出异常
- update 修改各字段（含日期、用量字段）正确写入
- updateUsage 正确更新 usageUsed
- autoExpireOverdue：active + expire_date < today -> expired；
  active + expire_date >= today 不受影响；
  非 active 状态不受影响
- SubscriptionResponse.from 不包含 apiProvider/apiBalanceJson 等字段
  （可通过反射或直接断言 JSON 序列化结果不含相关 key）
```

新增/扩展迁移测试：在现有迁移测试套件中（参考 `SystemConfigMigrationTest` 风格）新增对 `V1_9__subscriptions_phase4_cleanup.sql` 的列存在性断言（迁移后 `notion_page_url` 等列应不存在，`api_provider` 等列应仍存在）。

---

## Frontend Tasks

### 1. 提取通用 `DatePicker`

- [ ] 新增 `frontend/src/components/ui/DatePicker.tsx`，从 `frontend/src/pages/ToDo/components/TodoDatePicker.tsx` 提取通用日期选择逻辑，组件改名为 `DatePicker`，props 保持一致（`value/onChange/allowClear/showQuickChips/compact/invalid/placeholder`）。
- [ ] `todayString` 等工具函数如果只在 ToDo 用，留在 `todo.shared.ts`；`DatePicker` 内部对 `today` 的依赖改为内联实现（避免跨 feature import）。
- [ ] `TodoDatePicker.tsx` 改为对 `DatePicker` 的薄包装（`export const TodoDatePicker = DatePicker` 或直接更新所有 ToDo 内的 import 为 `DatePicker`，二选一，保持改动最小）。
- [ ] Subscriptions 的 `startDate` / `expireDate` / `nextBillingDate` 三个日期字段统一使用 `DatePicker`（`allowClear` 均为 true）。

### 2. 类型与 API

- [ ] `frontend/src/types/domain.types.ts`：`Subscription` 接口字段核对，确认与 `SubscriptionResponse` 一致（当前接口已不含 `notion_*`/`api_*`，预期无需改动；若有出入以后端 `SubscriptionResponse` 为准做最小调整）。
- [ ] `frontend/src/api/subscription.api.ts`：接口签名不变（`list/create/update/delete/updateUsage`）。

### 3. 共享逻辑 — `frontend/src/pages/Subscriptions/subscriptions.shared.ts`

新增文件，集中：

```text
- STATUS_LABELS / STATUS_STYLES（4 种状态，用 hsl(var(--xxx)) 设计 token，对齐 ToDo PRIORITY_STYLES 写法）
- BILLING_TYPE_LABELS 复用 lib/constants.ts 既有导出
- daysUntil(dateStr): number | null
- isExpiringSoon(item): boolean   // status === 'active' && daysUntil(expireDate) 在 [0, notifyDaysBefore] 区间
- isExpired(item): boolean        // status === 'expired'
- groupMonthlyTotalsByCurrency(items): Record<currency, number>  // 仅 status==='active' && billingType==='monthly'
- usagePercent(item): number | null  // usageUsed / usageLimit * 100，usageLimit 为空时返回 null
```

### 4. 数据编排 — `frontend/src/pages/Subscriptions/index.tsx`

- [ ] 保留并迁移现有 query/mutation（list/create/update/delete/updateUsage）。
- [ ] 新增本地 UI 状态：当前打开的表单（新建/编辑）、待删除项的二次确认态、状态筛选 chip 的选中值。
- [ ] 派生数据：`monthlyTotals`、`expiringSoonItems`、`expiredItems`、按筛选 chip 过滤后的列表。
- [ ] 渲染 `SubscriptionsDesktopView` 或 `SubscriptionsMobileView`（按 AGENTS.md 响应式规范用 `md:` 断点切换，业务逻辑只写一套）。

### 5. 视图组件

新增：

```text
frontend/src/pages/Subscriptions/SubscriptionsDesktopView.tsx
frontend/src/pages/Subscriptions/SubscriptionsMobileView.tsx
frontend/src/pages/Subscriptions/components/SubscriptionCard.tsx
frontend/src/pages/Subscriptions/components/SubscriptionFormFields.tsx
frontend/src/pages/Subscriptions/components/SubscriptionFormDialog.tsx   // 桌面 modal
frontend/src/pages/Subscriptions/components/SubscriptionFormSheet.tsx    // 移动 bottom sheet
frontend/src/pages/Subscriptions/components/UsagePopover.tsx
frontend/src/pages/Subscriptions/components/SummaryBar.tsx
```

#### SummaryBar

- 按币种展示“月度支出（订阅中）”：`monthlyTotals` 每个币种一张小卡片或一行（如 `¥128.00` / `$9.99`）。
- “即将到期 N”、“已到期 N” 两个站内可见徽标/计数，点击可作为筛选 chip 的快捷入口（点击即把状态筛选切到 expiring/expired 等价视图）。

#### SubscriptionCard

- 展示：name、category badge、price + billingType、expireDate（若 `isExpiringSoon` 用警示色 chip，若 `isExpired` 用另一种 chip）、status chip、用量进度条（`usageLimit` 存在时显示 `usageUsed/usageLimit usageUnit` 进度条，使用 `usagePercent`）。
- 操作：编辑（打开表单 dialog/sheet）、删除（沿用 ToDo 的“按钮旁上浮二次确认”模式，不用嵌套 modal）、记录用量（打开 `UsagePopover`，`usageLimit` 为空时不显示该按钮）。

#### SubscriptionFormFields / Dialog / Sheet

- 字段：`name*`、`category`、`price` + `currency`、`billingType`（Radix Select，对齐 ToDo 历史筛选的自绘 Select 风格）、`startDate` / `expireDate` / `nextBillingDate`（均用新 `DatePicker`）、`usageLimit` + `usageUnit`、`url`、`notes`、`notifyEnabled`（开关）+ `notifyDaysBefore`（数字输入，`notifyEnabled` 关闭时禁用）、`status`（仅编辑时可见，Radix Select，4 个选项）。
- 桌面用 Dialog（参考 ToDo 详情 dialog 尺寸），移动用 bottom sheet（参考 ToDo 详情 sheet 的 handle/操作区布局）。

#### UsagePopover

- 展示当前 `usageUsed / usageLimit usageUnit` 和进度条。
- 提供一个数字输入框（默认填当前 `usageUsed`）+ “保存”按钮，调用 `updateUsage`；额外提供一个“+1”快捷按钮（对 `per_token`/计数类用量友好），点击即 `usageUsed + 1` 并立即保存。

### 6. 状态/到期视觉规范

- Status chip 颜色对齐 ToDo 的 `hsl(var(--success/warning/destructive/...))` token 写法，不要用旧的 `bg-green-50 text-green-600` 这类硬编码 Tailwind 色。
- 即将到期：`hsl(var(--warning))` 系；已到期：`hsl(var(--destructive))` 系；订阅中：`hsl(var(--success))` 系；已取消/已暂停：`text-muted-foreground` 系。
- 卡片 radius、边框、阴影遵循 `.design/DESIGN.md`：卡片 `rounded-lg`（12px）或与 ToDo 列表行一致的 `rounded-lg` + hairline border + Level-1 shadow，按钮 `rounded-md`（8px），输入框 `rounded-xs`（4px，若项目 token 命名不同以现有 ToDo/Inbox 实现为准，不引入新 token）。

---

## Manual Verification

```bash
cd frontend && pnpm build
cd backend && JAVA_HOME=/Users/manuelm/.local/share/mise/installs/java/21.0.2 \
  PATH=/Users/manuelm/.local/share/mise/installs/java/21.0.2/bin:/Users/manuelm/.local/share/mise/installs/maven/3.9.2/apache-maven-3.9.2/bin:/usr/bin:/bin:/usr/sbin:/sbin \
  mvn test
```

启动本地后端验证 Flyway V1.9 迁移成功应用（日志中应看到 migration successfully applied），随后停止临时进程。

---

## Open Questions for User (实现过程中如遇到，暂停并询问)

- `usageUsed` 是否允许为负数 / 是否需要在“+1”快捷按钮基础上也支持“-1”（如订阅周期重置用量）？默认本计划假设只允许 >= 0，且不提供自动按周期重置。
- `category` 是否需要从自由文本升级为预设分类下拉（如 AI工具/云服务/订阅媒体等）？默认本计划保持自由文本输入。
- 站内“已到期”提示是否需要在全局（如 Sidebar/Profile）出现红点，还是只在 `/subscriptions` 页面内？默认本计划只在 `/subscriptions` 页面内展示。
