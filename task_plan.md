# Nexus 前台 UI 重构 — Warm Studio

**方案文档:** `docs/plans/2026-06-25-warm-studio-ui-redesign.md`
**Prompt:** `docs/prompts/2026-06-25-warm-studio-ui-redesign-deepseek.md`
**启动日期:** 2026-06-25

## 阶段

### P0 — Token 换肤 → [in_progress]
- 替换 `src/index.css` `:root` 为 Warm Studio HSL 变量
- 添加字体 `@import` 与 `--font-serif/sans/mono`
- `body` 用 `var(--font-sans)`
- 改 `tailwind.config.ts`：sidebar/accent-soft 颜色、fontFamily、borderRadius
- 调 `.nexus-*` 原语圆角与阴影
- 全局替换硬编码 `rgba(var(--primary-rgb)...)` 阴影为 `--shadow-*`
- **验收**: 编译通过、全站变暖纸浅色、主按钮变墨水蓝

### P1 — 共享外壳组件 → [pending]
- 新建 `src/components/shell/PageHeader.tsx`
- 新建 `src/components/shell/PageShell.tsx`
- 新建 `src/components/shell/Tabs.tsx`
- 新建 `src/components/shell/EmptyState.tsx`
- 新建 `src/components/shell/SectionCard.tsx`

### P2 — 导航分组 → [pending]
- `constants.ts`: NAV_ITEMS 加 group
- `Sidebar.tsx`: 深色→浅色、分组渲染
- `MobileNav.tsx`: 复核分组顺序与 active 配色

### P3 — 逐页套壳 → [pending]
13页顺序: Coding Practice → Profile → Translate → ToDo → Crawl → Notes → Inbox → Panel Hub → Mindbank → Settings → Chat → Tasks → Login

### P4 — 收尾 → [pending]
- 语义色审计、跨页一致性走查、移动端验收

## 遇到的错误
| 错误 | 尝试次数 | 解决方案 |
|------|---------|---------|
| - | - | - |
