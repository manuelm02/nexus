# Nexus Frontend Design System

> Version: 2026-06-25  
> Scope: Nexus 前台 Web / PWA / Telegram Mini App 统一视觉重构  
> Confirmed direction: **Warm Studio → Apple/Notion** — 暖纸 + 蓝色主色调 / 无衬线 Inter Tight 标题 / 单 accent + 中性灰 / Apple 风分段控件 / L1 / Compact Workbench  
> 重构方案: `docs/plans/2026-06-25-warm-studio-ui-redesign.md`

> **2026-06-25 基调变更**：本设计系统从旧的 "Navy Mono / 深色侧栏 / 全 sans" 切换为 **Warm Studio**。
> 变更面：配色（深海军蓝 → 暖纸浅色 + 墨水蓝 accent）、侧栏（深色 → 浅暖灰）、字体（全 sans → 标题 serif + 数据 mono）、语义色（散落绿黄红 → 单 accent + 中性灰）、新增统一外壳组件与章节式页眉 Signature。
> **不变面**：紧凑工作台定位、信息密度、按钮/输入/列表尺寸体系、间距、动效 L1、移动端规范全部继续有效。下文凡涉及具体颜色值/深色侧栏/serif 禁令的旧描述，以本次更新后的章节为准。

## 1. Visual Theme & Atmosphere

Nexus 是个人 AI 工作台 / Knowledge OS，定位为**紧凑型知识工作台**，不是营销站、官网或展示型 SaaS 首页。界面应像一间布置得当的私人书房 / 一本装订好的个人笔记本：**温暖、安静、有秩序、随手可达**，同时保持长期使用工具的信息密度与克制。

关键词：Warm、Studio、Quiet、Compact、Workbench、Dense but readable、Low noise、Clear hierarchy。

一句话定调：**像一间温暖有序的个人知识工作室，而不是冰冷的 B2B 后台或营销型 AI 官网。**

核心张力：**暖色纸张底 + 冷调钢笔墨水 accent**（像在米色笔记本上用蓝黑钢笔书写）。刻意避开当前 AI 设计的三个默认套路：奶油底+赤陶 accent、近黑底+荧光 accent、报纸式 0 圆角。

设计必须保留现有工具页的信息密度。以 ToDo 为例，快速创建、优先级、加入今日、今日/历史页签、今日/待分配/已过期分组、错误态、计数、状态流转和详情弹窗都必须保留，只重构视觉层级、颜色、间距和状态表达。

**强制禁止项**：
- 大按钮作为默认尺寸
- 普通按钮默认 rounded-full（仅允许小型 chip/badge/头像使用）
- 普通 surface 默认 rounded-[18px]
- 普通卡片默认 p-6 或 p-8
- 工具页标题默认 text-4xl
- 列表操作按钮使用大号 primary button
- 卡片套卡片
- 大面积重阴影
- 营销型 hero 布局

## 2. Color Palette & Roles

所有颜色必须通过 CSS variables 使用。React/Tailwind 代码中不得直接写业务颜色 hex；需要新增颜色时先扩展变量。

Warm Studio 调色板（完整换算见 `docs/plans/2026-06-25-warm-studio-ui-redesign.md` §3.1）：

```css
:root {
  /* Core surfaces — Warm paper */
  --background: 60 17% 98%;            --background-rgb: 250 250 248;   /* #FAFAF8 paper */
  --foreground: 40 7% 10%;             --foreground-rgb: 28 27 25;      /* #1C1B19 ink  */
  --card: 0 0% 100%;                   --card-rgb: 255 255 255;
  --card-foreground: 40 7% 10%;        --card-foreground-rgb: 28 27 25;
  --popover: 0 0% 100%;                --popover-rgb: 255 255 255;
  --popover-foreground: 40 7% 10%;     --popover-foreground-rgb: 28 27 25;

  /* Sidebar — light warm (侧栏不再用 primary 深色) */
  --sidebar: 48 17% 94%;               --sidebar-rgb: 243 242 238;      /* #F3F2EE */
  --sidebar-foreground: 40 7% 10%;     --sidebar-foreground-rgb: 28 27 25;
  --sidebar-muted: 40 7% 45%;          --sidebar-muted-rgb: 122 118 109;
  --sidebar-hover: 45 18% 91%;         --sidebar-hover-rgb: 236 234 227;

  /* Brand — Pen ink blue (primary 现在是墨水蓝) */
  --primary: 226 65% 48%;              --primary-rgb: 43 80 200;        /* #2B50C8 */
  --primary-foreground: 0 0% 100%;     --primary-foreground-rgb: 255 255 255;
  --secondary: 226 68% 37%;            --secondary-rgb: 30 61 160;      /* #1E3DA0 hover/press */
  --secondary-foreground: 0 0% 100%;   --secondary-foreground-rgb: 255 255 255;

  /* Neutral structure — warm grays */
  --muted: 45 20% 93%;                 --muted-rgb: 240 238 231;
  --muted-foreground: 40 7% 51%;       --muted-foreground-rgb: 138 134 124;  /* #8A867C */
  --accent: 45 22% 93%;                --accent-rgb: 241 239 233;       /* hover surface */
  --accent-foreground: 40 7% 10%;      --accent-foreground-rgb: 28 27 25;
  --accent-soft: 226 67% 95%;          --accent-soft-rgb: 234 238 251;  /* #EAEEFB active tint */

  --border: 43 19% 88%;                --border-rgb: 231 228 220;       /* #E7E4DC hairline */
  --input: 43 16% 83%;                 --input-rgb: 218 214 204;
  --ring: 226 65% 48%;                 --ring-rgb: 43 80 200;

  /* Semantic states — restrained, real status only */
  --success: 162 72% 24%;              --success-rgb: 22 98 75;
  --success-soft: 150 40% 95%;         --success-soft-rgb: 239 247 243;
  --warning: 39 74% 33%;               --warning-rgb: 147 101 22;
  --warning-soft: 43 60% 95%;          --warning-soft-rgb: 251 246 234;
  --destructive: 355 67% 42%;          --destructive-rgb: 180 35 48;
  --destructive-foreground: 0 0% 100%; --destructive-foreground-rgb: 255 255 255;
  --destructive-soft: 0 60% 97%;       --destructive-soft-rgb: 252 245 245;

  /* Shape & depth */
  --radius: 0.5rem;                    /* 8px 控件默认 */
  --shadow-rgb: 28 27 25;              /* 暖中性阴影基色，避免随 primary 变蓝发蓝 */
}
```

Primary roles：

- **暖纸 paper（#FAFAF8）**：内容区底。
- **浅暖灰 sidebar（#F3F2EE）**：侧栏底；active nav 用 `card` 白底 + 墨水蓝字 + 左侧 accent 书脊。
- **墨水蓝 accent（#2B50C8）**：主按钮、选中 tab、active 状态、链接、focus ring；hover/press 用 `--secondary`（#1E3DA0）。
- **白 card**：卡片、表单工作面、popover、dialog。
- **暖近黑 ink（#1C1B19）**：页面标题与主文字。
- **暖灰 muted（#8A867C）**：辅助文字、section metadata、eyebrow、inactive 导航。
- **Success / warning / destructive**：仅真实状态（错误、删除、到期、可用），不作装饰，**不用于优先级**。优先级用中性底 + accent 深浅/小圆点表达。

## 3. Typography Rules

Nexus 默认中文界面，必须显式配置中文字体，不能只依赖英文字体回退。Warm Studio 采用**三角色字体系统**：serif 标题 + sans 正文 + mono 数据。

```css
@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Inter+Tight:wght@500;600;700;800&family=Noto+Sans+SC:wght@400;500;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap");

:root {
  --font-display: "Inter Tight", "Noto Sans SC", Inter, -apple-system, sans-serif;
  --font-sans:  "Noto Sans SC", Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-mono:  "JetBrains Mono", "SFMono-Regular", "Cascadia Code", monospace;
}
```

| 角色 | 字体 | 用途 |
|---|---|---|
| Display 标题 | Inter Tight | 页面标题（PageHeader title）、section opener。无衬线、`font-bold` + `tracking-tight`，Apple/Notion 干净现代气质。 |
| Sans 正文/UI | Noto Sans SC + Inter | 正文、表单、按钮、导航、绝大多数 UI。CJK 必需。 |
| Mono 数据 | JetBrains Mono | API Key、金额、文件路径、代码、PageHeader 的 eyebrow 眉标。内容本身需要等宽，非装饰。 |

Type scale（compact 标准）：

| Token | Desktop | Mobile | Weight | Use |
|---:|---:|---:|---:|---|
| `page-h1` | 24px-28px / 1.2 | 24px / 1.25 | 800 | 工具页标题 |
| `section-h2` | 18px / 1.35 | 17px / 1.4 | 750-800 | 区块标题 |
| `card-title` | 14px-15px / 1.4 | 14px / 1.4 | 700-750 | 卡片标题 |
| `body` | 14px-15px / 1.65 | 15px / 1.7 | 400-500 | 正文与表单 |
| `small` | 12px-13px / 1.5 | 12px-13px / 1.5 | 500-650 | 辅助信息 |
| `label` | 11px-12px / 1.4 | 11px-12px / 1.4 | 700-800 | eyebrow / metadata |

`44px display` 只能用于极少数首页或空态，不适合作为工具页默认标题。

Rules:

- 中文正文行高不低于 1.7。
- 字距保持 `letter-spacing: 0`；uppercase mono eyebrow 用 `0.16em-0.18em`；display 标题用 `tracking-tight`（Apple 风紧排）。
- 页面标题用 `--font-display`（Inter Tight），`font-bold`，不使用渐变文字、不加投影。
- eyebrow 眉标、API Key、金额、文件路径、代码用 `--font-mono`。

> **2026-06-26 字体方向调整（Apple/Notion）**：标题从 Source Serif 4 衬线改为 **Inter Tight 无衬线**（`--font-display`），与正文同属无衬线家族，追求 Apple/Notion 的干净现代气质。`--font-serif` 已移除。

## 4. Component Stylings

### 按钮尺寸体系

按钮必须按用途选尺寸，不允许所有按钮都用大号。

| Token | Height | Padding H | Font | Use |
|---:|---:|---:|---:|---|
| `xs` | 28px | 8px-10px | 12px / 700 | 表格行内、卡片行内小动作 |
| `sm` | 32px | 10px-12px | 13px / 700 | 次级操作、筛选、工具条 |
| `md` | 36px | 14px-16px | 14px / 750 | 默认按钮 |
| `lg` | 40px | 16px-18px | 14px / 800 | 页面主动作 |
| `touch` | 44px | 16px-18px | 14px / 800 | 移动端关键动作 |

`44px` 不是桌面端默认按钮高度，只能用于：
- 移动端主操作
- 登录/注册等少数独立表单主按钮
- 需要明显触控目标的底部 action bar

### 按钮形状

默认圆角：
- 普通按钮：`8px`（rounded-lg）
- 图标按钮：`8px`
- segmented/chip/小型筛选：`999px` 可用，但只用于小尺寸 chip
- 页面主 CTA 不默认使用 `999px`

### 按钮层级

每个页面最多一个视觉主按钮。
- Primary：页面主提交或主要生成动作
- Secondary：常规次级动作
- Ghost：列表行内操作、工具栏轻动作
- Destructive：删除、退出，仅在 hover/focus 或确认状态强化

Primary button 不应到处出现。列表卡片里的编辑、删除、设为默认等操作默认用 secondary / ghost。

### Primary button（响应式）

```css
.nexus-button-primary {
  /* desktop: 36px / mobile: 44px */
  min-height: 44px;
  border-radius: 8px;
  padding: 0 14px;
  font-size: 14px;
  font-weight: 750;
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  transition: background-color 160ms ease, transform 160ms ease, box-shadow 160ms ease;
}
@media (min-width: 768px) {
  .nexus-button-primary {
    min-height: 36px;
  }
}
.nexus-button-primary:hover {
  background: hsl(var(--secondary));
  box-shadow: 0 4px 12px rgba(var(--primary-rgb), 0.1);
}
.nexus-button-primary:active {
  transform: translateY(1px);
  box-shadow: none;
}
.nexus-button-primary:focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
}
.nexus-button-primary:disabled {
  opacity: 0.48;
  cursor: not-allowed;
  box-shadow: none;
}
```

### Utility button（响应式）

```css
.nexus-button-utility {
  /* desktop: 32px / mobile: 40px */
  min-height: 40px;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  background: hsl(var(--card));
  color: hsl(var(--accent-foreground));
  font-size: 13px;
  font-weight: 700;
  transition: background-color 160ms ease, border-color 160ms ease, color 160ms ease;
}
@media (min-width: 768px) {
  .nexus-button-utility {
    min-height: 32px;
  }
}
.nexus-button-utility:hover {
  background: hsl(var(--accent));
  border-color: hsl(var(--input));
}
.nexus-button-utility:active {
  background: hsl(var(--muted));
}
.nexus-button-utility:focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
}
.nexus-button-utility:disabled {
  opacity: 0.48;
  cursor: not-allowed;
}
```

### Inputs（响应式）

```css
.nexus-input {
  /* desktop: 36px / mobile: 44px */
  min-height: 44px;
  border: 1px solid hsl(var(--input));
  border-radius: 8px;
  background: hsl(var(--card));
  color: hsl(var(--foreground));
  font-size: 14px;
  transition: border-color 160ms ease, box-shadow 160ms ease, background-color 160ms ease;
}
@media (min-width: 768px) {
  .nexus-input {
    min-height: 36px;
  }
}
.nexus-input::placeholder {
  color: rgba(var(--muted-foreground-rgb), 0.72);
}
.nexus-input:hover {
  border-color: hsl(var(--ring));
}
.nexus-input:focus {
  outline: none;
  border-color: hsl(var(--ring));
  box-shadow: 0 0 0 3px rgba(var(--ring-rgb), 0.16);
}
.nexus-input:disabled {
  background: hsl(var(--muted));
  opacity: 0.62;
  cursor: not-allowed;
}
```

桌面端输入框默认高度：
- 单行 input：36px-40px
- Select trigger：36px-40px
- Search：36px
- Textarea：按内容场景定义，不默认大块

输入框圆角统一 `8px`，搜索框可用小型 `999px`。

禁止所有 input 都 `min-height: 44px`（桌面端）、禁止搜索框像移动端大输入框一样占据过多高度。

### Surfaces / Cards（响应式）

```css
.nexus-surface {
  /* desktop: 12px / mobile: 18px 圆角 */
  border-radius: 18px;
  border: 1px solid hsl(var(--border));
  background: hsl(var(--card));
  box-shadow: var(--shadow-sm);
}
@media (min-width: 768px) {
  .nexus-surface {
    border-radius: 12px;
  }
}
.nexus-surface:hover {
  border-color: hsl(var(--input));
}
.nexus-surface:focus-within {
  border-color: hsl(var(--ring));
  box-shadow: 0 0 0 3px rgba(var(--ring-rgb), 0.12), var(--shadow-sm);
}
```

默认 padding：
- 紧凑列表卡片：10px-12px
- 普通工具卡片：14px-16px
- 复杂表单面板：16px
- 移动端卡片：14px-16px

默认圆角：
- 页面主 surface：10px-12px（desktop），12px-18px（mobile）
- 列表卡片：8px-10px
- 弹窗：12px
- 小 badge/chip：999px

`18px` 不作为默认 surface 圆角，只能用于少数大面积聚合面板。

禁止默认 `p-6`/`p-8`、禁止为每个子区域再套一层卡片、禁止卡片套卡片。

### Shell Components（统一外壳，统一性根治）

所有页面必须消费 `src/components/shell/` 的共享外壳，禁止再手写 header / tab / 空态。详见 `docs/plans/2026-06-25-warm-studio-ui-redesign.md` §4。

- **`<PageHeader>` — Signature 章节页眉**：`mono 眉标 + 3px accent 书脊 + display 大标题 + muted 副标题`。全站唯一记忆点。`<header>` 中：eyebrow 用 mono uppercase `tracking-[0.18em] text-muted-foreground`，标题用 `font-display text-[22px] md:text-[28px] font-bold tracking-tight`，标题前置 `h-6 w-[3px] rounded-full bg-primary` 书脊。
- **`<Tabs>` — Apple 风分段控件**：segmented 用灰底轨道（`bg-muted p-1`）+ **白色选中滑块**（`bg-card` + `shadow-xs` + `font-semibold`），不用实心蓝填充——accent 留给主操作/链接，保持 Apple/Notion 的克制。underline 变体用于多 tab。
- **`<PageShell variant>`**：3 种布局模板覆盖全站 —— `full`（全宽单列：ToDo/Translate/Panel Hub/Settings/Profile/Coding Practice）、`list-detail`（左列表+右详情：Chat/Notes）、`with-panel`（主内容+右辅助面板：Inbox/Crawl/Mindbank）。桌面统一 `max-w-[1180px]`（密集双栏可 1280）+ `p-6` + `gap-4`，移动端一律塌成单列。
- **`<Tabs>`**：唯一 tab 实现，`segmented`（白底容器 + active 墨水蓝填充）/ `underline`（多 tab，active accent 下划线）。支持 `count`。
- **`<EmptyState>`**：唯一空状态（icon/title/hint/action），文案动词开头、是行动邀请。
- **`<SectionCard>`**：统一卡片容器，禁止卡片套卡片。

### Tabs

Apple 风分段控件：灰底轨道 + 白色选中滑块（不用实心蓝填充）。桌面紧凑可扫描，移动端全宽。

States（segmented）：

- Track: `bg-muted`（暖灰轨道）, `p-1`, `rounded-lg`。
- Default segment: `text-muted-foreground`, `font-medium`。
- Hover: `text-foreground`。
- Active segment: `bg-card`（白滑块）+ `shadow-xs` + `text-foreground font-semibold`。accent 不用于 tab 填充。
- Count 徽标: active `bg-primary/10 text-primary`，inactive `bg-foreground/5 text-muted-foreground`。
- Focus: visible ring；Disabled: 48% opacity。

underline 变体用于多 tab（如 Panel Hub）：active = `text-foreground` + `bg-primary` 下划线，inactive = muted。

### Navigation

桌面导航是**浅暖灰侧栏**（`bg-sidebar` #F3F2EE），不再是深海军蓝。主导航按四组呈现，每组上方一行 mono uppercase 组标题：

- **空间**：Chat、Notes、Mindbank
- **收集**：Inbox、Crawl
- **工具**：ToDo、Translate、Coding Practice
- **管理**：Panel Hub

nav item 状态：inactive = `text-sidebar-muted hover:bg-sidebar-hover`；active = `bg-card text-primary font-semibold` + 左侧 `2px` accent 书脊（呼应 Signature）。系统入口仅 Settings 和账户胶囊。

Rules:

- `Jobs/Tasks` must move under Settings and must not appear as a top-level external nav item.
- Do not add global `New Item`; creation actions belong inside each page.

## 10. Module Addendum — Sidebar / Settings / Translate Refresh

### 侧边栏（Compact，Warm Studio 浅色）

侧栏底色用 `bg-sidebar`（#F3F2EE），不再用 `bg-primary` 深色。按"空间/收集/工具/管理"四组渲染，组标题用 mono uppercase `text-[10px] tracking-[0.16em] text-sidebar-muted`。

桌面侧边栏导航项：
- 高度：36px-40px
- 圆角：8px
- 图标：16px
- 字号：14px
- 内边距：10px-12px
- inactive：`text-sidebar-muted hover:bg-sidebar-hover hover:text-foreground`
- active：`bg-card text-primary font-semibold` + 左侧 2px accent 书脊
- 品牌区与账户胶囊改白底深字，去掉 `bg-white/10` 等深色专用类

底部账户区：
- padding：10px-12px
- 内部按钮高度：32px-36px
- 头像：28px-32px

### Sidebar Account Capsule

Desktop sidebar bottom area must be treated as a single account module rather than three unrelated actions.

- The bottom section becomes an `account capsule` with one shared container.
- Row 1 shows avatar, display name, and a small workspace identity label.
- Clicking the identity row enters `Profile`.
- Row 2 contains exactly two actions: `Settings` and `退出登录`.
- `Settings` uses a quiet utility-button treatment.
- `退出登录` keeps a low-noise default state and only strengthens destructive affordance on hover/focus.
- The former three-part stack of `Settings / Profile / Logout` must not return.

### Settings as Model Workspace

Settings should feel like a configuration workspace, not a basic form page.

- The page should prioritize model management over generic tabs.
- The primary reading order is:
  1. Page intro
  2. Default model panel
  3. Provider list panel
  4. Workflow override panel
  5. Secondary system settings panel
- `LLM 配置 / 系统参数` top tabs are discouraged for this page revision.
- A default model is mandatory and must be visually presented as a unique global fallback.
- Provider cards must expose status and key actions inline: edit, set default, delete, enabled state.
- Workflow override must currently foreground `Translate`, with `继承全局默认` as the baseline choice.

### Translate Compact Workbench

Translate should feel like a dense daily-use tool, not a large-form playground.

- Desktop reading flow remains vertical: composer, result, history.
- Source input starts at two visible rows and auto-grows with content.
- Manual textarea resize handles should remain disabled to avoid layout instability.
- Toolbar priority is `target language -> style -> translate action`.
- History controls should live inside one compact utility bar (36px-40px height).
- History cards must show only necessary information:
  - source summary
  - translated summary
  - timestamp
  - target language
  - style
  - delete affordance
- Desktop delete action should stay visually quiet until hover/focus.
- Mobile may keep delete affordance visible by default.
- 桌面端所有控件高度收敛：select 36px-40px，style chip 32px，translate button 36px。

### Responsive Behavior for This Refresh

- Desktop and mobile share the same route and business state.
- Settings desktop may use richer sectional grouping, but mobile must collapse into one-column stacked cards.
- Translate desktop keeps a compact toolbar row; mobile may split toolbar controls into two rows while preserving the same action order.
- Sidebar account capsule rules apply to desktop sidebar; mobile navigation should not duplicate logout in multiple competing places.
- User account area can expose Profile and Logout.
- Active nav item uses white background with navy text.
- Inactive nav item uses muted blue gray text and a subtle navy-hover surface.

### ToDo Specific Components

ToDo page must preserve full workflow density:

- Header metrics: show `今日`, `未来`, `已过期`, `任务`; metrics 使用统一中性 tone（不再四块各用绿/黄/红），仅 `已过期` 等真实预警可带克制语义底。
- Header metrics align to the page content container right edge and live in the same header grid as the title.
- Quick create stays directly under the title and remains the primary visual action.
- Priority（低/中/高）**收敛为中性底 + accent 深浅 / 小圆点**表达，不再三色并列。颜色非唯一信号，保留文字标签。
- Quick create uses a plan-date picker rather than an `加入今日` toggle; leaving the date empty creates a task.
- `任务` is the user-facing name for unscheduled ToDo items; avoid showing `待分配` in primary UI copy.
- Sections are organized as `ToDo List / 任务 / 历史`, where `ToDo List` contains `今日`, `未来`, `已过期`.
- Collapsible sections must keep count visible.
- Error rows use destructive soft background and remain full-width inside the section.

### Date Picker Standard

Nexus date controls must feel like first-party Nexus components, not browser defaults.

- Use the shared `TodoDatePicker` interaction pattern for ToDo plan and due dates: Nexus trigger, Radix Popover, custom calendar grid, integrated clear action, and `今天` shortcut.
- Do not expose native `input[type=date]` as the visible UI on product surfaces.
- Clear actions belong inside the date component; never place a detached X button between a date control and a submit button.
- Empty date placeholders should be product-grade copy such as `未安排计划日期` or `暂无截止日期`, not explanatory phrases like `空表示...`.
- Date popovers use `rounded-lg`, project border tokens, `bg-popover`, `shadow-lg`, and the same focus-visible ring as Select/Popover menus.
- All ToDo date entry points must reuse the same date picker component: quick create, task cards, detail planned date, and detail due date.

## 5. Layout Principles

Global app shell:

- Desktop: fixed left sidebar, scrollable main content.
- Mobile: bottom navigation with a More sheet; Settings and user account live inside the More sheet.
- Main content background uses `--background`; content surfaces use `--card`.

Container rules（compact）：

- Dense tool pages: `max-width: 1120px-1180px`, horizontal padding `24px`.
- Focused forms / narrow pages: `max-width: 680px`.
- Page block gap: `16px`（禁止默认 space-y-8）。
- Dense list gap: `8px-10px`.
- Form field gap: `10px-12px`.
- Fixed-format controls use stable heights: desktop inputs 36px-40px, icon buttons 32px, list rows 44px-56px.

ToDo layout:

- Header: two-column grid on desktop, title left and metrics right.
- Metrics must align to the same content container as the quick-create surface.
- Quick create: desktop grid `input / priority / plan-date / submit`; mobile defaults to a compact input + submit row and reveals priority/date controls only when needed.
- Section lists remain single-column, not card grids.

## 6. Depth & Elevation

Depth is restrained. Nexus should feel durable, not glossy.

```css
:root {
  --shadow-xs: 0 1px 2px rgba(var(--primary-rgb), 0.04);
  --shadow-sm: 0 4px 12px rgba(var(--primary-rgb), 0.04);
  --shadow-md: 0 8px 24px rgba(var(--primary-rgb), 0.06);
  --shadow-lg: 0 18px 50px rgba(var(--primary-rgb), 0.12);
}
```

Usage:

- `shadow-xs`: small controls only.
- `shadow-sm`: card surfaces and rows（nexus-surface 默认）。
- `shadow-md`: primary work surfaces such as quick create（少数大面积面板）。
- `shadow-lg`: modal dialogs only.

Do not use large colored glows, gradient orbs, bokeh blobs, or heavy glassmorphism. 大面积重阴影禁止作为默认。

## 7. Animation & Interaction

Interaction level: **L1 精致静态**.

No GSAP, Lenis, ScrollTrigger, custom cursor, or WebGL for the app shell and tool pages. Motion is limited to hover, focus, active, dialog entrance, collapsible rotation, and subtle page entry.

```css
@keyframes nexus-fade-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.nexus-page-enter {
  animation: nexus-fade-in 220ms ease-out both;
}

.nexus-collapsible-icon {
  transition: transform 160ms ease;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 1ms !important;
  }
}
```

Rules:

- Hover states must not move layout.
- Row hover may change background or border only.
- Primary button active state may move 1px down.
- In-progress status can keep the existing small pulse, but it must stop under `prefers-reduced-motion`.

## 8. Do's and Don'ts

Do:

1. 保持所有工具页信息密度完整。
2. 使用墨水蓝 accent 作为主操作、激活状态和链接的色调；侧栏用浅暖灰底。
3. 使用白色卡片作为可编辑工作面。
4. 将页面专属操作保留在其页面工作区内。
5. 为每个可交互元素提供可见的 focus 状态。
6. 即使可折叠内容关闭，也要保持 section 计数可见。
7. 仅在真实状态（错误、删除、到期、可用）上使用语义色；优先级用中性 + accent。
8. 页面标题用 serif，eyebrow/Key/金额/路径用 mono。
9. 每页页眉统一用 `<PageHeader>`，布局用 `<PageShell>` 三种 variant 之一。
8. 确保中文可读性，显式配置中文字体回退。
9. 移动端触控目标保持至少 44px。
10. 桌面端按钮默认 36px（primary）/ 32px（secondary）/ 32px（icon）。
11. 普通按钮圆角默认 8px（rounded-lg），仅 chip/badge/头像可用 rounded-full。
12. 表面圆角桌面端收敛到 10px-12px。
13. 每页最多一个明显 primary action，行内操作用 ghost/small/icon button。

Don't:

1. 不要添加全局 `New Item` 按钮。
2. 不要将 `Jobs/Tasks` 作为顶级导航项暴露；放在 Settings 下。
3. 不要通过移除快速创建、标签页、计数、分组区块或行操作来简化 ToDo。
4. 不要在 header metrics 中放置装饰性日期图块。
5. 不要使用渐变色 hero 区域、光球、bokeh 背景或营销页面布局。
6. 不要把侧栏做成深色大色块；侧栏用浅暖灰，墨水蓝只用于 accent/主操作/选中。
7. 不要在 React 组件中硬编码业务颜色。
15. 不要用 serif 作为正文或控件字体；不要散落使用绿/黄/红装饰优先级。
16. 不要再各页手写 header/tab/空态，必须用 `src/components/shell/` 共享外壳。
8. 不要在工具页中使用重度滚动驱动动效或 3D 效果。
9. 不要将卡片嵌套在装饰性卡片中。
10. 不要让按钮文案在移动端溢出或异常换行。
11. 不要将桌面端大按钮规则照搬到所有页面，不要所有按钮都用 pill。
12. 不要每个 surface 都用重阴影，禁止大面积 `box-shadow: 0 18px 50px ...`。
13. 不要使用 `space-y-8`、大面积 `p-8`、无理由 `p-6`、工具页标题 `text-4xl`。
14. 不要在产品界面裸露浏览器原生日期控件或风格不一致的日期弹层。

## 9. Responsive Behavior

Breakpoints:

- Mobile: `0-639px`
- Tablet: `640-1023px`
- Desktop: `1024px+`

Desktop:

- Sidebar visible and sticky.
- Main content scrolls independently.
- Tool pages use 1180px max container.
- ToDo header uses title left, metrics right.

Tablet:

- Sidebar can remain if width allows; otherwise bottom navigation.
- ToDo quick create can wrap into two rows.
- Metrics may move below title if the right column becomes cramped.

Mobile:

- Bottom navigation uses primary paths only; low-frequency entries go into More.
- More sheet includes Settings and user account. Tasks/Jobs remain inside Settings.
- ToDo header metrics become a compact responsive row below title.
- ToDo quick create defaults to input + submit; priority and date controls expand only when the user is composing.
- Task row actions may collapse into icon-only controls with accessible labels.
- No horizontal overflow at widths <= 600px.

Accessibility:

- Every interactive control must have hover and focus-visible states.
- Icon-only buttons must have `aria-label`.
- Color cannot be the only status signal; include labels such as `高`, `中`, `低`, `过期`.
- Dialogs must preserve Radix focus trapping and escape behavior.

## 11. Mobile UI Standards

Nexus 移动端是项目级设计标准，定义桌面端能力如何转换为手机可用界面。不是某个页面的实现细节，而是所有移动端页面的设计和验收规则。

核心原则：

- 同一路由，不新增 `/m/*`。
- 业务逻辑只写一套，移动端只拆视图和交互组件。
- 移动端不是桌面端缩放版。
- 触控舒适优先于桌面端紧凑密度。
- 关键操作必须可见或可触达，不能依赖 hover。
- 固定底部导航和底部操作条不得遮挡内容。

### 11.1 移动端基础尺寸

| 指标 | 值 |
|---|---|
| 页面水平 padding | 16px |
| 页面主区块间距 | 14px-16px |
| 紧凑列表间距 | 8px-10px |
| 卡片 padding | 14px-16px |
| 最小触控目标 | 44px |
| 视觉按钮高度 | 40px-44px |
| 图标按钮点击区域 | 44px |
| 图标尺寸 | 18px-20px |
| Input / Select 高度 | 40px-44px |
| Bottom nav / action bar | 56px-64px + safe-area inset |

### 11.2 移动端字体层级

| Token | 移动端 | 用途 |
|---|---|---|
| Page H1 | 22px-24px / 1.25 | 工具页标题 |
| Section title | 16px-17px / 1.35 | 页面分区 |
| Card title | 14px-15px / 1.4 | 卡片标题 |
| Body | 15px / 1.7 | 正文和表单内容 |
| Metadata | 12px-13px / 1.5 | 时间、状态、辅助信息 |
| Label / eyebrow | 11px-12px / 1.4 | 字段标签 |

禁止：移动工具页默认 `text-3xl`/`text-4xl`、标题区域占据首屏过多空间。

### 11.3 移动端按钮

- 主按钮视觉高度：40px-44px
- 次级按钮视觉高度：40px
- 图标按钮 hit area：44px
- 图标按钮必须有 `aria-label`
- 按钮文字必须短，不允许挤压、换行或溢出
- 底部 action bar 只放一个主动作，最多一个次动作
- 危险动作默认低噪声，确认态再强化

按钮选择：
- 页面主提交：primary
- 工具条动作：secondary / ghost
- 行内操作：icon / ghost
- 删除、退出：destructive ghost → 确认态 destructive fill

### 11.4 移动端导航

- Bottom nav 固定在底部，点击区域不小于 44px
- 当前页面状态必须清楚
- More sheet 承载 Settings、Profile、Logout、低频入口
- Bottom nav 和 action bar 必须处理 `safe-area inset`
- 主内容底部必须预留 padding，避免被 fixed nav 遮挡

禁止：
- 把桌面 sidebar 原样塞进移动端
- 在多个地方重复放 Logout
- Bottom nav 遮挡页面最后一条列表或表单按钮

### 11.5 移动端布局转换规则

桌面 → 移动端：
- 多列布局 → 单列布局
- Table → compact card list
- Modal/Dialog → bottom sheet
- Sidebar → bottom nav / More sheet
- Hover menu → visible action / tap menu
- Right detail pane → bottom sheet / inline collapsible detail
- Toolbar → 可折成两行，但同一组工具必须在同一个容器里
- Desktop card grid → mobile vertical list（除非每张卡信息极少）

当出现以下情况必须拆 `MobileView` 或移动端专用组件：
- table 变 card list
- modal 变 sheet
- sidebar 变 bottom nav / More sheet
- hover 操作变点击操作
- 桌面横向工具条变移动端分组工具条
- 布局顺序发生变化

### 11.6 移动端表单

- 字段纵向堆叠（不照搬桌面密集两列表单）
- label 与 input 间距：4px-6px
- 字段间距：10px-12px
- 表单分组间距：14px-16px
- Select / popover 选项高度不小于 44px
- 页面主提交可放入底部 action bar（必须处理 safe-area）
- 表单聚焦后关键按钮不能被键盘永久遮挡

### 11.7 移动端列表

| 类型 | 高度 |
|---|---|
| 紧凑列表项 | 56px-64px |
| 普通记录卡片 | 64px-76px |
| 展开态详情卡片 | 默认不超过 96px |
| 卡片间距 | 8px-10px |

内容规则：
- 只展示主标题、摘要、关键 metadata、必要动作
- 不把桌面所有列都塞进移动卡片
- 删除、复制、更多操作必须可触达
- 不依赖 hover 才能看到关键操作

### 11.8 移动端弹层

移动端优先使用 bottom sheet：
- Sheet 圆角：12px-16px
- 内容区可滚动
- Footer 固定时必须加 safe-area inset
- 关闭按钮 hit area：44px
- 不在 sheet 内部继续套多层卡片

Dialog 只用于真正短小、需要强确认的操作（如删除确认）。

### 11.9 移动端验收检查表

每次移动端 UI 改动必须检查：
- 375px 宽度无横向溢出
- 390px 宽度无按钮文字挤压
- 430px 宽度布局仍保持节奏
- 所有点击目标至少 44px
- Bottom nav / action bar 不遮挡内容
- 表单聚焦后关键按钮不被键盘永久遮挡
- Hover-only 操作在移动端有可触达替代方案
- 移动端页面没有桌面式大标题、大卡片、大留白
