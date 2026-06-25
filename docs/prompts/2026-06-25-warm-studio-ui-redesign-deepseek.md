# Prompt — Nexus 前台 UI 重构（Warm Studio）

**Date:** 2026-06-25
**For:** DeepSeek / Codex / 前端执行工程师
**方案文档:** `docs/plans/2026-06-25-warm-studio-ui-redesign.md`（执行前必读，本 Prompt 是其压缩执行指令）

---

## 角色与目标

你是 Nexus 前端工程师。把现有前台从 "Navy Mono / 深色侧栏 / 全 sans / 模板化 B2B 后台" 重构为 **Warm Studio**：暖纸浅色 + 钢笔墨水蓝 accent + Serif 标题，并通过抽取共享外壳组件根治"每页各写一套 header/tab/空态"的不统一。

技术栈：React 18 + Vite + TS + Tailwind v3 + shadcn/ui + TanStack Query + Zustand。每个页面是 `XDesktopView.tsx` + `XMobileView.tsx` 双视图，业务逻辑在 `index.tsx`，只改视图层，不改业务/接口/状态。

## 硬约束

1. **不改业务逻辑、接口、数据流、路由结构、props 契约**，只重构视图、样式、布局、外壳。
2. 颜色全部走 `src/index.css` 的 CSS 变量；**禁止在 React/Tailwind 里硬编码业务 hex**。
3. 保留所有工具页信息密度（ToDo 的快速创建/优先级/页签/分组/计数/状态流转/详情弹窗等一律不许删）。
4. 遵守现有紧凑度规范（按钮 desktop 36/32、输入 36–40、列表行 44–56、间距 16/8–10、移动端触控 ≥44px）。见 `DESIGN.md`。
5. serif 只用于页面标题与 section 标题；正文/按钮/控件一律 sans；mono 用于 eyebrow/Key/金额/路径/代码。
6. 语义色（绿/黄/红）只用于真实状态，**优先级等装饰性彩色收敛为中性 + 单 accent**。
7. 每个交互元素必须有 hover / focus-visible / disabled；图标按钮带 `aria-label`；支持 `prefers-reduced-motion`；颜色非唯一状态信号。
8. 不引入营销型 hero、光球、玻璃拟态、滚动叙事动画、重阴影。

## 设计基调（Warm Studio）

- 氛围：个人知识工作室 / 装订笔记本，温暖、安静、有秩序。暖纸底 + 冷调钢笔墨水 accent 的张力。
- 配色（hex，落地时用 `src/index.css` 已定义的 HSL/RGB 变量）：
  - paper `#FAFAF8` / sidebar `#F3F2EE` / card `#FFFFFF` / ink `#1C1B19` / muted `#8A867C` / hairline `#E7E4DC`
  - accent 墨水蓝 `#2B50C8` / accent-hover `#1E3DA0` / accent-soft `#EAEEFB`
- 字体：标题 `Source Serif 4`，正文 `Noto Sans SC + Inter`，数据 `JetBrains Mono`。
- 圆角：控件 8px / 卡片 10px / 主 surface 12px / chip 999px。
- Signature：章节式 Masthead —— `mono 眉标 + 3px accent 书脊 + serif 大标题 + muted 副标题`，全站统一页眉。

## 执行步骤（严格按阶段，分 commit）

### P0 — Token 换肤
- 用方案文档 §3.1 替换 `src/index.css` `:root`；加字体 `@import` 与 `--font-serif/sans/mono`；`body` 用 `var(--font-sans)`。
- 按 §3.3 改 `tailwind.config.js`（sidebar/accent-soft 颜色、fontFamily、borderRadius）。
- 调 `.nexus-surface/.nexus-button-primary/.nexus-button-utility/.nexus-input` 圆角与阴影；全局把硬编码 `rgba(var(--primary-rgb), …)` 阴影换成 `--shadow-*`。
- 验收：编译通过、全站变暖纸浅色、主按钮变墨水蓝、布局未动。

### P1 — 共享外壳组件 `src/components/shell/`
按方案文档 §4 实现并自测：
- `PageHeader`（Signature 页眉）
- `PageShell`（variant: `full` | `list-detail` | `with-panel`）
- `Tabs`（segmented | underline，支持 count）
- `EmptyState`（icon/title/hint/action）
- `SectionCard`（title/icon/toolbar/padding）

### P2 — 导航分组
- `src/lib/constants.ts`：`NAV_ITEMS` 加 `group` 或新增 `NAV_GROUPS`（空间/收集/工具/管理），保持单一数据源。
- `Sidebar.tsx`：深色→浅色（`bg-sidebar`），分组渲染 + mono 组标题；active = `bg-card text-primary` + 左 accent 书脊；去掉所有 `bg-white/10` 等深色专用类。
- `MobileNav.tsx`：复核分组顺序与 active 配色（墨水蓝 active 在浅底 OK）。

### P3 — 逐页套壳（每页 Desktop+Mobile 一起，按页 commit）
顺序：Coding Practice → Profile → Translate → ToDo → Crawl → Notes → Inbox → Panel Hub → Mindbank → Settings → Chat → Tasks → Login。
每页做四件事：
1. 用 `<PageShell variant>` + `<PageHeader>` 替换该页手写的标题区与布局壳（variant/eyebrow/title/subtitle 见方案文档 §6 映射表）。
2. 所有 tab → `<Tabs>`；所有空状态 → `<EmptyState>`；卡片容器 → `<SectionCard>`。
3. 删除被取代的旧手写 header/tab/空态代码。
4. 该页语义色收敛：优先级/步骤标签等去三色，改中性 + accent。

### P4 — 收尾
- 全站语义色审计；跨页一致性走查；移动端 375/390/430px 验收；focus-visible / reduced-motion 复查。
- 核对实现与 `DESIGN.md` 一致。

## 注释要求（项目强制）

- 每个导出 React 组件顶部一行中文注释说明用途。
- 复杂 `useEffect/useQuery/useMutation` 注明触发条件与副作用。
- 非显而易见的样式决策（如"primary 变蓝后此处改用 sidebar token 当深色面板"）必须注释 WHY。

## 验收门槛（必须全绿）

- [ ] 全站暖纸浅色，无残留深海军蓝大色块；主按钮/active/链接墨水蓝。
- [ ] 标题 serif、eyebrow/Key/金额 mono；控件 8px/卡片 10px。
- [ ] 每页页眉为 `<PageHeader>`；tab/空态/卡片全部走共享组件；布局仅剩 3 种 variant。
- [ ] 侧栏分组；绿/黄/红仅真实状态。
- [ ] 375/390/430 无溢出；hover/focus/disabled 齐全；reduced-motion 生效；图标按钮有 aria-label。
- [ ] 业务逻辑/接口/路由零改动，信息密度无损失。

## 自检后输出

每个 commit 说明：改了哪些文件、对应哪个阶段、验收项勾选情况、是否有偏离方案文档之处（如有需说明原因）。
