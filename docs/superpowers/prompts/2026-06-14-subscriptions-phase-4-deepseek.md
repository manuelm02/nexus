# Subscriptions Phase 4 DeepSeek/Codex Prompt

你是资深全栈工程师，请在 Nexus 项目中实施 Subscriptions Phase 4（基础订阅管理）。

项目路径：

```text
/Users/manuelm/Workspace/Projects/Nexus/nexus
```

开始前必须阅读：

```text
AGENTS.md
.design/DESIGN.md
docs/superpowers/plans/2026-06-14-subscriptions-phase-4.md
.planning/2026-06-09-product-roadmap/task_plan.md
```

`docs/superpowers/plans/2026-06-14-subscriptions-phase-4.md` 是本次实施的唯一详细计划，包含所有已与用户确认的决策（Background Decisions）、Non-Goals、文件清单和验收标准。本提示词只是该计划的执行摘要，**如有冲突以计划文件为准**。

## 目标

现有 `/subscriptions` 是 Forge 时代的旧版 CRUD 页面，字段和 UI 都不符合当前产品方向。本次要把它改造为：

```text
- 基础 CRUD（保留现有路由 /api/v1/subscriptions，兼容别名 /api/v1/ledger）
- 手动维护用量（usageUsed，含进度条展示和快捷 +1）
- 到期提醒：每日自动把过期的 active 订阅置为 expired；
  站内可见的“即将到期 / 已到期”汇总和 chip；
  沿用现有 NotificationService（Telegram）发送 SUBSCRIPTION_EXPIRING
- 不做 API 用量/余额自动拉取（相关字段保留但不暴露）
```

## 强制原则（来自计划文件 Background Decisions / Non-Goals）

```text
1. 新增 Flyway 迁移删除 subscriptions.notion_page_url / notion_synced / task_id 三列，
   同步删除实体字段。不要修改已应用的 V1_2 迁移脚本。
2. 保留 api_provider / api_key_masked / api_fetch_enabled / api_last_fetched_at / api_balance_json
   五列（schema 不动），但新增 SubscriptionResponse DTO，Phase 4 完全不暴露这五个字段。
3. 新增每日定时任务：status=active 且 expire_date < today 的订阅自动置为 expired。
4. 到期提醒不新增通知渠道；只在 SubscriptionNotifyScheduler 顶部注释说明
   "新增渠道只需新增实现 NotificationService 的 @Component" 这一扩展点。
5. 前端必须遵守 AGENTS.md 响应式规范：index.tsx 只做编排，
   复杂视图拆 SubscriptionsDesktopView / SubscriptionsMobileView。
6. 不引入新 UI 库；把 TodoDatePicker 提升为通用 components/ui/DatePicker.tsx 给订阅日期字段用。
7. 不自动滚动 next_billing_date，不做用量周期自动重置。
8. 所有非平凡 public 方法 / 导出组件按 AGENTS.md 写注释。
```

## 后端实现顺序

### 1. 迁移

新增 `backend/src/main/resources/db/migration/V1_9__subscriptions_phase4_cleanup.sql`：

```sql
ALTER TABLE subscriptions
    DROP COLUMN IF EXISTS notion_page_url,
    DROP COLUMN IF EXISTS notion_synced,
    DROP COLUMN IF EXISTS task_id;
```

### 2. 实体

`backend/src/main/java/com/nexus/entity/Subscription.java`：删除 `notionPageUrl`/`notionSynced`/`taskId` 字段；保留 `api_*` 五个字段的映射（不在响应中暴露）。

### 3. 新增 `SubscriptionResponse`

新增 `backend/src/main/java/com/nexus/dto/response/SubscriptionResponse.java`，字段：

```text
id, name, category, price, currency, billingType,
startDate, expireDate, nextBillingDate,
usageLimit, usageUsed, usageUnit,
url, notes, status,
notifyEnabled, notifyDaysBefore,
createdAt, updatedAt
```

提供 `static SubscriptionResponse from(Subscription entity)`，Javadoc 注明不暴露 `api_*` 字段的原因。

### 4. Service — `SubscriptionService.java`

```text
- list/create/update/updateUsage 返回 SubscriptionResponse（内部仍操作 Subscription 实体）
- update() 中 status 白名单校验：active|expired|cancelled|paused，
  非法值抛 IllegalArgumentException("Subscription 状态不合法: " + status)
- 新增 int autoExpireOverdue()：
  UPDATE subscriptions SET status='expired'
  WHERE status='active' AND expire_date IS NOT NULL AND expire_date < CURRENT_DATE
  用 LambdaUpdateWrapper 实现，返回受影响行数
```

### 5. Controller — `SubscriptionController.java`

返回类型从 `Subscription`/`List<Subscription>` 改为 `SubscriptionResponse`/`List<SubscriptionResponse>`，路由不变。

### 6. Scheduler — `SubscriptionNotifyScheduler.java`

```text
- 新增 markExpiredSubscriptions()，@Scheduled(cron = "0 5 0 * * *")，
  调用 subscriptionService.autoExpireOverdue()，记录受影响数量到日志
- 现有 checkSubscriptionExpiry() 不变
- 类顶部 Javadoc 补充通知渠道扩展点说明
```

### 7. 后端测试

新增 `backend/src/test/java/com/nexus/service/SubscriptionServiceTest.java`，覆盖：

```text
- create 默认 status=active、currency 默认 CNY
- update 非法 status 抛异常
- update 各字段写入（含日期/用量字段）
- updateUsage 正确更新 usageUsed
- autoExpireOverdue：active+已过期 -> expired；active+未过期不变；非 active 不变
- SubscriptionResponse.from 不包含 apiProvider/apiBalanceJson 等字段
```

并在迁移测试套件中新增对 V1_9 的列存在性断言（notion_* 不存在，api_* 仍存在）。

## 前端实现顺序

### 1. 提取通用 DatePicker

```text
- 新增 frontend/src/components/ui/DatePicker.tsx，从
  frontend/src/pages/ToDo/components/TodoDatePicker.tsx 提取，
  props 保持一致（value/onChange/allowClear/showQuickChips/compact/invalid/placeholder）
- today 相关逻辑改为组件内联实现，避免跨 feature import
- TodoDatePicker.tsx 改为对 DatePicker 的薄包装或更新 ToDo 内 import，
  二选一，保持改动最小，ToDo 现有行为不变
```

### 2. 类型与 API

```text
- 核对 frontend/src/types/domain.types.ts 中 Subscription 接口与后端
  SubscriptionResponse 一致（预期已一致，无需改动）
- frontend/src/api/subscription.api.ts 接口签名不变
```

### 3. 共享逻辑

新增 `frontend/src/pages/Subscriptions/subscriptions.shared.ts`：

```text
- STATUS_LABELS / STATUS_STYLES（4 种状态，对齐 ToDo PRIORITY_STYLES 的
  hsl(var(--success/warning/destructive)) 写法，不要硬编码 bg-green-50 等）
- daysUntil(dateStr): number | null
- isExpiringSoon(item): status==='active' && daysUntil(expireDate) in [0, notifyDaysBefore]
- isExpired(item): status==='expired'
- groupMonthlyTotalsByCurrency(items): Record<currency, number>（仅 active+monthly）
- usagePercent(item): number | null
```

### 4. 页面结构

```text
frontend/src/pages/Subscriptions/index.tsx                       # 编排：query/mutation/筛选状态
frontend/src/pages/Subscriptions/SubscriptionsDesktopView.tsx
frontend/src/pages/Subscriptions/SubscriptionsMobileView.tsx
frontend/src/pages/Subscriptions/components/SummaryBar.tsx
frontend/src/pages/Subscriptions/components/SubscriptionCard.tsx
frontend/src/pages/Subscriptions/components/SubscriptionFormFields.tsx
frontend/src/pages/Subscriptions/components/SubscriptionFormDialog.tsx
frontend/src/pages/Subscriptions/components/SubscriptionFormSheet.tsx
frontend/src/pages/Subscriptions/components/UsagePopover.tsx
```

要求：

```text
- SummaryBar：按币种展示"月度支出（订阅中）"小卡片 + "即将到期 N" / "已到期 N" 站内徽标，
  点击徽标可切换列表筛选
- SubscriptionCard：name、category badge、price+billingType、expireDate（即将到期/已到期用
  warning/destructive chip）、status chip、usageLimit 存在时显示用量进度条
- 卡片操作：编辑（打开 Dialog/Sheet）、删除（按钮旁上浮二次确认，参考 ToDo 详情删除的交互，
  不用嵌套 modal）、记录用量（usageLimit 存在时显示，打开 UsagePopover）
- SubscriptionFormFields：name*、category、price+currency、billingType（Radix Select）、
  startDate/expireDate/nextBillingDate（用新 DatePicker，allowClear=true）、
  usageLimit+usageUnit、url、notes、notifyEnabled 开关 + notifyDaysBefore（关闭时禁用）、
  status（仅编辑可见，Radix Select 4 选项）
- 桌面用 Dialog，移动用 bottom sheet，参考 ToDo 详情 dialog/sheet 的尺寸和操作区布局
- UsagePopover：展示当前用量+进度条，数字输入框（默认当前值）+ 保存按钮调用 updateUsage，
  额外提供 "+1" 快捷按钮
- 所有导出组件顶部加一行中文注释说明用途
```

## 设计要求

```text
- 遵守 .design/DESIGN.md：warm canvas + 白色 surface + 单一 Notion blue 主色，
  卡片 rounded-lg + hairline + Level-1 shadow，按钮 rounded-md，输入框 rounded-xs
- 状态/到期颜色用 hsl(var(--success|warning|destructive)) token，
  对齐 ToDo PRIORITY_STYLES 的写法，不要引入新硬编码颜色
- 不做营销页风格，保持工作台密度
```

## 测试和验证

必须运行：

```bash
cd frontend && pnpm build
cd backend && JAVA_HOME=/Users/manuelm/.local/share/mise/installs/java/21.0.2 \
  PATH=/Users/manuelm/.local/share/mise/installs/java/21.0.2/bin:/Users/manuelm/.local/share/mise/installs/maven/3.9.2/apache-maven-3.9.2/bin:/usr/bin:/bin:/usr/sbin:/sbin \
  mvn test
```

并启动一次本地后端，确认 Flyway V1.9 迁移成功应用后再停止临时进程。

## 禁止事项

```text
- 不要修改已应用的 V1_2/V1_5/V1_7/V1_8 等迁移脚本
- 不要暴露 api_provider/api_key_masked/api_fetch_enabled/api_last_fetched_at/api_balance_json
  到 SubscriptionResponse 或前端
- 不要实现微信/短信等具体通知渠道逻辑
- 不要自动滚动 next_billing_date 或自动重置 usageUsed
- 不要引入新的 UI 库
- 不要修改无关页面（除 TodoDatePicker 提取相关的最小改动）
- 不要绕过 AGENTS.md 注释规范
```

## 完成标准

```text
- /subscriptions 页面 CRUD 可用，状态包含 active/expired/cancelled/paused
- 过期 active 订阅会被每日任务自动置为 expired
- 页面内可见"即将到期/已到期"汇总，无需依赖通知渠道配置
- usageLimit 存在时可看到用量进度条并可手动更新用量
- 桌面端和移动端布局均可用，遵循 DesktopView/MobileView 拆分
- api_* 和 Notion 相关字段在响应和前端中不再出现，但数据库列按计划保留/删除规则处理
- frontend build 通过
- backend test 通过，含新增 SubscriptionServiceTest 和 V1_9 迁移列断言
```

## 实现过程中如遇到以下问题，暂停并询问用户（不要自行决定）

```text
- usageUsed 是否允许为负数 / 是否需要 "-1" 快捷按钮
- category 是否需要从自由文本升级为预设分类
- "已到期"提示是否需要出现在全局导航（Sidebar/Profile），而不仅是 /subscriptions 页面内
```
