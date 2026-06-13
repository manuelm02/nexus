# Nexus Frontend Design System

> Version: 2026-06-12  
> Scope: Nexus 前台 Web / PWA / Telegram Mini App 统一视觉重构  
> Confirmed direction: Quiet Knowledge OS / Navy Mono / L1 / Compact Workbench

## 1. Visual Theme & Atmosphere

Nexus 是个人 AI 工作台 / Knowledge OS，定位为**紧凑型后台工具**，不是营销站、官网或展示型 SaaS 首页。界面应像一个长期使用的私人控制台：安静、清晰、紧凑、可扫描。

关键词：Compact、Workbench、Dense but readable、Low noise、Stable controls、Clear hierarchy、后台工具感。

一句话定调：**像一个干净的私人 AI 工作台，而不是营销型 AI 官网。**

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

```css
:root {
  /* Core surfaces */
  --background: 214 33% 97%;
  --background-rgb: 246 248 251;
  --foreground: 221 61% 5%;
  --foreground-rgb: 7 11 18;

  --card: 0 0% 100%;
  --card-rgb: 255 255 255;
  --card-foreground: 221 61% 5%;
  --card-foreground-rgb: 7 11 18;

  --popover: 0 0% 100%;
  --popover-rgb: 255 255 255;
  --popover-foreground: 221 61% 5%;
  --popover-foreground-rgb: 7 11 18;

  /* Brand navy */
  --primary: 215 65% 12%;
  --primary-rgb: 11 29 51;
  --primary-foreground: 0 0% 100%;
  --primary-foreground-rgb: 255 255 255;

  --secondary: 213 58% 15%;
  --secondary-rgb: 16 36 61;
  --secondary-foreground: 214 45% 93%;
  --secondary-foreground-rgb: 220 232 248;

  /* Neutral structure */
  --muted: 214 35% 94%;
  --muted-rgb: 238 243 249;
  --muted-foreground: 213 20% 41%;
  --muted-foreground-rgb: 83 101 123;

  --accent: 214 35% 94%;
  --accent-rgb: 238 243 249;
  --accent-foreground: 218 35% 15%;
  --accent-foreground-rgb: 24 34 52;

  --border: 214 34% 90%;
  --border-rgb: 220 227 238;
  --input: 215 32% 84%;
  --input-rgb: 203 213 227;
  --ring: 212 45% 45%;
  --ring-rgb: 63 110 165;

  /* Semantic states */
  --success: 159 60% 24%;
  --success-rgb: 22 98 75;
  --success-soft: 150 55% 96%;
  --success-soft-rgb: 239 250 246;

  --warning: 39 74% 33%;
  --warning-rgb: 147 101 22;
  --warning-soft: 43 100% 96%;
  --warning-soft-rgb: 255 249 234;

  --destructive: 355 67% 42%;
  --destructive-rgb: 180 35 47;
  --destructive-foreground: 0 0% 100%;
  --destructive-foreground-rgb: 255 255 255;
  --destructive-soft: 0 100% 98%;
  --destructive-soft-rgb: 255 247 247;

  --radius: 0.625rem;
}
```

Primary roles:

- Deep navy: sidebar, selected tabs, primary actions, active task status.
- White: cards, form surfaces, popovers, dialogs.
- Near black: page titles and primary text.
- Muted blue gray: helper text, section metadata, inactive navigation.
- Success / warning / destructive: priority and error states only. Do not use them as decoration.

## 3. Typography Rules

Nexus 默认中文界面，必须显式配置中文字体，不能只依赖英文字体回退。

```css
@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Noto+Sans+SC:wght@400;500;600;700;800;900&display=swap");

:root {
  --font-sans: "Noto Sans SC", Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-mono: "SFMono-Regular", "Cascadia Code", "Roboto Mono", monospace;
}
```

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
- 字距保持 `letter-spacing: 0`，仅 uppercase eyebrow 可使用 `0.08em-0.12em`。
- 页面标题不使用渐变文字、不加投影。
- 禁止使用衬线字体作为主 UI 字体。

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

### Tabs

Tabs use a white container with a deep navy selected state. They must remain full-width on mobile and compact but scannable on desktop.

States:

- Default: white background, navy text.
- Hover: muted background.
- Active: navy background, white text.
- Focus: visible ring.
- Disabled: 48% opacity.

### Navigation

Desktop navigation is a deep navy sidebar. The primary nav shows functional modules only: Chat, ToDo, Inbox, Translate, Subscriptions, Mindbank, Crawl, Coding Practice if retained. System entries are restricted to Settings and user account.

Rules:

- `Jobs/Tasks` must move under Settings and must not appear as a top-level external nav item.
- Do not add global `New Item`; creation actions belong inside each page.

## 10. Module Addendum — Sidebar / Settings / Translate Refresh

### 侧边栏（Compact）

桌面侧边栏导航项：
- 高度：36px-40px
- 圆角：8px
- 图标：16px
- 字号：14px
- 内边距：10px-12px

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

- Header metrics: show `今日`, `未来`, `已过期`, `任务`; if one metric uses semantic color, all metrics must use a consistent tone system.
- Header metrics align to the page content container right edge and live in the same header grid as the title.
- Quick create stays directly under the title and remains the primary visual action.
- Priority buttons preserve low / medium / high semantic colors.
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
2. 使用深蓝作为导航、主操作和激活状态的色调。
3. 使用白色卡片作为可编辑工作面。
4. 将页面专属操作保留在其页面工作区内。
5. 为每个可交互元素提供可见的 focus 状态。
6. 即使可折叠内容关闭，也要保持 section 计数可见。
7. 仅在优先级、警告和错误状态上使用语义色。
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
6. 不要将暗色模式作为整个应用默认；深蓝用于导航和选中状态。
7. 不要在 React 组件中硬编码业务颜色。
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
