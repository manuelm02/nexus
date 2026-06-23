# Subscriptions 页面二轮 UI 整改方案

## 0. 背景

上一轮重构（用量面板隔离 + DeepSeek 余额监控 + 概览图表 + 汇率折算，见 `2026-06-16-subscriptions-usage-redesign.md`）已落地。基于实际运行截图，发现 9 处布局/交互/文案问题需要打磨：新增按钮位置不统一、用量卡片栅格过宽、卡片左侧圆环占位无意义、趋势图英文 tooltip、表单仍可创建"按量"类型、概览图表语义与配色需要调整，以及统计卡片信息重复且未统一折算为人民币。本方案逐项给出落地修改点。

---

## 1+2. 统一"新增"按钮位置与文案

**现状**：
- `SubscriptionsDesktopView.tsx` / `SubscriptionsMobileView.tsx`：仅当 `view === 'subscriptions'` 时，在标题行右侧渲染"添加订阅"按钮（`onCreateClick`）。
- `usage/UsageTabView.tsx`（第 20-27 行）：自己在内容区右上角渲染"添加用量账户"按钮，并自管 `createOpen` state。

两者位置不一致（一个在页面标题行，一个在用量统计行）。

**改动**：
1. `usage/UsageTabView.tsx`：将 `createOpen` state 上提为受控 prop（`createOpen` / `onCreateOpenChange`），`UsageTabView` 不再渲染自己的按钮，移除第 20-27 行的按钮和外层 `flex items-center justify-between`（保留"共 N 个用量账户"文案即可）。
2. `SubscriptionsDesktopView.tsx` / `SubscriptionsMobileView.tsx`：
   - `showAddButton = view === 'subscriptions' || view === 'usage'`
   - 按钮文案统一为 `+ 新增`（去掉"添加订阅"/"添加用量账户"的区分文案）
   - `onClick`：`view === 'subscriptions' ? props.onCreateClick : props.onCreateUsageClick`
   - 将 `UsageTabView` 的 `createOpen`/`onCreateOpenChange` 接到新增的 `usageCreateOpen` / `setUsageCreateOpen`
3. `index.tsx`：新增 `usageCreateOpen` state 与 `onCreateUsageClick = () => setUsageCreateOpen(true)`，传入 `sharedProps`；`UsageTabView` 通过 Desktop/Mobile View 透传该 state。

文件：`SubscriptionsDesktopView.tsx`、`SubscriptionsMobileView.tsx`、`usage/UsageTabView.tsx`、`index.tsx`

---

## 3. 用量面板卡片改为单列（一行一个）

**改动**：`usage/UsageTabView.tsx` 第 34 行，将 `<section className="grid gap-3 lg:grid-cols-2">` 改为 `<section className="space-y-3">`（卡片各占一行）。

不改动"已归档"Tab 的混合栅格（`lg:grid-cols-2`），那是另一个场景。

---

## 4. 移除用量卡片左侧圆环占位

**改动**：`components/UsageAccountCard.tsx`
- 删除 `RadialProgress` 的渲染（第 90-94 行）及其 import（第 5 行）。
- 删除 `RING_COLOR_BY_HEALTH` 常量（第 23-27 行）及 `balanceRatio` import（第 6 行）——仅在此处使用。
- 头部 `flex items-center gap-3` 容器去掉圆环子元素后，名称/徽标区域自然左移，左侧留白即可（无需占位容器）。
- `TEXT_COLOR_BY_HEALTH`、`BORDER_BY_HEALTH`、`balanceHealth` 继续保留（用于余额文字颜色和卡片左边框强调色）。

> `components/ui/RadialProgress.tsx` 和 `subscriptions.shared.ts` 中的 `balanceRatio` 暂不删除（用户提到后续可能用于展示 Provider Logo），仅移除当前引用。

---

## 5. 余额趋势图 Tooltip 英文 "balance" → "余额"

**改动**：`usage/BalanceTrendChart.tsx` 第 37 行，给 `<Area>` 增加 `name="余额"`：

```tsx
<Area type="monotone" dataKey="balance" name="余额" stroke="hsl(var(--primary))" fill={`url(#balance-${subscriptionId})`} strokeWidth={1.5} />
```

Recharts 默认 Tooltip 会用 `name`（未设置时回退到 `dataKey`）作为条目标签，设置后 Tooltip 显示"余额 : 6.78"。

---

## 6. 新增订阅表单移除"按量"选项

**现状**：`SubscriptionFormFields.tsx` 第 147 行 `BILLING_TYPES = Object.keys(BILLING_TYPE_LABELS)`，下拉包含 `per_token`（"按量"）。用量账户现在统一通过 `UsageAccountCreateDialog` 创建；但"已归档"Tab 中已存在的 `per_token` 订阅仍可能通过通用表单编辑（`onEdit` → `SubscriptionFormDialog`），下拉需要能正确显示其当前值。

**改动**：`SubscriptionFormFields.tsx`
```ts
const BILLING_TYPES = Object.keys(BILLING_TYPE_LABELS)
// 计费类型下拉：新建场景不出现"按量"；仅当正在编辑的项本身就是按量账户时才保留该选项（避免 Select 出现无匹配值）
const billingTypeOptions = bt === 'per_token' ? BILLING_TYPES : BILLING_TYPES.filter((t) => t !== 'per_token')
```
第 223 行 `SelectField` 的 `options` 改为 `billingTypeOptions`。

`BILLING_TYPE_LABELS`（`lib/constants.ts`）保留 `per_token: '按量'` 不删，仅用于展示已存在的按量订阅。

---

## 7+9. 概览趋势图：改为"近 6 个月总支出"折线图（CNY），配色与整体风格统一

**现状**：`components/dashboard/ForecastChart.tsx` 是按币种分组的"未来 6 个月预计支出"柱状图（`forecastMonthlySpend`），配色 `CNY: primary` / `USD: warning` 双色。

**改动**：

1. `subscriptions.shared.ts`：
   - 删除 `ForecastPoint` 类型和 `forecastMonthlySpend` 函数（第 175-210 行）。
   - 新增：
     ```ts
     export type MonthlySpendPoint = { month: string; total: number }

     /**
      * 近 N 个月"月度等效总支出"折算为 CNY 的趋势：
      * monthly 按月价计入，yearly 按 price/12 计入；
      * 若订阅有 startDate 且晚于该月月末，则该月不计入（订阅尚未开始）。
      * 非 CNY 金额按 rates 折算，缺失汇率的币种当月不计入（与 categorySpendConverted 一致的口径）。
      */
     export function monthlySpendTrend(items: Subscription[], rates: Record<string, number>, monthsBack = 6): MonthlySpendPoint[] {
       const today = new Date()
       today.setDate(1)
       today.setHours(0, 0, 0, 0)

       const points: MonthlySpendPoint[] = []
       for (let i = monthsBack - 1; i >= 0; i--) {
         const d = new Date(today)
         d.setMonth(d.getMonth() - i)
         const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0)
         let total = 0

         items.forEach((item) => {
           if (item.archived || item.status !== 'active') return
           if (item.billingType !== 'monthly' && item.billingType !== 'yearly') return
           if (item.startDate) {
             const start = new Date(`${item.startDate}T00:00:00`)
             if (start > monthEnd) return
           }
           const currency = item.currency || 'CNY'
           const rate = currency === 'CNY' ? 1 : rates[currency]
           if (rate == null) return
           const monthlyEquivalent = (item.billingType === 'monthly' ? (item.price ?? 0) : (item.price ?? 0) / 12) * rate
           total += monthlyEquivalent
         })

         points.push({ month: `${d.getMonth() + 1}月`, total })
       }
       return points
     }
     ```

2. 新建 `components/dashboard/MonthlySpendTrendChart.tsx`（替代 `ForecastChart.tsx`，删除旧文件）：
   ```tsx
   import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
   import type { Subscription } from '../../../../types/domain.types'
   import { monthlySpendTrend } from '../../subscriptions.shared'

   type MonthlySpendTrendChartProps = { items: Subscription[]; rates: Record<string, number> }

   // MonthlySpendTrendChart 概览图表：近 6 个月总支出（CNY，月度等效）趋势，配色与用量趋势图统一使用 primary 渐变
   export function MonthlySpendTrendChart({ items, rates }: MonthlySpendTrendChartProps) {
     const data = monthlySpendTrend(items, rates, 6)
     return (
       <div className="nexus-surface p-4">
         <h3 className="text-sm font-bold">近 6 个月总支出（CNY，月度等效）</h3>
         <div className="mt-2 h-56 w-full">
           <ResponsiveContainer width="100%" height="100%">
             <AreaChart data={data}>
               <defs>
                 <linearGradient id="monthly-spend-trend" x1="0" y1="0" x2="0" y2="1">
                   <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                   <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                 </linearGradient>
               </defs>
               <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
               <XAxis dataKey="month" tick={{ fontSize: 11 }} />
               <YAxis tick={{ fontSize: 11 }} />
               <Tooltip formatter={(value) => Number(value).toFixed(2)} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
               <Area type="monotone" dataKey="total" name="总支出" stroke="hsl(var(--primary))" fill="url(#monthly-spend-trend)" strokeWidth={1.5} />
             </AreaChart>
           </ResponsiveContainer>
         </div>
       </div>
     )
   }
   ```
   颜色与 `usage/BalanceTrendChart.tsx` 的渐变写法一致（primary 渗透渐变），实现"配色和整体 UI 风格统一"。

> **假设说明**：当前没有历史月度支出的后端记录，"近6个月总支出"为基于当前订阅数据按 `startDate` 反推的近似值（订阅在该月已存在则计入，按月度等效折算）。如需精确历史值需后端新增按月快照表，本方案不在此次范围内，按近似口径实现。

---

## 8. 概览整体布局重排：图表置顶 + 统计卡片统一尺寸/去重 + 全部折算 CNY

**现状**：
- `SubscriptionsDashboard.tsx`：`StatsBar`（4 卡：订阅中/月度订阅费/年度订阅费/本月待支付） → `SummaryBar`（"月度支出（订阅中）"卡 + 即将到期/已到期 筛选按钮） → 图表 grid（Forecast + CategoryPie） → ExpiryTimeline。
- "月度订阅费"（StatsBar，来自 `stats.monthlyTotal`）与"月度支出（订阅中）"（SummaryBar，来自前端 `groupMonthlyTotalsByCurrency`）语义重复。
- 统计卡片（`rounded-lg border bg-card p-4`）与筛选按钮（`h-10` inline button）尺寸/样式不统一。
- 各卡片按币种分行展示（如 `$40.00` / `¥260.00`），未折算为统一货币。

**改动**：

1. `subscriptions.shared.ts` 新增 CNY 折算辅助函数：
   ```ts
   export type CnyAmount = { cny: number; unconverted: { currency: string; amount: number }[] }

   /** 将 {currency: amount} 记录折算为 CNY 汇总；汇率缺失的币种归入 unconverted，由调用方展示提示 */
   export function toCnyAmount(record: Record<string, number>, rates: Record<string, number>): CnyAmount {
     let cny = 0
     const unconverted: { currency: string; amount: number }[] = []
     Object.entries(record).forEach(([currency, amount]) => {
       const rate = currency === 'CNY' ? 1 : rates[currency]
       if (rate == null) { unconverted.push({ currency, amount }); return }
       cny += amount * rate
     })
     return { cny, unconverted }
   }
   ```

2. 删除 `components/SummaryBar.tsx` 和 `components/SubscriptionsStatsBar.tsx`，新建 `components/SubscriptionsStatsRow.tsx`：一行 6 个等尺寸卡片（`grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6`，每个卡片样式统一为 `rounded-lg border bg-card p-4 shadow-[var(--shadow-xs)]`，筛选卡可点击）：
   - 订阅中（`stats.activeCount`，纯数字）
   - 月度支出（`toCnyAmount(stats.monthlyTotal, rates)`，合并原"月度订阅费"与"月度支出（订阅中）"）
   - 年度支出（`toCnyAmount(stats.yearlyTotal, rates)`）
   - 本月待支付（`toCnyAmount(stats.dueThisMonth, rates)`）
   - 即将到期 {count}（可点击筛选，样式改为与统计卡一致的 `p-4` 卡片 + hover 高亮，替代原 `h-10` 按钮）
   - 已到期 {count}（同上）

   金额卡片展示：`formatMoney('CNY', cny)` 为主要数字；若 `unconverted.length > 0`，下方小字 `text-[11px] text-muted-foreground` 列出 `如 +$12.00 (汇率未覆盖)`。

3. `SubscriptionsDashboard.tsx` 重写为：
   ```tsx
   export function SubscriptionsDashboard(props: SubscriptionsDashboardProps) {
     const { data: ratesData } = useQuery({
       queryKey: ['subscription-exchange-rates'],
       queryFn: () => subscriptionApi.exchangeRates(),
       staleTime: 1000 * 60 * 60,
     })
     const rates = ratesData?.data?.data ?? {}

     return (
       <div className="space-y-5">
         <div className="grid gap-4 lg:grid-cols-2">
           <MonthlySpendTrendChart items={props.subscriptionItems} rates={rates} />
           <CategoryPieChart items={props.subscriptionItems} rates={rates} />
         </div>
         <SubscriptionsStatsRow
           stats={props.stats}
           statsLoading={props.statsLoading}
           rates={rates}
           expiringCount={props.expiringCount}
           expiredCount={props.expiredCount}
           filter={props.filter}
           onFilterChange={props.onFilterChange}
         />
         <ExpiryTimeline items={props.subscriptionItems} />
       </div>
     )
   }
   ```
   汇率统一在 Dashboard 层获取一次，下传给 `MonthlySpendTrendChart`、`CategoryPieChart`、`SubscriptionsStatsRow`。

4. `components/dashboard/CategoryPieChart.tsx`：移除自身的 `useQuery(['subscription-exchange-rates'])`（第 13-18 行），改为接收 `rates: Record<string, number>` prop；"汇率加载中"分支随之移除（由父组件统一处理 loading，可简单地在 ratesData 未到达前 `rates = {}` 渐进渲染，与现有 `categorySpendConverted` 对缺失汇率的 `excludedCount` 处理已兼容）。

5. 移除 `monthlyTotals` 这条数据链路（不再被任何组件使用）：
   - `index.tsx`：删除 `groupMonthlyTotalsByCurrency` import 与 `monthlyTotals` 计算（第 6、40 行），从 `sharedProps` 移除 `monthlyTotals`（第 136 行）。
   - `SubscriptionsDesktopView.tsx` / `SubscriptionsMobileView.tsx`：移除 `monthlyTotals` prop 类型与传递。
   - `SubscriptionsDashboard.tsx` props 类型移除 `monthlyTotals`。
   - `groupMonthlyTotalsByCurrency` 在 `subscriptions.shared.ts` 中若无其他引用则一并删除（已确认仅此处使用）。

---

## 文件改动清单

| 文件 | 操作 |
|---|---|
| `pages/Subscriptions/SubscriptionsDesktopView.tsx` | 改：统一新增按钮（位置+"+ 新增"文案+用量入口） |
| `pages/Subscriptions/SubscriptionsMobileView.tsx` | 改：同上 |
| `pages/Subscriptions/index.tsx` | 改：新增 `usageCreateOpen` state；移除 `monthlyTotals` 链路 |
| `pages/Subscriptions/usage/UsageTabView.tsx` | 改：移除自带按钮，改为受控 `createOpen`；卡片栅格改单列 |
| `pages/Subscriptions/components/UsageAccountCard.tsx` | 改：移除左侧圆环及相关常量/import |
| `pages/Subscriptions/usage/BalanceTrendChart.tsx` | 改：`<Area name="余额">` |
| `pages/Subscriptions/components/SubscriptionFormFields.tsx` | 改：新建场景下拉移除"按量" |
| `pages/Subscriptions/subscriptions.shared.ts` | 改：删 `forecastMonthlySpend`/`ForecastPoint`/`groupMonthlyTotalsByCurrency`；新增 `monthlySpendTrend`、`toCnyAmount` |
| `pages/Subscriptions/components/dashboard/ForecastChart.tsx` | 删，替换为 `MonthlySpendTrendChart.tsx`（新建） |
| `pages/Subscriptions/components/dashboard/CategoryPieChart.tsx` | 改：接收 `rates` prop，移除自身汇率请求 |
| `pages/Subscriptions/components/SummaryBar.tsx` | 删 |
| `pages/Subscriptions/components/SubscriptionsStatsBar.tsx` | 删 |
| `pages/Subscriptions/components/SubscriptionsStatsRow.tsx` | 新建：6 卡一行，全部折算 CNY |
| `pages/Subscriptions/components/SubscriptionsDashboard.tsx` | 重写：图表置顶 + 统计行 + 到期时间线，统一获取汇率 |

---

## 验证清单

1. `pnpm build`（类型检查，确认无未使用的 import/prop 残留）。
2. 浏览器走一遍：
   - 概览 Tab：折线图（近6个月总支出 CNY）在饼图上方/同行；下方统计行 6 张卡片尺寸一致，金额均为 CNY；点击"即将到期/已到期"卡片可正确筛选并跳转"订阅"Tab。
   - "订阅"Tab 与"用量面板"Tab：顶部"+ 新增"按钮位置一致；点击后分别打开订阅表单 / 用量账户创建弹窗。
   - 用量面板：卡片单列展示，无左侧圆环；余额趋势图 Tooltip 显示"余额：x.xx"。
   - 新建订阅表单：计费类型下拉无"按量"；编辑已有的按量账户（已归档 Tab）时下拉仍正确显示"按量"。
   - 含 USD 等非 CNY 订阅时，统计行金额正确折算为 CNY，且若汇率缺失能看到"未折算"提示而不报错。
