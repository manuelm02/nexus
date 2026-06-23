# Subscriptions 用量面板 & 流水重构 — 执行提示词

> 配套计划：`docs/superpowers/plans/2026-06-15-subscriptions-dashboard.md`
> 视觉规范：`docs/superpowers/plans/2026-06-15-subscriptions-dashboard-DESIGN.md`

请按照 `docs/superpowers/plans/2026-06-15-subscriptions-dashboard.md` 完整实施 Subscriptions 页面的"按量流水 + 4 Tab"重构。下面是任务清单的浓缩版，**每个任务的具体代码以计划文档对应章节为准**，本文件只是执行顺序和自检索引。

## 任务清单

1. **数据库迁移（计划 §1）**：新建 `backend/src/main/resources/db/migration/V1_12__subscription_ledger_entries.sql`，创建 `subscription_ledger_entries` 表，迁移 `recharge_records` JSONB 历史数据，最后 `DROP COLUMN recharge_records`。

2. **后端流水实体/Mapper/DTO（计划 §2）**：
   - 新建 `entity/SubscriptionLedgerEntry.java`
   - 新建 `mapper/SubscriptionLedgerEntryMapper.java`（含 `selectRecent`）
   - 新建 `dto/response/LedgerEntryResponse.java`

3. **移除 `rechargeRecords`（计划 §3）**：
   - `entity/Subscription.java` 删除字段 + import
   - `dto/response/SubscriptionResponse.java` 删除字段 + 映射
   - 删除 `dto/RechargeRecordItem.java`

4. **`SubscriptionService` 改造（计划 §4）**：
   - 注入 `SubscriptionLedgerEntryMapper ledgerMapper`
   - 重写 `recharge()`：余额累加 + 写 `recharge` 流水
   - 重写 `consume()`：余额扣减（可负）+ 月消费累加 + 写 `consume` 流水
   - 新增 `getLedger(id, limit)`

5. **`SubscriptionController` 新增端点（计划 §5）**：`GET /{id}/ledger?limit=20`

6. **后端测试更新（计划 §6）**：
   - 新增 `@Mock SubscriptionLedgerEntryMapper ledgerMapper`
   - `recharge_balanceAndRecords` → `recharge_balanceAndLedgerEntry`（用 `ArgumentCaptor<SubscriptionLedgerEntry>` 断言）
   - `consume_balanceAndSpend` 追加流水断言
   - 新增 `getLedger_returnsMappedEntries`
   - 检查并删除 `buildSubscription` 或测试体中残留的 `setRechargeRecords(...)` 调用

7. **前端类型与 API（计划 §7）**：
   - `types/domain.types.ts`：删除 `RechargeRecord`/`rechargeRecords`，新增 `LedgerEntry`
   - `api/subscription.api.ts`：新增 `ledger(id, limit=10)`

8. **`subscriptions.shared.ts` 扩展（计划 §8）**：
   - `SubscriptionView` 改为 `'dashboard' | 'subscriptions' | 'usage' | 'archived'`
   - `FieldKey`/`FIELD_VISIBILITY` 移除 `rechargeRecords`
   - 新增 `balanceHealth`、`balanceRatio`、`cycleHealth`、`cycleProgress`（含 `daysBetween`/`addPeriod` 辅助函数）

9. **`RadialProgress` 组件（计划 §9）**：新建 `components/ui/RadialProgress.tsx`，纯 SVG 环形进度，`r=24`、`viewBox="0 0 56 56"`、`-rotate-90`。

10. **`CycleProgressBar` 组件（计划 §10）**：新建 `pages/Subscriptions/components/CycleProgressBar.tsx`，按 `cycleHealth` 着色，`monthly/yearly/one_time` 展示进度+到期文案，`lifetime` 不渲染。

11. **提取 `DeleteConfirm`（计划 §11）**：新建 `pages/Subscriptions/components/DeleteConfirm.tsx`（从 `SubscriptionCard.tsx` 迁移），`SubscriptionCard.tsx` 改为引用该组件。

12. **`UsagePopover` 改造（计划 §12）**：`Popover.Root` 受控（`open`/`onOpenChange`），用 `useQuery({ queryKey: ['subscription-ledger', item.id], queryFn: () => subscriptionApi.ledger(item.id, 10), enabled: open })` 替代 `item.rechargeRecords`，记录渲染区分 `recharge`(+，绿色)/`consume`(-，红色)。

13. **`SubscriptionCard` 简化（计划 §13）**：移除 per_token 分支（`PerTokenInfo`、`UsagePopover`、`onRecharge`/`onConsume` props），接入 `CycleProgressBar`，`DeleteConfirm` 改为 import。

14. **`UsageAccountCard` 新建（计划 §14）**：新建 `pages/Subscriptions/components/UsageAccountCard.tsx`，环形图（`size=48, strokeWidth=5`）+ 余额/月消费/阈值信息 + 编辑/取消归档/删除 + `UsagePopover`，按 `balanceHealth` 着色（含左边框强调色）。

15. **Dashboard 组件（计划 §15）**：
    - 新建 `components/UsageAccountsSummary.tsx`（按币种汇总余额/月消费/低余额账户数）
    - 新建 `components/SubscriptionsDashboard.tsx`（组合 `SubscriptionsStatsBar` + `UsageAccountsSummary` + `SummaryBar`）

16. **`SubscriptionViewTabs` 重写（计划 §16）**：4 Tab（概览/订阅/用量面板/已归档），"用量面板"Tab 有低余额提示小红点。

17. **表单 `initialBillingType`（计划 §17）**：
    - `subscriptionToFormValues(item?, initialBillingType?)` 支持第二参数
    - `SubscriptionFormDialog` 新增 `initialBillingType` prop 并在 `useState`/`useEffect` 中传入

18. **`index.tsx` 状态与路由（计划 §18）**：
    - `view` 初始值改为 `'dashboard'`
    - 按 `archived`/`billingType==='per_token'` 派生 `subscriptionItems`/`usageItems`/`archivedItems`/`usageLowBalanceCount`
    - `handleFilterChange` 切换筛选时联动 `setView('subscriptions')`
    - `rechargeMutation`/`consumeMutation` 的 `onSuccess` 增加 `invalidateQueries(['subscription-ledger', variables.id])`
    - 新增 `createBillingType`（`usage` Tab → `per_token`，其他 → `monthly`），传给 `SubscriptionFormDialog`

19. **Desktop/Mobile View 重写（计划 §19）**：4 Tab 内容渲染逻辑：
    - `dashboard` → `SubscriptionsDashboard`
    - `subscriptions` → `SubscriptionCard` 列表（仅非 per_token）
    - `usage` → `UsageAccountCard` 列表（仅 per_token）
    - `archived` → 按 `billingType` 分别用 `SubscriptionCard`/`UsageAccountCard`，均带 `onUnarchive`
    - 添加按钮文案/默认类型按 Tab 切换，`dashboard`/`archived` 不显示

## 自检清单（完成后逐项确认）

- [ ] `mvn -f backend/pom.xml compile` 通过
- [ ] `mvn -f backend/pom.xml test -Dtest=SubscriptionServiceTest` 全部通过
- [ ] `pnpm -C frontend build`（或 `tsc --noEmit`）无类型错误
- [ ] 全局搜索 `rechargeRecords` / `RechargeRecordItem` / `RechargeRecord` 无残留引用
- [ ] V1_12 迁移脚本可正常 `flyway migrate`（或应用启动时自动迁移成功）
- [ ] "概览"Tab：统计卡 + 按量账户余额汇总 + 到期筛选 chip，点击 chip 跳转"订阅"Tab 并应用筛选
- [ ] "订阅"Tab：仅非 per_token；monthly/yearly/one_time 显示周期进度条（临近到期变黄/超期变红）；lifetime 无进度条
- [ ] "用量面板"Tab：仅 per_token；环形图中心显示余额数值；低余额变黄、余额≤0变红，左边框同步变色
- [ ] 充值/消费操作后，`UsagePopover` 流水列表实时刷新，`consume` 显示红色 `-`
- [ ] "已归档"Tab：两种类型均可显示且不强调告警色，均可"取消归档"
- [ ] "添加"按钮：订阅Tab→"添加订阅"(monthly)，用量面板Tab→"添加用量账户"(per_token)，概览/已归档不显示
- [ ] 移动端：4 Tab 可横向滚动不溢出，列表单栏，环形图/进度条不溢出卡片
