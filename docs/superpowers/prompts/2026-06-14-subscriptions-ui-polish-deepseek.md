# DeepSeek 执行提示词 — Subscriptions 页面体验打磨

> 完整背景与代码细节见 `docs/superpowers/plans/2026-06-14-subscriptions-ui-polish.md`，本文件为可直接粘贴给 DeepSeek 的执行提示词。

---

你正在为 Nexus 项目（Spring Boot 3.3.5 + MyBatis-Plus + React 18 + TypeScript + Tailwind v3 + Radix UI）的 Subscriptions（订阅管理）模块实施一轮 UI/交互打磨。请严格按以下任务逐项实施，**完成后逐条自查**。

## 任务 1：弹层组件统一为响应式 Dialog

- 删除 `frontend/src/pages/Subscriptions/components/SubscriptionFormSheet.tsx`。
- 重写 `frontend/src/pages/Subscriptions/components/SubscriptionFormDialog.tsx`，参照 `frontend/src/pages/ToDo/todo.components.tsx`（474-671 行）的响应式弹层模式：
  - `Dialog.Content` className：`"nexus-surface fixed inset-x-0 bottom-0 top-auto z-50 max-h-[85dvh] w-full translate-x-0 translate-y-0 overflow-y-auto rounded-b-none rounded-t-2xl p-3 sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:w-[calc(100vw-2rem)] sm:max-w-2xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg sm:p-4"`
  - 移动端顶部加拖拽把手 `<div className="mx-auto mb-2 h-1 w-9 rounded-full bg-muted-foreground/25 sm:hidden" />`
  - `Dialog.Title` className：`"text-sm font-black sm:text-base sm:font-semibold"`
  - 右上角关闭按钮仅桌面端显示：`"nexus-button-utility hidden h-9 w-9 text-muted-foreground sm:inline-flex"`
  - 底部按钮区：`"mt-3 grid grid-cols-2 gap-2 border-t pt-3 sm:mt-5 sm:flex sm:flex-row sm:items-center sm:justify-end sm:pt-4"`，包含"取消"（`Dialog.Close`）和"保存"按钮
  - 内部逻辑（state、`formValuesToPayload`、`subscriptionToFormValues` 调用）与原 `SubscriptionFormDialog.tsx` 保持一致
- 在 `frontend/src/pages/Subscriptions/index.tsx` 的根 `return` 中，于 `<SubscriptionsDesktopView />` 和 `<SubscriptionsMobileView />` 之后，新增一次性渲染 `<SubscriptionFormDialog ... />`（props 同原来传给 Dialog/Sheet 的内容）。
- `SubscriptionsDesktopView.tsx` 和 `SubscriptionsMobileView.tsx` 中移除各自对 `SubscriptionFormDialog` / `SubscriptionFormSheet` 的导入与渲染，以及只用于弹层的 props（`formOpen`, `editingItem`, `saving`, `categories`, `aiSuggesting`, `onFormOpenChange`, `onSubmit`, `onAiSuggestCategory`）。

## 任务 2-4：分类字段改为下拉框 + AI 自动分类联动

- 重写 `frontend/src/pages/Subscriptions/components/CategoryInput.tsx`：
  - 用 `@radix-ui/react-select`（参考 `SubscriptionFormFields.tsx` 中已有的 `SelectField` 组件实现）替换文本输入框，下拉选项 = `categories` prop。
  - 若当前 `value` 不在 `categories` 中，临时把它插入选项最前面（避免下拉框显示空白）。
  - 选项为空时显示提示文案"暂无分类，点击右侧按钮 AI 自动生成"。
  - 右侧 AI 按钮（Sparkles 图标）`title` 和 `aria-label` 均改为 **"自动分类"**（原为"AI 识别"/"AI 识别分类"）。
  - 移除原来下方的分类 chip 快捷选择区域。
- 在 `frontend/src/pages/Subscriptions/components/SubscriptionFormFields.tsx` 中，修复 AI 识别结果未写回分类字段的问题：`CategoryInput` 的 `onAiSuggest` 回调改为：
  ```tsx
  onAiSuggest={() => {
    if (!onAiSuggestCategory) return
    void onAiSuggestCategory(values.name, values.notes || undefined).then((result) => {
      if (result) setField('category', result)
    })
  }}
  ```

## 任务 5：月度/年度开始日期联动到期日期

在 `SubscriptionFormFields.tsx` 顶部新增：
```ts
function addBillingPeriod(dateStr: string, unit: 'month' | 'year'): string {
  const d = new Date(`${dateStr}T00:00:00`)
  if (unit === 'month') d.setMonth(d.getMonth() + 1)
  else d.setFullYear(d.getFullYear() + 1)
  return d.toISOString().slice(0, 10)
}
```
"开始日期"的 `DatePicker.onChange` 改为：当 `billingType ∈ {monthly, yearly}` 且修改后 `startDate` 非空且**当前 `expireDate` 为空**时，自动把 `expireDate` 设为 `addBillingPeriod(startDate, monthly?'month':'year')`；若 `nextBillingDate` 也为空，同样填充为该日期。已有 `expireDate` 时不覆盖。

## 任务 6-7：字段重命名

- `SubscriptionFormFields.tsx`：`nextBillingDate` 的 `FieldLabel` 文案"下次扣费" → **"下次扣费日期"**；`url` 的 `FieldLabel` 文案"网址" → **"订阅地址"**。
- `frontend/src/pages/Subscriptions/subscriptions.shared.ts` 的 `dueDateLabel()` 函数中 `{ label: '下次扣费', ... }` → `{ label: '下次扣费日期', ... }`。

## 任务 8：重排"到期提醒 + 提前天数"区块

将 `SubscriptionFormFields.tsx` 中原来左右两栏（开关卡片 + 独立的"提前天数"输入卡片）合并为一张卡片：上方是标题 + 说明文案 + Switch 开关；开启时在卡片内底部以 `border-t` 分隔，水平排列"提前 [数字输入] 天提醒"。说明文案改为更友好的描述（"到期前提前提醒我续费" / "结束前提前提醒我"），不要暴露内部事件名 `SUBSCRIPTION_EXPIRING`。

## 任务 9：状态改为自动计算，表单移除手动状态选择

**计算规则**（仅 `monthly`/`yearly`/`one_time`，且 `autoRenew=true` 的 monthly/yearly 已由现有 rollover 逻辑保证 active，跳过）：
- `expireDate` 为空 或 `今天 <= expireDate` → `active`（订阅中）
- `今天 > expireDate` 且超期 ≤ 7 天 → `expired`（已过期）
- `今天 > expireDate` 且超期 > 7 天 → `paused`（已暂停）
- `lifetime`/`per_token` 状态固定为 `active`

完全移除 `cancelled` 状态。

**前端改动**：
- `frontend/src/types/domain.types.ts`：`Subscription.status` 类型从 `'active' | 'expired' | 'cancelled' | 'paused'` 改为 `'active' | 'expired' | 'paused'`。
- `subscriptions.shared.ts`：删除 `SUBSCRIPTION_STATUSES`、`SUBSCRIPTION_STATUSES_NO_EXPIRED`；`STATUS_LABELS` 改为 `{ active: '订阅中', expired: '已过期', paused: '已暂停' }`（去掉 `cancelled`，`expired` 文案由"已到期"改为"已过期"）；`STATUS_STYLES` 同步去掉 `cancelled`。
- `SubscriptionFormFields.tsx`：`SubscriptionFormValues` 移除 `status` 字段；`emptySubscriptionForm`、`subscriptionToFormValues()`、`formValuesToPayload()` 中移除所有 `status` 相关代码；删除状态 `Select` 渲染块及未使用的相关导入。
- `SubscriptionCard.tsx` 不变（继续展示 `STATUS_LABELS[item.status]`）。

**后端改动**：
- `backend/src/main/java/com/nexus/dto/request/SubscriptionUpdateRequest.java`：删除 `status` 字段。
- `backend/src/main/java/com/nexus/service/SubscriptionService.java`：
  - 删除 `ALLOWED_STATUSES` 常量、`validateStatus()` 方法，以及 `update()` 中处理 `status` 的代码块。
  - 把 `autoExpireOverdue()` 重写为 `recomputeDateBasedStatuses()`，按上述规则对 `archived=false` 且 `billingType ∈ {monthly,yearly,one_time}` 的记录重算 `status`（autoRenew 的 monthly/yearly 跳过），状态变化才 `updateById`，返回变更数量。
- `backend/src/main/java/com/nexus/scheduler/SubscriptionNotifyScheduler.java`：`markExpiredSubscriptions()` 中 `subscriptionService.autoExpireOverdue()` 改为 `subscriptionService.recomputeDateBasedStatuses()`，日志文案同步调整。

## 任务 10：归档 Tab + 取消归档

- `subscriptions.shared.ts`：`SubscriptionFilter` 改为 `'all' | 'expiring' | 'expired'`（移除 `'archived'`），新增 `export type SubscriptionView = 'active' | 'archived'`。
- `index.tsx`：
  - 新增 `const [view, setView] = useState<SubscriptionView>('active')`。
  - `filteredItems`：`view === 'archived'` 时返回 `archivedItems`；否则按原 `filter` 逻辑（`expiringSoonItems` / `expiredItems` / 非归档全部）。
  - `expiredItems` 计算补充 `&& !i.archived` 过滤。
  - 新增 `onUnarchive: (id) => updateMutation.mutate({ id, payload: { archived: false } })`。
  - `sharedProps` 新增 `view`、`onViewChange: setView`、`onUnarchive`。
- 新建 `frontend/src/pages/Subscriptions/components/SubscriptionViewTabs.tsx`：两个 Tab 按钮"订阅" / "已归档 (N)"，激活态 `bg-card shadow-sm text-foreground`，非激活态 `text-muted-foreground`。
- `SummaryBar.tsx`：移除"已归档"筛选 chip 及相关 props（`archivedCount`、`Archive` 图标导入）。
- `SubscriptionsDesktopView.tsx` / `SubscriptionsMobileView.tsx`：标题行下方渲染 `<SubscriptionViewTabs />`；`view === 'archived'` 时不渲染 `SubscriptionsStatsBar` 和 `SummaryBar`，列表项传入 `onUnarchive={props.onUnarchive}`，空状态文案"暂无已归档订阅"。
- `SubscriptionCard.tsx`：新增可选 prop `onUnarchive?: (id: string) => void`，传入时在操作按钮区渲染"取消归档"按钮（`ArchiveRestore` from `lucide-react`，`aria-label="取消归档"`）。

## 任务 11：Settings 订阅模块新增"专用模型"配置

- 新建 `backend/src/main/resources/db/migration/V1_11__subscriptions_status_and_model.sql`：
  ```sql
  UPDATE subscriptions SET status = 'active' WHERE status = 'cancelled';

  INSERT INTO workflow_llm_configs (id, workflow_type)
  VALUES (gen_random_uuid()::text, 'subscriptions')
  ON CONFLICT (workflow_type) DO NOTHING;
  ```
- `backend/src/main/java/com/nexus/service/SubscriptionCategoryAiService.java`：第 37 行 `llmConfigService.resolveModel("inbox")` 改为 `llmConfigService.resolveModel("subscriptions")`。
- 新建 `frontend/src/pages/Settings/components/SubscriptionModelPanel.tsx`：完全参照 `frontend/src/pages/Settings/components/TranslateSettingsPanel.tsx` 的结构（同样的 `WorkflowModelSelect` + 保存/取消按钮 + dirty 提示），标题"订阅设置"，说明文案"用于新增/编辑订阅时的 AI 自动分类识别"，区块标题"专用模型"。
- `frontend/src/pages/Settings/index.tsx`：参照 `translateSettings` 的实现模式（`translateWorkflow`/`translateProviderId`/`translateProviderDraft`/`translateDirty`/`translateSettings`），新增一套 `subscriptionsWorkflow`/`subscriptionsProviderId`/`subscriptionsProviderDraft`/`subscriptionsDirty`/`subscriptionsSettings`，`workflowType` 用 `'subscriptions'`，复用现有 `workflowMutation`。
- `SettingsDesktopView.tsx` / `SettingsMobileView.tsx`：`SettingsViewProps` 新增 `subscriptionsSettings` 字段（类型同 `translateSettings`）；在 `activeSettingsTab === 'subscriptions'` 分支中，`SubscriptionCategoriesPanel` 之前渲染 `<SubscriptionModelPanel ... />`。

## 完成后自查清单

1. `pnpm -C frontend build`（或 `tsc --noEmit`）无类型错误。
2. `mvn -f backend/pom.xml compile` 无编译错误。
3. 新增/编辑订阅弹层在窄屏（<640px）和宽屏（≥640px）下分别为底部 sheet 和居中 Dialog。
4. 分类字段为下拉框，AI 按钮 hover 显示"自动分类"，点击后分类自动选中。
5. monthly/yearly 填写开始日期后到期日期自动 +1 月/年（仅在到期日期为空时）。
6. "下次扣费日期"和"订阅地址"文案已生效。
7. "到期提醒"为单卡片，关闭时不显示天数输入。
8. 编辑表单中没有"状态"字段；卡片状态随到期日期变化（active/expired/paused 三态，无 cancelled）。
9. "已归档"Tab 可查看归档项并"取消归档"。
10. Settings → 订阅 Tab 出现"专用模型"配置区，可选择并保存。
