# Subscriptions 页面重构 — DESIGN.md

> 创建日期：2026-06-15
> 页面类型：内部工具 / 数据管理 Dashboard（非营销 Landing Page）
> 适用范围：`frontend/src/pages/Subscriptions/**`
> 交互档位：**L1（精致静态）** — 内部工具页面以"可扫描、低噪音"为先，不引入滚动叙事、3D、自定义光标等 L2/L3 元素。本文档不涉及 Hero / 首屏爆点 / motion library 选型，这些章节不适用，已在文末说明。

---

## 0. 设计目标回顾

把现有单一列表拆成 4 个 Tab：**概览 / 订阅 / 用量面板 / 已归档**。核心是让"周期性订阅"（月付/年付/一次性/买断）和"按量账户"（per_token，DeepSeek/OpenAI 等）在视觉上彻底分流——前者强调**时间维度**（还剩几天），后者强调**额度维度**（还剩多少钱/百分之多少）。

---

## 1. Visual Theme & Atmosphere

**延续 Nexus 现有设计系统**，不新建色板/字体——本节只新增"按量账户健康度"的语义色映射，供进度条/环形图使用。

- **基调关键词**：克制、可扫描、财务感、低饱和度
- **一句话定调**："像看银行 App 的账户卡片一样看你的订阅和余额——一眼看出'还剩多少'和'还有多久'。"
- **核心原则**：颜色只在"需要用户注意"时出现（即将到期、低余额、已超额），其余状态保持中性灰阶，避免列表整体花哨。

---

## 2. Color Palette & Roles

沿用 `frontend/src/index.css` 中已定义的全部 CSS 变量，不新增变量。本节定义**语义映射表**，所有新组件（进度条、环形图、Tab）必须从下表取色，禁止硬编码 hex。

| 语义角色 | 使用场景 | CSS 变量（前景/文字） | CSS 变量（柔和背景） |
|---|---|---|---|
| **中性 / 正常** | 周期进度条未到预警区间；余额充足（> 预警阈值 × 2，或无阈值时 > 0） | `hsl(var(--primary))` | `hsl(var(--muted))`（轨道色） |
| **关注 / 即将到期 / 低余额** | 距到期 ≤ `notifyDaysBefore` 天；余额 ≤ `lowBalanceThreshold` | `hsl(var(--warning))` | `hsl(var(--warning-soft))` |
| **告警 / 已到期 / 余额耗尽** | 已过期（含宽限期内）；`remainingBalance <= 0` | `hsl(var(--destructive))` | `hsl(var(--destructive-soft))` |
| **完成 / 已暂停（灰态）** | 超过宽限期的 paused 订阅；归档项 | `hsl(var(--muted-foreground))` | `hsl(var(--muted))` |

RGB 辅助值（用于 `rgba()`，与 `index.css` 一致）：
- `--primary-rgb: 11 29 51`
- `--warning-rgb: 147 101 22`
- `--destructive-rgb: 180 35 47`
- `--muted-foreground-rgb: 83 101 123`

> 三色分级阈值统一在 `subscriptions.shared.ts` 中以函数形式实现（如 `balanceHealth(item): 'normal' | 'low' | 'empty'`、`cycleHealth(item): 'normal' | 'soon' | 'overdue'`），组件只消费返回值，不在组件内写阈值数字——保证 Dashboard 汇总卡片和单个卡片的判定口径一致。

---

## 3. Typography Rules

沿用现有字体栈，不新增字体：

```css
font-family: "Noto Sans SC", Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
```

新组件字号层级（与现有 `SubscriptionsStatsBar` / `SummaryBar` 保持一致）：

| 用途 | class | 说明 |
|---|---|---|
| 卡片主标题（订阅名/账户名） | `text-base font-bold` | 现有 `SubscriptionCard` 标题规格 |
| 统计大数字（余额、月消费、Dashboard 汇总） | `text-2xl font-black` | 与 `SubscriptionsStatsBar` 一致 |
| 环形图中心数字 | `text-sm font-black`（桌面）/ `text-xs font-black`（移动） | 因容器只有 48-56px |
| 字段标签 / 说明文字 | `text-xs font-semibold text-muted-foreground` | 现有通用规格 |
| 进度条下方天数标签 | `text-[11px] font-bold text-muted-foreground` | 与 `UsagePopover` 中"最近充值记录"一致 |

中文排版：行高保持 Tailwind 默认（leading-normal 起），长文案（备注预览）`leading-5`；不强制加 `letter-spacing`，与现有页面保持一致（项目全局已设 `letter-spacing: 0`）。

---

## 4. Component Stylings

### 4.1 SubscriptionViewTabs（4 Tab）

复用现有 Tab 容器样式，扩展为 4 项：

```
容器：inline-flex rounded-lg border bg-muted/40 p-1
单项：h-9 rounded-md px-4 text-xs font-bold transition-colors
  - 激活态：bg-card shadow-sm text-foreground
  - 默认态：text-muted-foreground
  - hover（非激活）：hover:text-foreground
  - focus-visible：focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1
```

四个 Tab 及徽标规则：

| Tab key | 文案 | 计数徽标 |
|---|---|---|
| `dashboard` | 概览 | 无 |
| `subscriptions` | 订阅 | 无（或可选显示"即将到期"数量的小圆点，复用 `--warning`） |
| `usage` | 用量面板 | 低余额账户数 > 0 时，右上角叠加一个 `h-4 w-4 rounded-full bg-[hsl(var(--warning))]` 圆点（无数字，纯提示） |
| `archived` | 已归档 | `已归档 {count}`，count 为 0 时仍显示 "已归档 0" |

移动端：4 个 Tab 在 ≤375px 屏幕可能拥挤，允许整体容器 `overflow-x-auto` + `flex-nowrap`，单项 `shrink-0`，不换行、不缩小字号。

---

### 4.2 CycleProgressBar（"订阅" Tab 卡片 — 周期进度条）

**用途**：可视化"当前计费周期已过去多少"，仅用于 `monthly` / `yearly` / `one_time`（有明确周期起止日期的类型）。`lifetime` 不展示进度条。

**尺寸与结构**：

```
外层：mt-3 space-y-1
轨道：h-1.5 w-full rounded-full bg-muted overflow-hidden
填充：h-full rounded-full transition-[width] duration-300 ease-out
下方文字行：mt-1 flex items-center justify-between text-[11px] font-bold text-muted-foreground
  左：周期描述，如 "本周期已过 18 / 30 天"
  右：到期/续费日期，如 "下次扣费 2026-07-01"（复用现有 dueDateLabel()）
```

**计算口径**：
- 周期起点 `cycleStart`：`startDate`；若编辑后 `startDate` 早于多个周期，简化为"最近一次 `nextBillingDate`/`expireDate` 往前推一个周期"（与现有自动续费 rollover 逻辑保持一致，避免新增计算分支——直接复用 `SubscriptionService` 已有的周期长度：monthly=1月，yearly=1年）
- 周期终点 `cycleEnd`：`nextBillingDate ?? expireDate`
- `progress = clamp((today - cycleStart) / (cycleEnd - cycleStart), 0, 1)`
- `one_time` 类型：`cycleStart = startDate`，`cycleEnd = expireDate`，文案改为"已进行 18 / 30 天"

**颜色分级**（取自 §2 语义表）：

| 条件 | 填充色 | 轨道色 |
|---|---|---|
| 剩余天数 > `notifyDaysBefore` | `bg-[hsl(var(--primary))]` | `bg-muted`（默认） |
| `0 <= 剩余天数 <= notifyDaysBefore`（即 `isExpiringSoon`） | `bg-[hsl(var(--warning))]` | `bg-[hsl(var(--warning-soft))]` |
| 已超过 `cycleEnd`（`isExpired`） | `bg-[hsl(var(--destructive))]`，width 固定 100% | `bg-[hsl(var(--destructive-soft))]` |

**无周期数据时**（`cycleEnd` 为空，如未设置 `nextBillingDate`/`expireDate` 的 `lifetime`）：不渲染进度条，仅保留下方信息行（与现状一致）。

---

### 4.3 UsageRingChart（"用量面板" Tab 卡片 — 环形图）

新建组件 `frontend/src/components/ui/RadialProgress.tsx`，纯 SVG 实现，不引入图表库。

**尺寸**：
- 桌面：`56 × 56px`，`stroke-width: 6`
- 移动：`48 × 48px`，`stroke-width: 5`

**结构**（SVG，`viewBox="0 0 56 56"`，`r=24`，`circumference = 2πr ≈ 150.8`）：

```html
<svg width="56" height="56" viewBox="0 0 56 56" class="-rotate-90">
  <!-- 轨道 -->
  <circle cx="28" cy="28" r="24" fill="none" stroke="hsl(var(--muted))" stroke-width="6" />
  <!-- 进度弧，颜色按健康度分级 -->
  <circle
    cx="28" cy="28" r="24" fill="none"
    stroke="hsl(var(--{health-color}))" stroke-width="6"
    stroke-linecap="round"
    stroke-dasharray="150.8"
    stroke-dashoffset="{150.8 * (1 - ratio)}"
    class="transition-[stroke-dashoffset] duration-500 ease-out"
  />
</svg>
<!-- 中心文字：use absolute positioning + flex centering on wrapper -->
```

**比例口径** `ratio`：
- 若设置了 `lowBalanceThreshold`：`ratio = remainingBalance / (lowBalanceThreshold * 3)`（参考刻度：阈值的 3 倍视为"满"），`clamp(0, 1)`
- 若未设置阈值：`ratio = remainingBalance > 0 ? 1 : 0`（仅区分"有余额/无余额"两态，环形图退化为实心圆/空心圆）
- 中心文字：始终显示**余额数值**（`item.remainingBalance.toFixed(0)` + 货币符号缩写），不显示百分号——余额绝对值对用户更有意义，环形只是辅助视觉

**颜色分级**（`health-color`，对应 §2）：

| 条件 | 环形颜色 | 中心文字颜色 |
|---|---|---|
| `remainingBalance > lowBalanceThreshold`（或未设阈值且 `> 0`） | `--primary` | `text-foreground` |
| `0 < remainingBalance <= lowBalanceThreshold` | `--warning` | `text-[hsl(var(--warning))]` |
| `remainingBalance <= 0` | `--destructive` | `text-[hsl(var(--destructive))]` |

---

### 4.4 UsageAccountCard（"用量面板" Tab — 卡片整体布局）

替代现状 `SubscriptionCard` 中的 `PerTokenInfo` 分支，独立组件 `frontend/src/pages/Subscriptions/components/UsageAccountCard.tsx`。

```
外层：rounded-lg border bg-card p-4 shadow-[var(--shadow-xs)]（与现有卡片一致）

布局（flex 横向，桌面/移动通用）：
┌──────────────────────────────────────────────┐
│ ┌────┐  名称 + 分类 chip                       │
│ │环形│  余额：¥xxx.xx   月消费：¥xxx.xx          │
│ │图  │  预警阈值：¥xx.xx（如设置）               │
│ └────┘                                         │
│                                  [编辑][删除]   │
├──────────────────────────────────────────────┤
│ [充值/消费] 按钮 + "查看流水"入口（复用 UsagePopover）│
└──────────────────────────────────────────────┘
```

- 环形图位于卡片左侧，`shrink-0`，与文字信息 `gap-3` 横向排列
- 低余额时（health = low/empty），卡片整体增加一条左侧色条提示：`border-l-2 border-l-[hsl(var(--warning))]`（empty 时用 `--destructive`），与"即将到期"提示在"订阅"Tab 的视觉语言呼应，但不重复渲染独立 banner（环形图已经是主要信号，避免视觉噪音）
- 底部操作区与现有 `UsagePopover` 触发按钮一致（`充值/消费`），新增一个"流水"文字链接/图标按钮，点开同一个 Popover 但默认定位到流水记录 Tab

---

### 4.5 Dashboard Tab（概览）

布局自上而下：

1. **`SubscriptionsStatsBar`**（原样保留，4 张统计卡：订阅中 / 月度订阅费 / 年度订阅费 / 本月待支付）
2. **新增"用量账户总览"卡片行** — `grid gap-3 sm:grid-cols-2 lg:grid-cols-3`，每个货币一张卡：
   ```
   rounded-lg border bg-card p-4 shadow-[var(--shadow-xs)]
   标题：text-xs font-semibold text-muted-foreground（"按量账户余额（CNY）"）
   数值：text-2xl font-black text-foreground
   副行：text-[11px] font-bold text-muted-foreground（"本月已消费 ¥xx.xx · N 个账户余额偏低"）
     - "N 个账户余额偏低" 仅在 N > 0 时显示，文字色为 --warning
   ```
3. **`SummaryBar`**（原样保留：即将到期 / 已到期 筛选 chip）——点击 chip 时**自动切换到"订阅"Tab** 并应用筛选（`onFilterChange` 内部同时调用 `onViewChange('subscriptions')`）

Dashboard 不渲染任何订阅/账户列表卡片，也不渲染"添加"按钮。

---

### 4.6 "订阅" Tab 卡片（SubscriptionCard 改造）

在现有 `SubscriptionCard` 基础上**新增** §4.2 的 `CycleProgressBar`，插入位置：到期/已过期提示 banner 之后、底部操作区之前。其余信息布局（名称/分类/状态徽标/价格行）保持不变。

```
现有结构
  └─ 标题行（名称 + 分类 chip + 状态徽标）
  └─ 计费信息行（价格 / 自动续费 / 到期日期）
  └─ [到期提示 banner]（条件渲染，现状已有）
  └─ ★ 新增：CycleProgressBar（条件渲染：monthly/yearly/one_time）
  └─ 底部操作区（编辑/删除/打开链接）
```

`lifetime` 类型：不渲染 `CycleProgressBar`，可选在计费信息行追加一个静态徽标"已购买 {N} 天"（`rounded-full border bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground`），强化"买断类账户也有时间维度"的一致性，但不做成进度条（买断没有"终点"）。

---

### 4.7 添加按钮（Add Button）

**桌面端**：保留右上角主按钮位置，但内容随当前 Tab 切换：

| 当前 Tab | 按钮文案 | 行为 |
|---|---|---|
| `dashboard` | （不渲染） | — |
| `subscriptions` | "添加订阅" | 打开表单，`billingType` 默认 `monthly` |
| `usage` | "添加用量账户" | 打开表单，`billingType` 默认 `per_token`，且表单仅展示按量相关字段（复用现有 `FIELD_VISIBILITY` 但跳过周期类字段的展示判断——表单本身字段集不变，只是默认类型变了） |
| `archived` | （不渲染） | — |

按钮样式不变（`nexus-button-primary gap-1.5 px-4 text-sm`），仅文案和 `onClick` 传入的初始 `billingType` 不同。`dashboard`/`archived` 下整个按钮节点不渲染（保留页面标题行的 flex 布局，右侧留空，不用 `invisible` 占位，允许标题区域占满宽度）。

**移动端**：现状是右上角一个 `h-10 w-10` 图标按钮（仅 `Plus` 图标，`aria-label="添加订阅"`）。改为：
- `dashboard`/`archived`：不渲染该按钮
- `subscriptions`：保留图标按钮，`aria-label="添加订阅"`
- `usage`：保留图标按钮，`aria-label="添加用量账户"`

不引入悬浮 FAB（项目内其他页面无 FAB 先例，保持一致性优先）。

---

## 5. Layout Principles

- **容器宽度**：沿用现状 `mx-auto max-w-5xl`（桌面），移动端 `p-4` 全宽
- **间距梯度**：`space-y-5`（页面级区块间距，桌面）/ `space-y-4`（移动），区块内 `gap-3`，沿用现状不变
- **网格**：
  - "订阅" Tab 列表：`grid gap-3 lg:grid-cols-2`（与现状一致）
  - "用量面板" Tab 列表：`grid gap-3 lg:grid-cols-2`（与"订阅"一致的双栏密度；账户数通常较少，双栏避免环形图被拉得过宽）
  - "已归档" Tab：单列或沿用原类型对应的卡片渲染（按 `billingType` 分流到 `SubscriptionCard` 或 `UsageAccountCard`，仅去掉进度条/环形图的强调色，统一用 §2 "已暂停（灰态）"）
  - Dashboard："用量账户总览"卡片行 `grid gap-3 sm:grid-cols-2 lg:grid-cols-3`（与 `SubscriptionsStatsBar` 同密度）

---

## 6. Depth & Elevation

不新增层级，沿用：
- 卡片：`shadow-[var(--shadow-xs)]`
- Popover/Dialog：`shadow-lg`
- 无新增 hover 提升阴影（避免列表滚动时的视觉跳动，符合"低噪音"基调）

---

## 7. Animation & Interaction（L1）

| 元素 | 动效 | 实现 |
|---|---|---|
| `CycleProgressBar` 填充 | 数据变化时宽度过渡 | `transition-[width] duration-300 ease-out` |
| `UsageRingChart` 进度弧 | 数据变化时弧长过渡 | `transition-[stroke-dashoffset] duration-500 ease-out` |
| Tab 切换 | 内容切换无转场动画（即时切换），仅 Tab 按钮本身 `transition-colors`（沿用现状） | — |
| 卡片 hover | 不新增 hover 提升效果；交互元素（按钮）维持现有 `nexus-button-*` hover 态 | — |
| 低余额/即将到期色条 | 无动画，静态展示 | — |

`prefers-reduced-motion`：上述均为 CSS `transition`，浏览器在 `prefers-reduced-motion: reduce` 下用户代理通常会抑制非必要过渡；本页面动效均为数值变化的渐变（非装饰性入场动画），无需额外降级代码。

---

## 8. Do's and Don'ts

**Do's**
1. 所有新颜色必须来自 §2 语义映射表，禁止新增 CSS 变量或硬编码 hex
2. 健康度判定（低余额/即将到期/已过期）必须通过 `subscriptions.shared.ts` 的共享函数计算，不在组件内重复判定逻辑
3. "用量面板"卡片的环形图始终在中心展示**余额绝对值**，不是百分比——百分比是辅助色彩信号，不是主信息
4. 进度条/环形图的轨道色统一用 `bg-muted` / `stroke="hsl(var(--muted))"`，保证未激活状态视觉一致
5. Tab 切换后保持滚动位置重置到顶部（`window.scrollTo` 或容器 `scrollTop = 0`），避免用户切到"用量面板"时停留在"订阅"列表的滚动位置
6. 移动端 4 个 Tab 允许横向滚动，但默认视口必须能看到全部 4 个文案（不省略文字）
7. "已归档"Tab 中两种卡片类型（订阅类/账户类）都要可识别——可在卡片标题行追加一个 `billingType` 对应的小图标或文案后缀
8. 空状态文案按 Tab 区分："暂无订阅记录" / "暂无用量账户" / "暂无已归档项"

**Don'ts**
1. 不要在"订阅"Tab 卡片里保留旧的 `PerTokenInfo` 分支——按量类型在该 Tab 不应出现
2. 不要给环形图加百分比数字作为主要展示（容易和"用量限额"概念混淆，本页面没有 `usageLimit` 强制要求）
3. 不要用红/橙色作为"订阅"Tab 默认态颜色——颜色仅在 warning/destructive 健康度下出现
4. 不要在 Dashboard Tab 渲染任何"添加"按钮或单条记录的操作按钮（编辑/删除）
5. 不要为 Tab 切换引入路由变化（仍是页面内 state，保持现状的 `useState` 模式，不接入 React Router 子路由）
6. 不要给"已归档"Tab 的卡片应用 §2 的 warning/destructive 强调色——统一灰态，避免用户误以为归档项仍需处理
7. 不要新增图表依赖（recharts/chart.js 等）——环形图用纯 SVG 自实现即可，避免增加 bundle 体积
8. 不要让"添加"按钮在 `usage` Tab 打开的表单暴露周期性字段（到期日期/自动续费等）——`billingType=per_token` 默认值已通过现有 `FIELD_VISIBILITY` 隐藏，不要新增特殊表单变体

---

## 9. Responsive Behavior

| 断点 | 行为 |
|---|---|
| Desktop (`md:` 及以上，沿用现状 `≥768px`) | `SubscriptionsDesktopView` 渲染；"订阅"/"用量面板"列表均为 `lg:grid-cols-2` 双栏；标题行右侧显示文字版"添加订阅/添加用量账户"按钮 |
| Mobile (`<768px`) | `SubscriptionsMobileView` 渲染；列表单栏 `space-y-3`；Tab 容器 `overflow-x-auto`；添加按钮为 `h-10 w-10` 图标按钮 |
| 环形图尺寸 | 桌面 56px / 移动 48px（见 §4.3），保证 `UsageAccountCard` 在移动端单栏下不过宽 |
| 触摸目标 | 所有新增可点击元素（Tab、添加按钮、环形图所在卡片若整体可点）≥ 44×44px，沿用现有 `h-9`/`h-10` 规格已满足 |
| 横向溢出 | 4 Tab 容器在 320px 宽度下用 `overflow-x-auto` 防止溢出；进度条/环形图均为 `w-full`/固定 px，不会导致卡片溢出 |

---

## 10. 不适用章节说明

本设计为现有内部工具页面的信息架构调整，以下 web-design 模板章节不适用，特此说明：
- **Hero / 首屏爆点 / 巧思设计点**：本页面无 Landing Page 性质
- **Motion Library / Signature Moments（L2/L3）**：交互档位为 L1，已在第 7 节给出全部动效
- **Scroll-story / WebGL / 3D**：不适用
- **i18n**：项目当前为单语言中文界面，不新增语言切换
