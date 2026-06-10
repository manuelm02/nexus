# Nexus Frontend Design System

> Version: 2026-06-10  
> Scope: Nexus 前台 Web / PWA / Telegram Mini App 统一视觉重构  
> Confirmed direction: Quiet Knowledge OS / Navy Mono / L1

## 1. Visual Theme & Atmosphere

Nexus 是个人 AI 工作台 / Knowledge OS，界面应像一个长期使用的私人控制台：安静、清晰、可信、低干扰。整体视觉以深蓝、白色、黑色为主，深蓝用于导航、主操作和强状态，白色用于主要工作面，黑色用于高对比标题和核心内容。

关键词：冷静、秩序、信息密度、长期使用、任务感、知识系统。

一句话定调：**像一个干净的私人 AI 工作台，而不是营销型 AI 官网。**

设计必须保留现有工具页的信息密度。以 ToDo 为例，快速创建、优先级、加入今日、今日/历史页签、今日/待分配/已过期分组、错误态、计数、状态流转和详情弹窗都必须保留，只重构视觉层级、颜色、间距和状态表达。

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

  --radius: 0.75rem;
  --shadow-soft: 0 18px 50px rgba(var(--primary-rgb), 0.08);
  --shadow-row: 0 8px 24px rgba(var(--primary-rgb), 0.04);
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

Type scale:

| Token | Desktop | Mobile | Weight | Use |
|---|---:|---:|---:|---|
| `display` | 44px / 1.03 | 34px / 1.08 | 900 | 页面主标题，如 ToDo |
| `h1` | 32px / 1.15 | 28px / 1.18 | 850 | 复杂页面标题 |
| `h2` | 22px / 1.25 | 20px / 1.3 | 800 | 模块标题 |
| `section` | 18px / 1.35 | 17px / 1.4 | 800 | 列表分组标题 |
| `body` | 15px / 1.7 | 15px / 1.7 | 400-600 | 正文与表单 |
| `small` | 13px / 1.6 | 13px / 1.6 | 500 | 辅助信息 |
| `label` | 11px / 1.4 | 11px / 1.4 | 800 | eyebrow / metadata |

Rules:

- 中文正文行高不低于 1.7。
- 字距保持 `letter-spacing: 0`，仅 uppercase eyebrow 可使用 `0.08em-0.12em`。
- 页面标题不使用渐变文字、不加投影。
- 禁止使用衬线字体作为主 UI 字体。

## 4. Component Stylings

### Buttons

Primary button:

```css
.nexus-button-primary {
  border-radius: 999px;
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  min-height: 44px;
  font-weight: 800;
  transition: background-color 160ms ease, transform 160ms ease, box-shadow 160ms ease;
}
.nexus-button-primary:hover {
  background: hsl(var(--secondary));
  box-shadow: 0 10px 24px rgba(var(--primary-rgb), 0.14);
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

Utility button:

```css
.nexus-button-utility {
  border: 1px solid hsl(var(--border));
  border-radius: 10px;
  background: hsl(var(--card));
  color: hsl(var(--accent-foreground));
  min-height: 40px;
  transition: background-color 160ms ease, border-color 160ms ease, color 160ms ease;
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

### Inputs

```css
.nexus-input {
  border: 1px solid hsl(var(--input));
  border-radius: 12px;
  background: hsl(var(--card));
  color: hsl(var(--foreground));
  min-height: 44px;
  transition: border-color 160ms ease, box-shadow 160ms ease, background-color 160ms ease;
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

### Surfaces / Cards

```css
.nexus-surface {
  border: 1px solid hsl(var(--border));
  border-radius: 18px;
  background: hsl(var(--card));
  box-shadow: var(--shadow-soft);
}
.nexus-surface:hover {
  border-color: hsl(var(--input));
}
.nexus-surface:focus-within {
  border-color: hsl(var(--ring));
  box-shadow: 0 0 0 3px rgba(var(--ring-rgb), 0.12), var(--shadow-soft);
}
```

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
- User account area can expose Profile and Logout.
- Active nav item uses white background with navy text.
- Inactive nav item uses muted blue gray text and a subtle navy-hover surface.

### ToDo Specific Components

ToDo page must preserve full workflow density:

- Header metrics: show only `今日`, `待分配`, `过期`; do not show a date tile.
- Header metrics align to the page content container right edge and live in the same header grid as the title.
- Quick create stays directly under the title and remains the primary visual action.
- Priority buttons preserve low / medium / high semantic colors.
- `加入今日` remains part of quick create and pending rows.
- Optional due date appears only when needed.
- Sections remain `今日`, `待分配`, `已过期`; collapsible sections must keep count visible.
- Error rows use destructive soft background and remain full-width inside the section.

## 5. Layout Principles

Global app shell:

- Desktop: fixed left sidebar, scrollable main content.
- Mobile: bottom navigation with a More sheet; Settings and user account live inside the More sheet.
- Main content background uses `--background`; content surfaces use `--card`.

Container rules:

- Dense tool pages: `max-width: 1180px`, horizontal padding `24px-32px`.
- Focused forms / narrow pages: `max-width: 720px`.
- Page vertical rhythm: 20px between major blocks, 10px-12px inside dense lists.
- Fixed-format controls use stable heights: inputs 44-48px, icon buttons 40-44px, list rows min 48px.

ToDo layout:

- Header: two-column grid on desktop, title left and metrics right.
- Metrics must align to the same content container as the quick-create surface.
- Quick create: desktop grid `input / priority / add-today / submit`; mobile stacks cleanly.
- Section lists remain single-column, not card grids.

## 6. Depth & Elevation

Depth is restrained. Nexus should feel durable, not glossy.

```css
:root {
  --shadow-xs: 0 1px 2px rgba(var(--primary-rgb), 0.04);
  --shadow-sm: 0 8px 24px rgba(var(--primary-rgb), 0.04);
  --shadow-md: 0 18px 50px rgba(var(--primary-rgb), 0.08);
  --shadow-lg: 0 28px 80px rgba(var(--primary-rgb), 0.14);
}
```

Usage:

- `shadow-xs`: small controls only.
- `shadow-sm`: task rows and compact list items.
- `shadow-md`: primary work surfaces such as quick create.
- `shadow-lg`: modal dialogs only.

Do not use large colored glows, gradient orbs, bokeh blobs, or heavy glassmorphism.

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

1. Keep all tool-page information density intact.
2. Use deep navy for navigation, primary actions and active states.
3. Use white cards for editable work surfaces.
4. Keep page-specific actions inside their page workspace.
5. Make focus states visible on every interactive element.
6. Keep section counts visible even when collapsible content is closed.
7. Use semantic color only for priority, warning and error states.
8. Preserve readable Chinese typography with explicit Chinese font fallback.
9. Keep mobile touch targets at least 44px.

Don't:

1. Do not add a global `New Item` button.
2. Do not expose `Jobs/Tasks` as a top-level nav item; put it under Settings.
3. Do not simplify ToDo by removing quick create, tabs, counts, grouped sections or row actions.
4. Do not place decorative date tiles in header metrics.
5. Do not use gradient hero sections, orbs, bokeh backgrounds, or marketing-page composition.
6. Do not use dark mode as the whole app default; deep navy is for navigation and selected states.
7. Do not hardcode business colors in React components.
8. Do not use heavy scroll-driven motion or 3D effects in tool pages.
9. Do not nest cards inside decorative cards.
10. Do not let button text overflow or wrap awkwardly on mobile.

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
- More sheet includes Settings and user account. Tasks/Jogs remain inside Settings.
- ToDo header metrics become a 3-column compact row below title, or horizontal scroll if labels overflow.
- Quick create stacks: input, priority segmented buttons, add-today + submit.
- Task row actions may collapse into icon-only controls with accessible labels.
- No horizontal overflow at widths <= 600px.

Accessibility:

- Every interactive control must have hover and focus-visible states.
- Icon-only buttons must have `aria-label`.
- Color cannot be the only status signal; include labels such as `高`, `中`, `低`, `过期`.
- Dialogs must preserve Radix focus trapping and escape behavior.
