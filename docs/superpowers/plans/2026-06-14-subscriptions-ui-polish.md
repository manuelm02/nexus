# Subscriptions 页面体验打磨 — 执行计划

> 创建日期：2026-06-14
> 前置依赖：`docs/superpowers/plans/2026-06-14-subscriptions-ui-redesign.md`（已实施，本计划基于其产物继续迭代）
> 目标：修正编辑/新增表单的布局与交互问题，重做分类字段为下拉选择并接入 AI 自动分类，新增日期联动、状态自动计算、归档 Tab，并补齐 Settings 中订阅模块的专用模型配置。

---

## 0. 背景与现状

上一轮重构已落地：自动续费、归档字段、按量余额/消费/充值记录、`subscription_categories` 表、`SubscriptionCategoryAiService`、4 项统计。本轮在此基础上修复 11 个体验问题。当前代码现状（已核实）：

- `V1_10__subscriptions_redesign.sql` 已存在并已应用 → 本计划新增迁移为 **`V1_11`**。
- `SubscriptionFormDialog.tsx`（桌面 Dialog）与 `SubscriptionFormSheet.tsx`（移动 Sheet）是两份几乎重复的弹层代码，样式与 ToDo 模块的响应式弹层（`frontend/src/pages/ToDo/todo.components.tsx:474-671`）不一致。
- `CategoryInput.tsx` 是文本输入框 + AI 按钮 + 分类 chip 快捷选择，AI 识别结果**没有写回**分类字段（`SubscriptionFormFields.tsx:218` 的 `onAiSuggestCategory` 调用丢弃了返回值）。
- `SubscriptionFormFields.tsx` 中仍有 `status` 字段的手动 Select（329-333 行），且 `formValuesToPayload` 在编辑时会提交 `status`。
- `subscriptions.shared.ts` 中 `SUBSCRIPTION_STATUSES` 含 `cancelled`，`STATUS_LABELS.expired = '已到期'`。
- `SubscriptionService.java` 的 `ALLOWED_STATUSES = {active, expired, cancelled, paused}`，`update()` 允许前端任意设置 `status`；`autoExpireOverdue()` 只做"过期→expired"的二值判断，没有"暂停"概念。
- `SummaryBar.tsx` 把"已归档"做成了第 4 个筛选 chip（`filter==='archived'`），而不是独立 Tab。
- `SubscriptionCategoryAiService.java:37` 调用 `llmConfigService.resolveModel("inbox")` —— 这是历史遗留的占位符，应改为 `"subscriptions"`。
- Settings 订阅 Tab（`SettingsDesktopView.tsx:261-271` / `SettingsMobileView.tsx:232-242`）只有 `SubscriptionCategoriesPanel`，没有 Translate/Inbox 同款的"专用模型"区块。

---

## 1. Dialog/Sheet 统一为响应式弹层（对应需求 1）

**问题**：编辑弹窗的尺寸、圆角、按钮排布与全局风格（ToDo 弹层）不一致；桌面 Dialog 和移动 Sheet 是两份重复代码。

**方案**：参照 ToDo 弹层模式（`todo.components.tsx:474-671`），把 `SubscriptionFormDialog.tsx` 改造成**单一响应式组件**（移动端底部 sheet + `sm:` 断点切换为桌面居中 Dialog），删除 `SubscriptionFormSheet.tsx`，该组件在 `SubscriptionsPage`（`index.tsx`）层级渲染一次，不再分别由 Desktop/Mobile View 各自渲染。

### 1.1 重写 `frontend/src/pages/Subscriptions/components/SubscriptionFormDialog.tsx`

```tsx
import { useEffect, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { Subscription } from '../../../types/domain.types'
import { SubscriptionFormFields, formValuesToPayload, subscriptionToFormValues, type SubscriptionFormValues, type SubscriptionPayload } from './SubscriptionFormFields'

type SubscriptionFormDialogProps = {
  open: boolean
  item: Subscription | null
  saving: boolean
  categories: string[]
  onAiSuggestCategory: (name: string, notes?: string) => Promise<string | undefined>
  isAiSuggesting: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (payload: SubscriptionPayload, id?: string) => void
}

// SubscriptionFormDialog 承载订阅创建/编辑表单：移动端为底部 sheet，sm 断点以上为居中 Dialog（与 ToDo 弹层一致）。
export function SubscriptionFormDialog({ open, item, saving, categories, onAiSuggestCategory, isAiSuggesting, onOpenChange, onSubmit }: SubscriptionFormDialogProps) {
  const [values, setValues] = useState<SubscriptionFormValues>(() => subscriptionToFormValues(item))

  useEffect(() => {
    if (open) setValues(subscriptionToFormValues(item))
  }, [item, open])

  const handleSubmit = () => {
    if (!values.name.trim()) return
    onSubmit(formValuesToPayload(values, item), item?.id)
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" />
        <Dialog.Content className="nexus-surface fixed inset-x-0 bottom-0 top-auto z-50 max-h-[85dvh] w-full translate-x-0 translate-y-0 overflow-y-auto rounded-b-none rounded-t-2xl p-3 sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:w-[calc(100vw-2rem)] sm:max-w-2xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg sm:p-4">
          <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-muted-foreground/25 sm:hidden" />
          <div className="flex items-center justify-between gap-3">
            <Dialog.Title className="text-sm font-black sm:text-base sm:font-semibold">{item ? '编辑订阅' : '添加订阅'}</Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" className="nexus-button-utility hidden h-9 w-9 text-muted-foreground sm:inline-flex" aria-label="关闭">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="mt-3 sm:mt-4">
            <SubscriptionFormFields
              values={values}
              editing={!!item}
              categories={categories}
              onAiSuggestCategory={onAiSuggestCategory}
              isAiSuggesting={isAiSuggesting}
              onChange={setValues}
            />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 border-t pt-3 sm:mt-5 sm:flex sm:flex-row sm:items-center sm:justify-end sm:pt-4">
            <Dialog.Close asChild>
              <button type="button" className="nexus-button-utility h-10 px-3 text-sm">取消</button>
            </Dialog.Close>
            <button type="button" disabled={saving || !values.name.trim()} onClick={handleSubmit} className="nexus-button-primary h-10 px-4 text-sm">
              保存
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
```

### 1.2 删除文件
- `frontend/src/pages/Subscriptions/components/SubscriptionFormSheet.tsx`

### 1.3 调整渲染位置
- `SubscriptionsDesktopView.tsx`：移除 `SubscriptionFormDialog` 的导入与渲染（67-76 行），同时从 props 类型中移除仅用于弹层的字段：`formOpen`、`editingItem`、`saving`、`categories`、`aiSuggesting`、`onFormOpenChange`、`onSubmit`、`onAiSuggestCategory`。
- `SubscriptionsMobileView.tsx`：同样移除 `SubscriptionFormSheet` 的导入与渲染（67-76 行）及上述同名 props。
- `frontend/src/pages/Subscriptions/index.tsx`：在 `return` 中新增一次性渲染：

```tsx
return (
  <>
    <SubscriptionsDesktopView {...sharedProps} />
    <SubscriptionsMobileView {...sharedProps} />
    <SubscriptionFormDialog
      open={formOpen}
      item={editingItem}
      saving={createMutation.isPending || updateMutation.isPending}
      categories={categoryNames}
      onAiSuggestCategory={handleAiSuggestCategory}
      isAiSuggesting={suggestCategoryMutation.isPending}
      onOpenChange={(open) => { if (!open) closeForm(); else setFormOpen(true) }}
      onSubmit={handleSubmit}
    />
  </>
)
```
（`sharedProps` 中可以保留这些字段不动，Desktop/Mobile View 的 props 类型收窄即可；多传字段不会报错，但建议同步清理以保持类型准确。）

---

## 2 & 3 & 4. 分类字段改为下拉框 + AI 自动分类联动（对应需求 2/3/4）

**现状**：`CategoryInput.tsx` 是文本输入 + AI 按钮（`title="AI 识别"`）+ chip 快捷选择；AI 识别结果未写回字段。

**方案**：保留文件名 `CategoryInput.tsx`（避免无意义改名），但将内部实现改为「Radix Select 下拉框 + 右侧 AI 按钮」：
- 下拉框选项 = `categories` prop（即 Settings 中配置的全部分类名）；若当前 `value` 不在 `categories` 列表中（例如刚通过 AI 生成、尚未 refetch），临时插入到选项最前面，避免 Select 显示为空。
- AI 按钮 hover/title 文案改为 **"自动分类"**。
- 点击 AI 按钮后，等待 `onAiSuggest()` 返回的分类名，并直接写回（`onChange`）—— 修复需求 4 提到的"点击后没有自动填充"问题。

### 2.1 重写 `frontend/src/pages/Subscriptions/components/CategoryInput.tsx`

```tsx
import * as Select from '@radix-ui/react-select'
import { Check, ChevronDown, Sparkles } from 'lucide-react'
import { cn } from '../../../lib/utils'

type CategoryInputProps = {
  value: string
  onChange: (value: string) => void
  subscriptionName: string
  notes?: string
  categories: string[]
  onAiSuggest: () => void
  isAiLoading: boolean
}

// CategoryInput 以下拉框展示 Settings 中配置的订阅分类，并提供 AI 自动分类按钮。
export function CategoryInput({ value, onChange, subscriptionName, categories, onAiSuggest, isAiLoading }: CategoryInputProps) {
  // value 可能是 AI 刚生成、还未写入 categories 列表的新分类，临时补到选项最前面避免下拉框显示空白
  const options = value && !categories.includes(value) ? [value, ...categories] : categories

  return (
    <div className="flex items-center gap-2">
      <Select.Root value={value || undefined} onValueChange={onChange}>
        <Select.Trigger className="nexus-input inline-flex h-10 w-full flex-1 items-center justify-between gap-2 px-3 text-sm font-semibold shadow-none focus:outline-none focus:ring-2 focus:ring-ring data-[placeholder]:text-muted-foreground data-[placeholder]:font-normal">
          <Select.Value placeholder="选择分类" />
          <Select.Icon>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content position="popper" sideOffset={6} className="z-[90] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg">
            <Select.Viewport>
              {options.length === 0 ? (
                <div className="px-3 py-2 text-xs text-muted-foreground">暂无分类，点击右侧按钮 AI 自动生成</div>
              ) : (
                options.map((option) => (
                  <Select.Item key={option} value={option} className="relative flex h-9 cursor-default select-none items-center rounded-md px-8 text-sm font-semibold outline-none data-[highlighted]:bg-accent">
                    <Select.ItemIndicator className="absolute left-2 flex h-4 w-4 items-center justify-center text-primary">
                      <Check className="h-3.5 w-3.5" />
                    </Select.ItemIndicator>
                    <Select.ItemText>{option}</Select.ItemText>
                  </Select.Item>
                ))
              )}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
      <button
        type="button"
        disabled={!subscriptionName.trim() || isAiLoading}
        onClick={onAiSuggest}
        className={cn(
          'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border transition-colors',
          'text-muted-foreground hover:text-primary hover:bg-accent disabled:opacity-40',
          isAiLoading && 'animate-pulse',
        )}
        aria-label="自动分类"
        title="自动分类"
      >
        <Sparkles className="h-4 w-4" />
      </button>
    </div>
  )
}
```

### 2.2 修复 AI 识别结果写回（`SubscriptionFormFields.tsx:210-221`）

将：
```tsx
onAiSuggest={onAiSuggestCategory ? () => { onAiSuggestCategory(values.name, values.notes || undefined) } : () => {}}
```
改为：
```tsx
onAiSuggest={() => {
  if (!onAiSuggestCategory) return
  void onAiSuggestCategory(values.name, values.notes || undefined).then((result) => {
    if (result) setField('category', result)
  })
}}
```

> 说明：`onAiSuggestCategory`（定义于 `index.tsx:127-134`）已经会在 `isNew` 时 invalidate `subscription-categories` 查询，新分类会随之出现在下拉框选项中；写回 `category` 字段的同时，`CategoryInput` 的"临时补选项"逻辑保证下拉框立即显示正确的分类名，不需要等待 refetch。

---

## 5. 月度/年度：开始日期联动到期日期（对应需求 5）

**规则**：仅当 `billingType ∈ {monthly, yearly}` 且当前 **到期日期为空** 时，修改开始日期会自动把到期日期填充为 `开始日期 + 1 周期`（monthly → +1 month，yearly → +1 year）；若已有到期日期（无论是自动填充还是用户手动填写），后续修改开始日期不会覆盖它（避免覆盖用户的有意修改）。同时，若 `nextBillingDate` 为空，联动填充为同一日期。

### 5.1 在 `SubscriptionFormFields.tsx` 顶部新增日期工具函数

```ts
// 按月/年加一个周期；JS Date 对日末溢出的处理（如 1/31 +1 月 → 3/3）在此场景可接受
function addBillingPeriod(dateStr: string, unit: 'month' | 'year'): string {
  const d = new Date(`${dateStr}T00:00:00`)
  if (unit === 'month') d.setMonth(d.getMonth() + 1)
  else d.setFullYear(d.getFullYear() + 1)
  return d.toISOString().slice(0, 10)
}
```

### 5.2 修改 `startDate` 的 `DatePicker.onChange`（原 273-275 行附近）

```tsx
{visible('startDate') && (
  <FieldLabel label={bt === 'lifetime' ? '购买日期' : '开始日期'}>
    <DatePicker
      value={values.startDate}
      onChange={(v) => {
        const next = { ...values, startDate: v }
        if ((bt === 'monthly' || bt === 'yearly') && v && !values.expireDate) {
          const computed = addBillingPeriod(v, bt === 'monthly' ? 'month' : 'year')
          next.expireDate = computed
          if (!values.nextBillingDate) next.nextBillingDate = computed
        }
        onChange(next)
      }}
      allowClear
      placeholder="未设置"
    />
  </FieldLabel>
)}
```

---

## 6 & 7. 字段标签重命名（对应需求 6/7）

| 位置 | 旧文案 | 新文案 |
|---|---|---|
| `SubscriptionFormFields.tsx` 第 283 行 `FieldLabel label="下次扣费"` | 下次扣费 | **下次扣费日期** |
| `SubscriptionFormFields.tsx` 第 303 行 `FieldLabel label="网址"` | 网址 | **订阅地址** |
| `subscriptions.shared.ts` 第 93 行 `dueDateLabel()` 中 `{ label: '下次扣费', ... }` | 下次扣费 | **下次扣费日期** |

> 卡片上的"下次扣费日期：2026-07-01"展示同步生效（`dueDateLabel` 已被 `SubscriptionCard.tsx` 使用）。

---

## 8. 重新设计"到期提醒 + 提前天数"区块（对应需求 8）

**问题**：当前是 `grid sm:grid-cols-[1fr_10rem]` 两栏布局，左侧开关卡片 + 右侧独立的"提前天数"输入卡片，视觉上像两个不相关的卡片拼在一起；说明文案"用于每日 SUBSCRIPTION_EXPIRING 通知"暴露了内部事件名。

**方案**：合并为单张卡片——上半部分是标题+说明+开关，开启后在卡片内底部以分隔线 + 内联输入展示"提前 N 天提醒"。

### 替换 `SubscriptionFormFields.tsx` 第 312-327 行

```tsx
{visible('notifyEnabled') && (
  <div className="rounded-lg border bg-card p-3 shadow-[var(--shadow-xs)]">
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-semibold">{bt === 'one_time' ? '结束提醒' : '到期提醒'}</p>
        <p className="text-xs text-muted-foreground">{bt === 'one_time' ? '结束前提前提醒我' : '到期前提前提醒我续费'}</p>
      </div>
      <Switch.Root checked={values.notifyEnabled} onCheckedChange={(c) => setField('notifyEnabled', c)} className={cn('relative h-6 w-11 rounded-full transition-colors', values.notifyEnabled ? 'bg-primary' : 'bg-muted')}>
        <Switch.Thumb className="block h-5 w-5 translate-x-0.5 rounded-full bg-card shadow transition-transform data-[state=checked]:translate-x-5" />
      </Switch.Root>
    </div>
    {values.notifyEnabled && (
      <div className="mt-3 flex items-center gap-2 border-t pt-3">
        <span className="text-xs font-medium text-muted-foreground">提前</span>
        <input
          type="number"
          min="0"
          value={values.notifyDaysBefore}
          onChange={(e) => setField('notifyDaysBefore', e.target.value)}
          className="nexus-input h-9 w-20 px-2 text-center text-sm"
        />
        <span className="text-xs font-medium text-muted-foreground">天提醒</span>
      </div>
    )}
  </div>
)}
```

---

## 9. 状态自动计算，表单移除手动状态选择（对应需求 9）

### 9.1 计算规则

仅对有 `expireDate` 的类型（`monthly` / `yearly` / `one_time`）按日期计算状态；`lifetime` / `per_token` 没有到期概念，状态固定为 `active`（归档与否由 `archived` 字段独立表达，不再叠加 `cancelled`）。

设 `today` 为当天、`expire = expireDate`：

- `expire == null` 或 `today <= expire` → **`active`（订阅中）**
- `today > expire` 且 `(today - expire) <= 7 天` → **`expired`（已过期）**
- `today > expire` 且 `(today - expire) > 7 天` → **`paused`（已暂停）**

`autoRenew=true` 的 `monthly`/`yearly` 在 `rollAutoRenewals()` 中已被前移日期保持 `active`，不参与上述计算。

完全移除 `cancelled` 状态（与 `archived` 字段语义重叠）。状态**只读展示在卡片上**，不出现在新增/编辑表单中，也不可通过 API 设置。

### 9.2 前端改动

#### `frontend/src/pages/Subscriptions/subscriptions.shared.ts`
- 删除 `SUBSCRIPTION_STATUSES`、`SUBSCRIPTION_STATUSES_NO_EXPIRED`（仅表单 Select 使用，表单移除后不再需要）。
- `STATUS_LABELS` 改为：
  ```ts
  export const STATUS_LABELS: Record<SubscriptionStatus, string> = {
    active: '订阅中',
    expired: '已过期',
    paused: '已暂停',
  }
  ```
  （`cancelled` 整体移除；`expired` 文案由"已到期"改为"已过期"，与需求 9 的措辞一致）
- `STATUS_STYLES` 同步移除 `cancelled` 一行。
- `SubscriptionStatus` 类型仍来自 `Subscription['status']`（见 9.3 后端 DTO 调整后变为 `'active' | 'expired' | 'paused'`）。

#### `frontend/src/types/domain.types.ts`
- `Subscription.status` 类型由 `'active' | 'expired' | 'cancelled' | 'paused'` 改为 `'active' | 'expired' | 'paused'`。

#### `frontend/src/pages/Subscriptions/components/SubscriptionFormFields.tsx`
- `SubscriptionFormValues` 移除 `status: SubscriptionStatus` 字段。
- `emptySubscriptionForm` 移除 `status: 'active'`。
- `subscriptionToFormValues()` 移除 `status: item.status`。
- `formValuesToPayload()` 移除 `payload.status = values.status`（130-131 行附近）。
- 删除第 329-333 行的状态 `Select` 块及 `statusOptions` 变量。
- 移除不再使用的导入：`STATUS_LABELS`、`SUBSCRIPTION_STATUSES`、`SUBSCRIPTION_STATUSES_NO_EXPIRED`、`SubscriptionStatus`。

#### `frontend/src/pages/Subscriptions/components/SubscriptionCard.tsx`
- 不变：继续展示 `STATUS_LABELS[item.status]` / `STATUS_STYLES[item.status]`，现在反映后端计算后的 `active|expired|paused`。

### 9.3 后端改动

#### `backend/src/main/java/com/nexus/dto/request/SubscriptionUpdateRequest.java`
- 删除 `private String status;  // active|expired|cancelled|paused` 字段。

#### `backend/src/main/java/com/nexus/service/SubscriptionService.java`
- 删除 `ALLOWED_STATUSES` 常量与 `validateStatus()` 方法。
- `update()` 中删除 95-101 行的 `status` 处理块（包含 lifetime 不可设为 expired 的校验，该校验不再需要——lifetime 状态不再被设置）。
- 将 `autoExpireOverdue()` 重写为 `recomputeDateBasedStatuses()`：

```java
/**
 * 按日期重新计算 monthly/yearly/one_time 的状态：
 * - expire 为空或 today <= expire → active
 * - today - expire <= 7 天 → expired
 * - today - expire > 7 天 → paused
 * autoRenew=true 的 monthly/yearly 已由 rollAutoRenewals 保证 active，跳过。
 * archived 记录不参与计算。
 */
public int recomputeDateBasedStatuses() {
    LocalDate today = LocalDate.now();
    List<Subscription> candidates = subscriptionMapper.selectList(new LambdaQueryWrapper<Subscription>()
            .eq(Subscription::isArchived, false)
            .in(Subscription::getBillingType, "monthly", "yearly", "one_time"));

    int count = 0;
    for (Subscription s : candidates) {
        if (s.isAutoRenew() && ("monthly".equals(s.getBillingType()) || "yearly".equals(s.getBillingType()))) {
            continue;
        }
        LocalDate expire = s.getExpireDate();
        String newStatus;
        if (expire == null || !expire.isBefore(today)) {
            newStatus = "active";
        } else {
            long daysOverdue = java.time.temporal.ChronoUnit.DAYS.between(expire, today);
            newStatus = daysOverdue > 7 ? "paused" : "expired";
        }
        if (!newStatus.equals(s.getStatus())) {
            s.setStatus(newStatus);
            subscriptionMapper.updateById(s);
            count++;
        }
    }
    return count;
}
```

#### `backend/src/main/java/com/nexus/scheduler/SubscriptionNotifyScheduler.java`
- `markExpiredSubscriptions()`（37-45 行）中：
  ```java
  int affected = subscriptionService.autoExpireOverdue();
  log.info("Subscription 自动过期扫描完成，共 {} 条置为 expired", affected);
  ```
  改为：
  ```java
  int affected = subscriptionService.recomputeDateBasedStatuses();
  log.info("Subscription 状态自动重算完成，共 {} 条变更", affected);
  ```

### 9.4 数据迁移（见 §11 的 V1_11，一并执行）
```sql
UPDATE subscriptions SET status = 'active' WHERE status = 'cancelled';
```
原 `cancelled` 记录先归一为 `active`，下一次每日调度（`recomputeDateBasedStatuses`）会按日期自动修正为 `active`/`expired`/`paused`。

---

## 10. 归档 Tab + 取消归档（对应需求 10）

### 10.1 类型调整 — `frontend/src/pages/Subscriptions/subscriptions.shared.ts`
```ts
export type SubscriptionFilter = 'all' | 'expiring' | 'expired'
export type SubscriptionView = 'active' | 'archived'
```
（原 `'archived'` 从 `SubscriptionFilter` 中移除，改为独立的 `SubscriptionView`）

同时建议给 `expiredItems` 的计算补上归档过滤（`isExpired` 本身不检查 `archived`）：在 `index.tsx` 中改为
```ts
const expiredItems = useMemo(() => items.filter((i) => isExpired(i) && !i.archived), [items])
```

### 10.2 `frontend/src/pages/Subscriptions/index.tsx`
- 新增状态：`const [view, setView] = useState<SubscriptionView>('active')`
- `filteredItems` 改为：
```ts
const filteredItems = useMemo(() => {
  if (view === 'archived') return archivedItems
  if (filter === 'expiring') return expiringSoonItems
  if (filter === 'expired') return expiredItems
  return items.filter((i) => !i.archived)
}, [archivedItems, expiredItems, expiringSoonItems, filter, items, view])
```
- 新增取消归档处理：
```ts
const handleUnarchive = (id: string) => {
  const target = items.find((i) => i.id === id)
  if (!target) return
  updateMutation.mutate({ id, payload: { archived: false } })
}
```
- `sharedProps` 中新增：`view`、`onViewChange: setView`、`onUnarchive: handleUnarchive`；`filter`/`onFilterChange` 保留但仅在 `view === 'active'` 时由 UI 展示筛选 chip。

### 10.3 新增 `frontend/src/pages/Subscriptions/components/SubscriptionViewTabs.tsx`
```tsx
import { cn } from '../../../lib/utils'
import type { SubscriptionView } from '../subscriptions.shared'

type SubscriptionViewTabsProps = {
  view: SubscriptionView
  archivedCount: number
  onChange: (view: SubscriptionView) => void
}

// SubscriptionViewTabs 在“订阅”与“已归档”视图之间切换。
export function SubscriptionViewTabs({ view, archivedCount, onChange }: SubscriptionViewTabsProps) {
  return (
    <div className="inline-flex rounded-lg border bg-muted/40 p-1">
      <button
        type="button"
        onClick={() => onChange('active')}
        className={cn('h-8 rounded-md px-3 text-xs font-bold transition-colors', view === 'active' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}
      >
        订阅
      </button>
      <button
        type="button"
        onClick={() => onChange('archived')}
        className={cn('h-8 rounded-md px-3 text-xs font-bold transition-colors', view === 'archived' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}
      >
        已归档{archivedCount > 0 ? ` (${archivedCount})` : ''}
      </button>
    </div>
  )
}
```

### 10.4 `SummaryBar.tsx`
- 移除"已归档"筛选 chip（59-70 行）及 `archivedCount`/`Archive` 相关导入。`SummaryBarProps` 移除 `archivedCount`。
- `SubscriptionFilter` 类型现在只有 `'all' | 'expiring' | 'expired'`，`onFilterChange(filter === 'archived' ? ...)` 分支整体删除。

### 10.5 `SubscriptionsDesktopView.tsx` / `SubscriptionsMobileView.tsx`
- 在标题行下方插入 `<SubscriptionViewTabs view={props.view} archivedCount={props.archivedCount} onChange={props.onViewChange} />`。
- 当 `view === 'archived'`：
  - 不渲染 `SubscriptionsStatsBar` 和 `SummaryBar`（统计针对活跃订阅，归档视图不需要）。
  - 列表渲染 `archivedItems`（即 `props.items`，因为 `filteredItems` 已在 `view==='archived'` 时返回 `archivedItems`），每张卡传入 `onUnarchive={props.onUnarchive}`。
  - 空状态文案改为"暂无已归档订阅"。
- 当 `view === 'active'`：保持现状（`SubscriptionsStatsBar` + `SummaryBar` + 列表，`onUnarchive` 不传）。

### 10.6 `SubscriptionCard.tsx`
- 新增可选 prop `onUnarchive?: (id: string) => void`。
- 当传入 `onUnarchive` 时，在操作按钮区域（81-87 行）新增"取消归档"按钮（放在编辑/删除之前）：
```tsx
{onUnarchive && (
  <button type="button" onClick={() => onUnarchive(item.id)} className="nexus-button-utility h-9 w-9 text-muted-foreground hover:text-primary" aria-label="取消归档">
    <ArchiveRestore className="h-4 w-4" />
  </button>
)}
```
（`ArchiveRestore` 从 `lucide-react` 导入）

---

## 11. Settings 订阅模块新增"专用模型"配置（对应需求 11）

参照 `TranslateSettingsPanel.tsx` 的模式（`workflowType: 'translate'`），新增 `workflowType: 'subscriptions'`，用于 `SubscriptionCategoryAiService` 的 AI 自动分类。

### 11.1 迁移 `backend/src/main/resources/db/migration/V1_11__subscriptions_status_and_model.sql`（新建）
```sql
-- V1_11: 订阅状态语义调整（移除 cancelled）+ 订阅模块专用模型配置

-- 移除“已取消”状态语义，统一归并为 active；下一次每日调度会按日期重新计算为 active/expired/paused
UPDATE subscriptions SET status = 'active' WHERE status = 'cancelled';

INSERT INTO workflow_llm_configs (id, workflow_type)
VALUES (gen_random_uuid()::text, 'subscriptions')
ON CONFLICT (workflow_type) DO NOTHING;
```

### 11.2 `backend/src/main/java/com/nexus/service/SubscriptionCategoryAiService.java`
- 第 37 行：
  ```java
  ChatLanguageModel model = llmConfigService.resolveModel("inbox");
  ```
  改为：
  ```java
  ChatLanguageModel model = llmConfigService.resolveModel("subscriptions");
  ```
  （原 `"inbox"` 是历史占位符；改为独立 `subscriptions` workflow 后，未在 Settings 中配置时 `resolveModel` 会抛 `IllegalStateException`——V1_11 迁移已插入该 workflow 的默认行，确保不为空。）

### 11.3 新增 `frontend/src/pages/Settings/components/SubscriptionModelPanel.tsx`
完全参照 `TranslateSettingsPanel.tsx`，仅替换标题/说明文案：

```tsx
import { AlertCircle, Loader2, Save } from 'lucide-react'
import type { LlmProvider } from '../../../types/domain.types'
import { WorkflowModelSelect } from './WorkflowModelSelect'

type SubscriptionModelPanelProps = {
  providers: LlmProvider[]
  providerId: string
  dirty: boolean
  workflowsLoading: boolean
  workflowsError: boolean
  savePending: boolean
  saveError: boolean
  onProviderChange: (providerId: string) => void
  onSave: () => void
  onCancel: () => void
}

// SubscriptionModelPanel 管理订阅模块 AI 自动分类使用的专用模型，采用显式保存避免选择时自动提交。
export function SubscriptionModelPanel({
  providers, providerId, dirty, workflowsLoading, workflowsError, savePending, saveError, onProviderChange, onSave, onCancel,
}: SubscriptionModelPanelProps) {
  return (
    <section className="nexus-surface space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-foreground">订阅设置</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">用于新增/编辑订阅时的 AI 自动分类识别</p>
        </div>
        {dirty && (
          <span className="rounded-md bg-warning-soft px-2 py-1 text-xs font-bold text-warning">
            有未保存更改
          </span>
        )}
      </div>

      <div className="rounded-xl border border-border bg-muted/30 p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_320px] lg:items-center">
          <div>
            <h3 className="text-sm font-extrabold text-foreground">专用模型</h3>
          </div>
          <WorkflowModelSelect
            providers={providers}
            value={providerId}
            onChange={onProviderChange}
            disabled={workflowsLoading || savePending}
          />
        </div>
      </div>

      {workflowsLoading && <p className="text-sm text-muted-foreground">加载中…</p>}
      {workflowsError && (
        <p className="flex items-center gap-1.5 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" /> 加载订阅模型配置失败
        </p>
      )}
      {providers.length === 0 && (
        <p className="text-xs text-muted-foreground">添加模型后可指定专用模型。</p>
      )}

      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card/95 p-3 shadow-[var(--shadow-xs)]">
        <button type="button" onClick={onSave} disabled={!dirty || savePending} className="nexus-button-primary inline-flex items-center gap-1.5 px-4 text-xs disabled:opacity-50">
          {savePending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {savePending ? '保存中…' : '保存设置'}
        </button>
        <button type="button" onClick={onCancel} disabled={!dirty || savePending} className="nexus-button-utility px-4 text-xs disabled:opacity-50">
          取消更改
        </button>
        {saveError && (
          <span className="flex items-center gap-1 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5" /> 保存失败
          </span>
        )}
      </div>
    </section>
  )
}
```

### 11.4 `frontend/src/pages/Settings/index.tsx`
按 `translateSettings` 的模式（142-154、204-212 行）新增一套订阅模型状态：

```ts
const subscriptionsWorkflow = workflows.find((w) => w.workflowType === 'subscriptions')
const subscriptionsProviderId = subscriptionsWorkflow?.providerId ?? ''
const [subscriptionsProviderDraft, setSubscriptionsProviderDraft] = useState(subscriptionsProviderId)

useEffect(() => {
  setSubscriptionsProviderDraft(subscriptionsProviderId)
}, [subscriptionsProviderId])

const subscriptionsDirty = subscriptionsProviderDraft !== subscriptionsProviderId
```

在 `sharedProps` 中新增：
```ts
subscriptionsSettings: {
  providerId: subscriptionsProviderDraft,
  dirty: subscriptionsDirty,
  savePending: workflowPendingType === 'subscriptions',
  saveError: workflowMutation.isError && workflowMutation.variables?.type === 'subscriptions',
  onProviderChange: setSubscriptionsProviderDraft,
  onSave: () => workflowMutation.mutate({ type: 'subscriptions', providerId: subscriptionsProviderDraft }),
  onCancel: () => setSubscriptionsProviderDraft(subscriptionsProviderId),
},
```

### 11.5 `SettingsDesktopView.tsx` / `SettingsMobileView.tsx`
- `SettingsViewProps`（11-30 行附近）新增 `subscriptionsSettings` 字段，类型与 `translateSettings` 一致。
- 在 `activeSettingsTab === 'subscriptions'` 区块（Desktop 261-271 行 / Mobile 232-242 行）中，`SubscriptionCategoriesPanel` **之前**插入：
```tsx
<SubscriptionModelPanel
  providers={providers}
  providerId={subscriptionsSettings.providerId}
  dirty={subscriptionsSettings.dirty}
  workflowsLoading={workflowsLoading}
  workflowsError={workflowsError}
  savePending={subscriptionsSettings.savePending}
  saveError={subscriptionsSettings.saveError}
  onProviderChange={subscriptionsSettings.onProviderChange}
  onSave={subscriptionsSettings.onSave}
  onCancel={subscriptionsSettings.onCancel}
/>
```
并补充 import。

---

## 12. 文件改动清单

### 后端
- `backend/src/main/resources/db/migration/V1_11__subscriptions_status_and_model.sql`（新建）
- `backend/src/main/java/com/nexus/dto/request/SubscriptionUpdateRequest.java`（删除 `status` 字段）
- `backend/src/main/java/com/nexus/service/SubscriptionService.java`（删除状态校验/手动设置，`autoExpireOverdue` → `recomputeDateBasedStatuses`）
- `backend/src/main/java/com/nexus/scheduler/SubscriptionNotifyScheduler.java`（调用新方法名）
- `backend/src/main/java/com/nexus/service/SubscriptionCategoryAiService.java`（`resolveModel("inbox")` → `resolveModel("subscriptions")`）

### 前端
- `frontend/src/types/domain.types.ts`（`Subscription.status` 类型收窄）
- `frontend/src/pages/Subscriptions/subscriptions.shared.ts`（状态常量、`SubscriptionFilter`/`SubscriptionView`、`dueDateLabel` 文案）
- `frontend/src/pages/Subscriptions/index.tsx`（view 状态、归档处理、弹层集中渲染、统计过滤修正）
- `frontend/src/pages/Subscriptions/SubscriptionsDesktopView.tsx`（移除弹层渲染、加 Tabs、归档视图分支）
- `frontend/src/pages/Subscriptions/SubscriptionsMobileView.tsx`（同上）
- `frontend/src/pages/Subscriptions/components/SubscriptionFormDialog.tsx`（重写为响应式弹层）
- `frontend/src/pages/Subscriptions/components/SubscriptionFormSheet.tsx`（删除）
- `frontend/src/pages/Subscriptions/components/SubscriptionFormFields.tsx`（分类下拉、日期联动、文案重命名、提醒区块重排、移除状态 Select）
- `frontend/src/pages/Subscriptions/components/CategoryInput.tsx`（改为下拉框 + AI 按钮）
- `frontend/src/pages/Subscriptions/components/SummaryBar.tsx`（移除"已归档"筛选 chip）
- `frontend/src/pages/Subscriptions/components/SubscriptionCard.tsx`（`onUnarchive` 按钮）
- `frontend/src/pages/Subscriptions/components/SubscriptionViewTabs.tsx`（新建）
- `frontend/src/pages/Settings/components/SubscriptionModelPanel.tsx`（新建）
- `frontend/src/pages/Settings/index.tsx`（订阅专用模型状态/mutation）
- `frontend/src/pages/Settings/SettingsDesktopView.tsx` / `SettingsMobileView.tsx`（新增面板渲染 + props 类型）

---

## 13. 手动验证清单

1. 新增订阅（monthly）：填写名称后点击分类右侧 ✨ 按钮 → 分类下拉框自动选中 AI 返回的分类；该分类此前不存在时，Settings → 订阅 → 分类列表中应出现新分类。
2. 新增订阅（monthly）：填写"开始日期" → "到期日期"和"下次扣费日期"自动填充为 +1 个月；手动修改"到期日期"后再改"开始日期"，到期日期不应被覆盖。
3. 编辑表单中不再出现"状态"选择框；保存后卡片状态徽标随到期日期变化（可通过临时修改到期日期为过去日期验证：1-7 天内 → 已过期，>7 天 → 已暂停，未过期 → 订阅中）。
4. "到期提醒"卡片：关闭开关时不显示"提前 N 天"输入；开启后在同一卡片内显示。
5. 归档一条订阅 → 切换到"已归档" Tab，统计区和筛选 chip 隐藏，列表只显示归档项；点击"取消归档" → 该项回到"订阅"Tab 的列表中。
6. 移动端 / 桌面端打开新增/编辑弹层：移动端为底部弹出 sheet（带拖拽把手），桌面端（≥640px）为居中 Dialog，样式与 ToDo 弹层一致。
7. Settings → 订阅 Tab：出现"专用模型"区块，选择模型后"保存设置"按钮可用，保存后刷新页面仍保留选择；新增订阅时 AI 自动分类应使用此处配置的模型。
8. 后端单测：`SubscriptionServiceTest`（如存在）需更新——移除 `update()` 设置 `status` 相关用例，新增 `recomputeDateBasedStatuses()` 的三种场景（active/expired/paused）用例。

---

## 14. 给用户的开放性问题 / 已做出的假设（无需阻塞实施，但建议确认）

1. **"已过期"7 天窗口的起点**：假设是自然日（`ChronoUnit.DAYS.between`），不考虑时区差异（系统已统一用 `LocalDate.now()`，与现有 `autoExpireOverdue` 一致）。
2. **归档记录的状态计算**：`recomputeDateBasedStatuses()` 跳过 `archived=true` 的记录，归档时的状态会被"冻结"，取消归档后需等下一次每日调度才会刷新（凌晨 00:05）。如需归档/取消归档时立即重算，可在 `update()` 中检测 `archived` 由 true→false 时同步调用一次单条状态重算——本计划未包含该即时重算，作为后续可选优化。
3. **分类下拉框为空时**：若 Settings 尚未配置任何分类且 AI 识别也未触发，下拉框显示"暂无分类，点击右侧按钮 AI 自动生成"提示，不允许手动输入新分类名（分类的唯一入口是 Settings 手动添加或 AI 自动生成）。
