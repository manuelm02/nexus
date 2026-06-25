# Nexus 前台 UI 重构方案 — Warm Studio

**Date:** 2026-06-25
**Scope:** Nexus 前台 Web / PWA / Telegram Mini App 全站视觉与结构重构
**Direction:** Warm Studio（暖纸 + 钢笔墨水）/ Serif 标题 / 单 accent + 中性灰
**Status:** 待执行（本文件为可直接落地的执行方案，配套 Prompt 见 `docs/prompts/2026-06-25-warm-studio-ui-redesign-deepseek.md`）

> 本方案取代 `DESIGN.md` 旧的 "Navy Mono / 深色侧栏" 基调。`DESIGN.md` 与 `docs/design-specs/2026-06-12-nexus-compact-ui-standards.md` 已同步更新，密度 / 按钮尺寸 / 移动端规范继续有效，仅颜色、字体、侧栏、语义色方向被本方案替换。

> **⚠️ 2026-06-26 方向微调（Apple/Notion）**：在 Warm Studio 基础上向 **Apple/Notion 干净现代**气质收敛，蓝色仍为主色调。下文 §2.3 / §2.5 中关于 **serif 标题（Source Serif 4）的描述已作废**，以 `DESIGN.md` 为准：
> - **标题字体**：Source Serif 4 衬线 → **Inter Tight 无衬线**（`--font-display`，`font-bold` + `tracking-tight`），与正文同属无衬线家族。
> - **Tabs**：实心蓝填充 → **Apple 风分段控件**（灰底轨道 + 白色选中滑块），accent 不用于 tab。
> - **Logo**：固定配色 PNG → **内联 SVG**（app-icon 圆角蓝块 + 白 N，读 `--primary` token 自动随主色调）。
> - **宽度**：全站默认满宽平铺（含 full 单栏页），仅 `readable` 页收窄。
> - **Mindbank**：3 栏 → 2 栏 list-detail。with-panel 页 tab 一律放页眉右侧。

---

## 1. 背景与诊断

当前前台 9 个主页面（Chat / ToDo / Inbox / Notes / Crawl / Mindbank / Coding Practice / Translate / Panel Hub）+ Settings + Profile 存在两类问题：

**统一性问题**
- 布局模式各页不同（子侧栏 / 全宽 / 左右面板 / 三栏混用），跨页跳转无"空间可预测性"。
- 页面 Header 至少 9 种写法，英文眉标（TODAY EXECUTION / CAPTURE WORKSPACE / WEB INTAKE）无信息量，Chat 无 header。
- Tab 至少 3 种实现（ToDo 全宽 pill / Inbox 右上 pill / Panel Hub 下划线）。
- 空状态、卡片 padding、section 标题各页不一。

**风格问题**
- 深海军蓝侧栏 + 纯白内容 = 标准 B2B dashboard 模板，"像任何一个 SaaS 后台"。
- 无 display 字体，全 Noto Sans SC，缺乏个性。
- 配色纯冷调单色，无温度。

**关键发现（决定重构策略）**
- Token 系统集中在 `index.css` 的 CSS 变量，Tailwind 仅引用 → 换肤≈改一个文件。
- 已有原语层 `.nexus-surface` / `.nexus-button-primary` / `.nexus-button-utility` / `.nexus-input`。
- 每个页面已是 `XDesktopView.tsx` + `XMobileView.tsx` 双视图 → 工作量翻倍但机械。
- 导航来自 `src/lib/constants.ts` 的 `NAV_ITEMS` 单一数组。
- **病根**：不存在任何共享"页面外壳"组件，每页各自手写 header / tab / 空状态。

**结论**：重构 = ①Token 换肤（全局视觉）+ ②抽 5 个共享外壳组件（统一性根治）+ ③导航分组 + ④逐页套壳。

---

## 2. 设计方向：Warm Studio

### 2.1 氛围

Nexus 不是给团队用的 SaaS，是个人的知识工具。它应像一间布置得当的书房 / 一本装订好的个人笔记本：**温暖、安静、有秩序、随手可达**，而不是冰冷的办公室后台。保留"紧凑工作台"的信息密度与克制，只把基调从冷蓝深色换成暖纸浅色，并给"知识"属性增加文学质感。

刻意制造的张力：**暖色纸张底 + 冷调钢笔墨水 accent**（像在米色笔记本上用蓝黑钢笔书写）。这组合刻意避开当前 AI 设计的三个默认套路（奶油底+赤陶 accent / 近黑底+荧光 accent / 报纸式 0 圆角）。

### 2.2 配色

| 角色 | Hex | 用途 |
|------|-----|------|
| `paper` | `#FAFAF8` | 内容区底（暖白，非冷蓝灰） |
| `sidebar` | `#F3F2EE` | 侧栏底（比 paper 略暖略深，自然后退） |
| `card` | `#FFFFFF` | 卡片 / 表单工作面 |
| `ink` | `#1C1B19` | 主文字（暖近黑，非纯黑） |
| `muted` | `#8A867C` | 次要文字 / eyebrow / metadata（暖灰） |
| `hairline` | `#E7E4DC` | 分隔线 / 边框（暖浅） |
| `accent` | `#2B50C8` | 钢笔墨水蓝 — 交互 / active / 链接 / 主按钮 |
| `accent-hover` | `#1E3DA0` | accent 的 hover / pressed 深态 |
| `accent-soft` | `#EAEEFB` | active 导航底 / 选中 tint / 链接 hover 底 |

语义色（收敛后，仅真实状态可用，不作装饰）：
- `destructive` `#B42330` — 删除、错误态、退出 hover。
- `success` `#166249` / `success-soft` `#EFF7F3` — 仅真实二元状态（API Key 可用、流程完成勾），不用于优先级。
- `warning` `#936516` / `warning-soft` `#FBF6EA` — 仅到期 / 待支付等真实预警。

> 决策：ToDo 优先级、Mindbank 步骤标签等**散落的绿/黄/红收敛为单 accent + 中性灰**。优先级用"中性底 + accent 深浅 / 小圆点"表达，不再三色并列。

### 2.3 字体（三角色，每个都挣得位置）

```css
@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+SC:wght@400;500;700;800&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600;8..60,700&family=JetBrains+Mono:wght@400;500;700&display=swap");

:root {
  --font-serif: "Source Serif 4", Georgia, "Noto Serif SC", serif;
  --font-sans:  "Noto Sans SC", Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --font-mono:  "JetBrains Mono", "SFMono-Regular", "Cascadia Code", monospace;
}
```

| 角色 | 字体 | 用途 |
|------|------|------|
| Serif 标题 | Source Serif 4 | 页面标题（PageHeader title）、section opener。给"知识/笔记/翻译"文学质感，与满大街 sans 后台拉开差距。 |
| Sans 正文/UI | Noto Sans SC + Inter | 正文、表单、按钮、导航、绝大多数 UI（保留，CJK 必需）。 |
| Mono 数据 | JetBrains Mono | API Key、金额、文件路径、代码、**PageHeader 的 eyebrow 眉标**。是内容本身需要等宽，不是装饰。 |

规则：
- **仅页面标题与 section 标题用 serif**，正文/按钮/表单一律 sans。禁止 serif 作为正文或控件字体。
- eyebrow 眉标用 mono + uppercase + `tracking-[0.18em]`，呼应"归档/索引"气质。
- 中文正文行高不低于 1.7；标题不使用渐变文字、不加投影。

### 2.4 圆角与阴影

- `--radius: 0.5rem`（8px）— 控件 / 按钮 / 输入框默认，从旧 12px 收紧，去掉"友好 SaaS 气泡"感，更接近纸张/印刷的冷静。
- 卡片：`10px`；页面主 surface：`12px`；弹窗：`12px`；chip/badge/头像：`999px`。
- 阴影改用暖中性基色（`--shadow-rgb: 28 27 25`），浅色主题下进一步压低不透明度，保持"耐用不发光"。

### 2.5 Signature — 章节式 Masthead（全站唯一记忆点）

> 把"用力"集中在一处：页面页眉。其余一切保持安静、克制。

每个页面顶部 = 一本装订笔记本的**章节开页**：mono 眉标 + accent 短竖线（书脊）+ serif 大标题 + muted 副标题。把整个 app 串成"你个人思考的一本书"的各个章节。

```
KNOWLEDGE                ← mono uppercase tracked，muted（章节索引）
▍ Mindbank               ← accent 3px 竖线(书脊) + Source Serif 4 大标题
你的知识在这里沉淀、连接。   ← sans muted 副标题
```

这个 signature 同时就是要抽的 `<PageHeader>` 组件 —— 既是记忆点又是统一性修复，一个动作两个收益。

---

## 3. Design Token 完整清单

> 全部颜色仍以 `HSL 三元组` + 配套 `*-rgb` 三元组写入 `src/index.css`，React/Tailwind 不得硬编码业务 hex。下表已给出换算值。

### 3.1 `src/index.css` `:root` 替换块

```css
:root {
  /* Core surfaces — Warm paper */
  --background: 60 17% 98%;            --background-rgb: 250 250 248;   /* #FAFAF8 paper */
  --foreground: 40 7% 10%;             --foreground-rgb: 28 27 25;      /* #1C1B19 ink  */
  --card: 0 0% 100%;                   --card-rgb: 255 255 255;         /* #FFFFFF      */
  --card-foreground: 40 7% 10%;        --card-foreground-rgb: 28 27 25;
  --popover: 0 0% 100%;                --popover-rgb: 255 255 255;
  --popover-foreground: 40 7% 10%;     --popover-foreground-rgb: 28 27 25;

  /* Sidebar — light warm (NEW: 侧栏不再用 primary) */
  --sidebar: 48 17% 94%;               --sidebar-rgb: 243 242 238;      /* #F3F2EE */
  --sidebar-foreground: 40 7% 10%;     --sidebar-foreground-rgb: 28 27 25;
  --sidebar-muted: 40 7% 45%;          --sidebar-muted-rgb: 122 118 109;
  --sidebar-hover: 45 18% 91%;         --sidebar-hover-rgb: 236 234 227;

  /* Brand — Pen ink blue (primary 现在是墨水蓝，不再是深海军蓝) */
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
  --shadow-rgb: 28 27 25;              /* 暖中性阴影基色 */
  --shadow-xs: 0 1px 2px rgba(var(--shadow-rgb), 0.05);
  --shadow-sm: 0 2px 8px  rgba(var(--shadow-rgb), 0.05);
  --shadow-md: 0 8px 24px rgba(var(--shadow-rgb), 0.07);
  --shadow-lg: 0 18px 50px rgba(var(--shadow-rgb), 0.14);
}
```

`body` 字体改用变量：`font-family: var(--font-sans);`。
新增基础规则：`.font-serif { font-family: var(--font-serif); }`、`.font-mono { font-family: var(--font-mono); }`（或经 Tailwind config 暴露）。

### 3.2 `.nexus-*` 原语调整

- `.nexus-surface`：圆角 `rounded-[0.75rem] md:rounded-[0.625rem]`（mobile 12 / desktop 10），阴影 `--shadow-sm`，边框 `--border`。
- `.nexus-button-primary`：保持结构，`bg-primary`（现为墨水蓝）+ 白字，hover `bg-secondary`（深墨蓝）。圆角随 `--radius` = 8px。
- `.nexus-button-utility`：保持。
- `.nexus-input`：保持，圆角 8px。
- 移除散落的 navy-tinted 阴影硬编码（如 `shadow-[0_-8px_24px_rgba(var(--primary-rgb)...)]`），改用 `--shadow-*` token，避免 primary 变蓝后阴影发蓝。

### 3.3 `tailwind.config.js` 增量

```js
extend: {
  colors: {
    sidebar: {
      DEFAULT: 'hsl(var(--sidebar))',
      foreground: 'hsl(var(--sidebar-foreground))',
      muted: 'hsl(var(--sidebar-muted))',
      hover: 'hsl(var(--sidebar-hover))',
    },
    'accent-soft': 'hsl(var(--accent-soft))',
    success: { DEFAULT: 'hsl(var(--success))', soft: 'hsl(var(--success-soft))' },
    warning: { DEFAULT: 'hsl(var(--warning))', soft: 'hsl(var(--warning-soft))' },
  },
  fontFamily: {
    serif: ['Source Serif 4', 'Georgia', 'Noto Serif SC', 'serif'],
    sans:  ['Noto Sans SC', 'Inter', 'sans-serif'],
    mono:  ['JetBrains Mono', 'SFMono-Regular', 'monospace'],
  },
  borderRadius: { xl: '0.875rem', lg: '0.625rem', md: 'var(--radius)', sm: '0.375rem' },
}
```

---

## 3.5 布局纪律（硬约束 — 这是「布局风格统一」的核心）

> **2026-06-25 补充**：第一轮执行后发现，颜色/字体定死了，但**间距和栅格留了自由度**，于是每页各写一套，出现「标题贴顶、tab 比例不协调、两栏高度不齐、空带」等问题。本节把这些**变成无选择项**，焊死在 `PageShell` 里。原则：**统一 = 减少选择**。页面只能传内容，传不了布局。

### 3.5.1 间距尺度（唯一允许的间距）

只准用这套尺度，禁止任意像素 padding/margin：

| Token | px | 用途 |
|---|---|---|
| `1` | 4 | label↔控件、图标↔文字 |
| `2` | 8 | 紧凑列表行内、chip 内距 |
| `3` | 12 | 卡片内距（compact）、表单字段间距 |
| `4` | 16 | **页面区块间距（默认）**、卡片内距（normal）、两栏 gap |
| `5` | 20 | 移动端页面纵向 padding |
| `6` | 24 | 桌面端页面 padding |

### 3.5.2 页面 padding / 高度 / 栅格 —— 全部由 `PageShell` 拥有

页面**不得**自己加最外层 `p-*`、不得自己写两栏 `grid-cols-[...px...]`、不得自己框 list-detail 的列。统一规则：

| 维度 | 规则（写死在 `PageShell`） |
|---|---|
| 页面 padding | `px-4 py-5 md:px-6 md:py-6`（移动 16/20、桌面 24）。**这修复「标题贴顶」** |
| 宽度策略 | **全站默认满宽铺满**（含 full 单栏页），保持一致的平铺观感。仅文本极多的页面显式传 `readable`，才给 full 内容套 `max-w-[1100px]` 居中。 |
| with-panel 的 tab | **一律放页眉右侧 `actions`**，不放主区顶部——否则 tab 会把主区内容往下顶，导致主区与右面板顶部错位（Crawl）或在标题与内容间形成全宽空带（Inbox）。 |
| 区块/两栏 gap | `gap-4`（16px） |
| list-detail 列宽 | `--shell-list: clamp(240px, 22vw, 300px)` + `minmax(0,1fr)`，**禁止写死 280px** |
| with-panel 列宽 | `minmax(0,1fr)` + `--shell-panel: clamp(320px, 24vw, 380px)` |
| list-detail 列框 | 两栏均由 `PageShell` 框成 `nexus-surface`（`FRAME` 常量），**页面不得自套 surface** |
| with-panel 列框 | 不框（主区/面板各自带卡片），`items-start` 让列按内容高度 |

### 3.5.3 高度链（解决两栏高度不齐 / 空带）

list-detail 要撑满视口高度，需要从 `AppLayout <main>` 到 `PageShell` 一条**连续的高度链**：

```
AppLayout <main> (flex-1, 撑满 dvh)
  └─ 页面 desktop wrapper: `hidden h-full md:flex md:flex-col`   ← 必须提供高度
       └─ PageShell root: `flex h-full min-h-0 flex-col`         ← 填充
            └─ list-detail grid: `grid min-h-0 flex-1 ...`        ← 两栏等高
                 ├─ aside.FRAME（内部内容 `overflow-y-auto`）
                 └─ main.FRAME
```

**契约**：凡是 `list-detail` 页面，其桌面 wrapper **必须**是 `hidden h-full md:flex md:flex-col`（不能是 `hidden md:block`——这正是 Notes 之前断链、Chat 没断链的原因）。`full` / `with-panel` 页面 wrapper 用 `hidden md:block` 即可（内容自然高度、向下滚动）。

### 3.5.4 列内滚动

`FRAME` 是 `overflow-hidden` 的等高面板，**滚动留给列内子内容**：子内容用 `min-h-0 flex-1 overflow-y-auto`。Notes 文件树、Chat 会话列表、Chat 消息流都遵循此规则，避免双滚动条。

### 3.5.5 落地状态（pilot = Notes）

已硬化并验证：
- `src/index.css`：新增 `--shell-list` / `--shell-panel`。
- `src/components/shell/PageShell.tsx`：拥有 padding + 高度 + 栅格 + 列框，写死契约（见组件顶部注释）。
- `src/pages/Notes/NotesDesktopView.tsx`：wrapper 改为高度链、文件树移入 `overflow-y-auto`、去除自套 surface（pilot 样板）。
- `src/pages/Chat/index.tsx`：去除自套 surface 与桌面重复 padding，保留移动 padding（list-detail 兄弟页，必须同时收口）。

剩余 11 页在 P3 按本节契约逐页收口：删除各页自加的 `p-*` 外框、删除写死的两栏像素列宽、list-detail 页修正 wrapper 高度链。

---

## 4. 共享外壳组件（统一性根治）

新增目录 `src/components/shell/`，5 个组件。所有页面的 Desktop/Mobile 视图改为消费这些组件，禁止再手写 header / tab / 空状态。

### 4.1 `<PageHeader>` —— Signature 章节页眉

```tsx
// PageHeader 是全站统一的章节式页眉（Signature）：mono 眉标 + accent 书脊 + serif 标题 + 副标题 + 右侧 actions。
export interface PageHeaderProps {
  eyebrow: string          // mono uppercase，如 KNOWLEDGE / CAPTURE / TRANSLATE
  title: string            // serif 大标题
  subtitle?: string        // sans muted 一句话
  actions?: React.ReactNode // 右侧主操作（如「新增」），每页最多一个 primary
}
```
骨架：
```tsx
<header className="mb-5 flex flex-wrap items-end justify-between gap-3">
  <div className="min-w-0">
    <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{eyebrow}</p>
    <div className="mt-1.5 flex items-center gap-2.5">
      <span aria-hidden className="h-6 w-[3px] shrink-0 rounded-full bg-primary" />
      <h1 className="font-serif text-[26px] font-semibold leading-none text-foreground md:text-[30px]">{title}</h1>
    </div>
    {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
  </div>
  {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
</header>
```
移动端：title 降到 `text-[22px]`，书脊 `h-5`。

### 4.2 `<PageShell variant>` —— 3 种布局模板

```tsx
export type PageShellVariant = 'full' | 'list-detail' | 'with-panel'
export interface PageShellProps {
  variant: PageShellVariant
  header: React.ReactNode      // 通常是 <PageHeader>
  children: React.ReactNode    // 主内容
  list?: React.ReactNode       // list-detail 的左列
  panel?: React.ReactNode      // with-panel 的右栏
  maxWidth?: 'default' | 'wide' // default 1180 / wide 1280
}
```

| variant | 桌面结构 | 用于 |
|---------|---------|------|
| `full` | header + 全宽单列主内容（`max-w-[1180px]` 居中，`p-6`） | ToDo / Translate / Panel Hub / Settings / Profile / Coding Practice |
| `list-detail` | header 之下 `grid-cols-[280px_minmax(0,1fr)]`，左列表 + 右详情 | Chat / Notes |
| `with-panel` | header 之下 `grid-cols-[minmax(0,1fr)_360px]`，主内容 + 右辅助面板 | Inbox / Crawl / Mindbank |

桌面统一 `max-w` + `p-6` + 区块间距 `gap-4`；移动端三种 variant 一律塌成单列（详情/面板进 bottom sheet 或 inline），由各 MobileView 处理。

### 4.3 `<Tabs>` —— 唯一 tab 实现

```tsx
export interface TabsProps<T extends string> {
  value: T
  onChange: (v: T) => void
  items: { value: T; label: string; count?: number }[]
  variant?: 'segmented' | 'underline'  // 默认 segmented
}
```
- `segmented`：白底容器 + active = `bg-primary text-primary-foreground`（墨水蓝），inactive = `text-foreground hover:bg-accent`。圆角 8px，高度 desktop 36 / mobile 44。用于 ToDo / Crawl / Mindbank。
- `underline`：用于 Panel Hub 这类多 tab。active = ink 文字 + accent 下划线，inactive = muted。
- `count` 显示为 active 时 `bg-primary-foreground/15`、inactive 时 `bg-muted` 的小圆角数字。

替换：ToDo 的 `TodoTabs`、Inbox 右上 pill、Panel Hub 下划线、Mindbank/Crawl 的 tab 全部换成它。

### 4.4 `<EmptyState>` —— 唯一空状态

```tsx
export interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>  // lucide 图标，单色描线
  title: string                                       // 如「今天还没有执行项」
  hint?: string                                       // 一句引导
  action?: React.ReactNode                            // 可选 CTA
}
```
样式：居中，图标置于 `bg-accent` 圆角方块内（muted 描线），title `text-sm font-medium`，hint `text-xs text-muted-foreground`。替换各页散落的"暂无书签 / 今天还没有执行项 / 选择左侧文件…"。文案遵循"空屏是行动邀请"原则，动词开头、具体。

### 4.5 `<SectionCard>` —— 统一卡片容器

```tsx
export interface SectionCardProps {
  title?: string                 // section 标题（sans，可选 serif 用于大区块）
  icon?: React.ComponentType<{ className?: string }>
  toolbar?: React.ReactNode      // 右上工具区
  children: React.ReactNode
  padding?: 'compact' | 'normal' // compact 10-12 / normal 14-16
}
```
基于 `.nexus-surface`，统一 padding / 标题字号 / 工具区位置。禁止卡片套卡片。

---

## 5. 导航分组

### 5.1 `src/lib/constants.ts`

`NAV_ITEMS` 从扁平 9 项改为分组结构（保留 path/label/icon，新增 group）：

```ts
export const NAV_GROUPS = [
  { key: 'space',   label: '空间', items: ['/chat', '/notes', '/mindbank'] },
  { key: 'capture', label: '收集', items: ['/inbox', '/crawl'] },
  { key: 'tools',   label: '工具', items: ['/todo', '/translate', '/coding-practice'] },
  { key: 'manage',  label: '管理', items: ['/panel-hub'] },
] as const
```
（或直接给每个 `NAV_ITEMS` 加 `group` 字段，Sidebar 按 group 渲染。二选一，保持单一数据源。）

### 5.2 `Sidebar.tsx`

- 容器：`bg-primary text-primary-foreground` → `bg-sidebar text-sidebar-foreground border-r border-border`。
- 分组：每组上方一行 mono uppercase `text-[10px] tracking-[0.16em] text-sidebar-muted` 组标题。
- nav item：inactive = `text-sidebar-muted hover:bg-sidebar-hover hover:text-foreground`；active = `bg-card text-primary font-semibold` + 左侧 `2px` accent 书脊（呼应 signature）。
- 品牌区 / 账户胶囊：白底深字版本，去掉 `bg-white/10` 系列深色专用类，改用 `bg-card` / `border-border` / `hover:bg-sidebar-hover`。

### 5.3 `MobileNav.tsx`

- 底栏 `bg-card/95` 保持；active 由 `bg-primary text-primary-foreground` 保持（墨水蓝在浅底上 OK）。
- More sheet 内分组顺序与桌面一致。
- 主路径 `PRIMARY_MOBILE_PATHS` 维持 `chat/todo/inbox/translate`，复核是否随分组调整。

---

## 6. 逐页套壳映射

13 个页面 × Desktop/Mobile 双视图。每页：①换 `<PageHeader>`（含新 eyebrow/title/subtitle）②套 `<PageShell variant>` ③tab→`<Tabs>` ④空态→`<EmptyState>` ⑤卡片→`<SectionCard>`。

| 页面 | variant | eyebrow (mono) | title (serif) | subtitle | 重点改动 |
|------|---------|----------------|---------------|----------|----------|
| Chat | list-detail | — / `CHAT` | Chat | — | 会话列表为 list 列；空态欢迎区用 EmptyState + suggestion chips（chips 改 accent-soft 底） |
| ToDo | full | `EXECUTION` | ToDo | 看板、任务和历史。 | TodoTabs→Tabs；优先级三色→中性+accent；header metrics 改中性 tone |
| Inbox | with-panel | `CAPTURE` | Inbox | 收集链接、文件和临时笔记。 | 右上书签/文档/笔记 pill→Tabs；导入/智能分组进右 panel；空态统一 |
| Notes | list-detail | `NOTES` | Notes | — | 文件树为 list 列；空态「选择左侧文件…」→EmptyState |
| Crawl | with-panel | `INTAKE` | Crawl | 网页爬取、文件上传与转换。 | 网页爬取/文件上传→Tabs；文件列表进右 panel |
| Mindbank | **list-detail** | `KNOWLEDGE` | Mindbank | 你的知识在这里沉淀、连接。 | 2 栏：workspace 列表 + 宽内容；workspace 详情并入内容区顶部（取代原稀疏的右侧详情栏，解决「两边空中间重」）；步骤标签去三色 |
| Coding Practice | full | `PRACTICE` | Coding Practice | — | 套壳即可（当前 16 行占位） |
| Translate | full | `TRANSLATE` | Translate | 同一个意思，换一种语言。 | 标题"轻量翻译工作台"→serif Translate + 副标；风格 chip 用 accent；保持纵向 composer/result/history |
| Panel Hub | full | `CONTROL` | Panel Hub | 订阅、密钥和账号，一处掌控。 | 顶部 tab→Tabs(underline)；金额/余额/API Key 用 mono；图表配色改 accent 单色渐变 |
| Settings | full | `SYSTEM` | Settings | — | 左垂直导航保留；右表单卡片用 SectionCard；已配置 badge 用中性 |
| Profile | full | `ACCOUNT` | 账户名 | — | 套壳 |
| Login | （独立，不套 PageShell） | — | Nexus | — | 仅换配色 token + serif logo 字 |
| Tasks | full（Settings 内） | `JOBS` | 任务 | — | 套壳，保持在 Settings 下 |

eyebrow 取简短英文单词（CAPTURE/KNOWLEDGE/INTAKE…），去掉旧的双词冗长眉标（TODAY EXECUTION / CAPTURE WORKSPACE / WEB INTAKE）。

---

## 7. 执行阶段与顺序

> 原则：先做"免费午餐"的全局换肤看方向，再抽外壳，最后机械套壳。每阶段可独立验收、可回滚。

**P0 — Token 换肤（1 个 commit，全局视觉立变）**
1. 改 `src/index.css` `:root`（§3.1）+ 字体 import + body 字体变量。
2. 改 `tailwind.config.js`（§3.3）。
3. 调 `.nexus-*` 原语 + 移除 navy-tinted 硬编码阴影。
4. 验收：全站可跑、无报错、整体变暖纸浅色、主按钮变墨水蓝。此时布局未动，先确认基调对。

**P1 — 外壳组件（1 个 commit）**
5. 新建 `src/components/shell/` 5 组件（§4），各自 Storybook/独立预览或在一个 sandbox 页验证。

**P2 — 导航分组（1 个 commit）**
6. `constants.ts` 分组 + `Sidebar.tsx` 浅色重写 + `MobileNav.tsx` 复核（§5）。

**P3 — 逐页套壳（按页 commit，每页 Desktop+Mobile 一起）**
7. 推荐顺序（从简到繁）：Coding Practice → Profile → Translate → ToDo → Crawl → Notes → Inbox → Panel Hub → Mindbank → Settings → Chat → Tasks → Login。
8. 每页：套 PageShell + PageHeader，替换 tab/空态/卡片，删除该页原手写 header/tab。

**P4 — 收尾**
9. 全站语义色审计：确认绿/黄/红只剩真实状态。
10. 跨页一致性走查 + 移动端 375/390/430 验收 + reduced-motion + focus-visible 复查。
11. 更新 `DESIGN.md`/标准文档对应实现（已随本方案更新规范，P4 仅核对实现与文档一致）。

---

## 8. 验收清单

**视觉**
- [ ] 全站暖纸底（#FAFAF8），侧栏浅暖灰（#F3F2EE），无残留深海军蓝大色块。
- [ ] 主按钮 / active / 链接为墨水蓝（#2B50C8）。
- [ ] 页面标题为 Source Serif 4；eyebrow 为 mono uppercase；API Key/金额/路径为 mono。
- [ ] 控件圆角 8px、卡片 10px，无残留 18px 气泡圆角。

**统一性**
- [ ] 每页页眉都是 `<PageHeader>`（眉标+书脊+serif 标题+副标题）。
- [ ] 全站只有一种 segmented tab + 一种 underline tab。
- [ ] 所有空状态走 `<EmptyState>`。
- [ ] 布局只剩 full / list-detail / with-panel 三种。
- [ ] 侧栏按"空间/收集/工具/管理"分组。

**语义色**
- [ ] 绿/黄/红仅出现在真实状态（错误、删除、到期、可用），优先级用中性+accent。

**质量底线**
- [ ] 375/390/430px 无横向溢出、无文字挤压。
- [ ] 所有交互元素有 hover/focus-visible/disabled。
- [ ] `prefers-reduced-motion` 生效。
- [ ] 图标按钮有 `aria-label`；颜色非唯一状态信号（保留文字标签）。

---

## 9. 风险与回滚

| 风险 | 缓解 |
|------|------|
| `--primary` 由 navy 变 blue，凡 `bg-primary` 当深色背景用的地方（侧栏、MobileNav active、ToDo metric primary tone）会变亮蓝 | P0 后立即全局 grep `bg-primary`/`text-primary-foreground`，逐处确认是"主操作"还是"深色面板"，后者改 `bg-sidebar`/中性。Sidebar 在 P2 专门重写。 |
| 散落硬编码 `rgba(var(--primary-rgb)...)` 阴影变蓝 | P0 统一替换为 `--shadow-*`。 |
| serif 字体加载导致标题 FOUT | `display=swap` + 仅标题用 serif，影响面小。 |
| 双视图 26 文件工作量大 | P3 按页 commit，可分批；每页改动机械且互不影响，可并行。 |
| 回滚 | P0–P2 各自独立 commit，token/外壳/导航可单独 revert；P3 每页独立，套壳出问题只回滚该页。 |

---

## 10. 关联文档

- 配套 Prompt：`docs/prompts/2026-06-25-warm-studio-ui-redesign-deepseek.md`
- 设计系统（已更新）：`DESIGN.md`
- 紧凑度/移动端规范（仍有效，颜色/字体部分已加 superseded 标注）：`docs/design-specs/2026-06-12-nexus-compact-ui-standards.md`
- 双视图架构：`AGENTS.md`
