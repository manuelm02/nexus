# Nexus UI 统一化重构：Mindbank & Chat 页面

## 任务概述

重构 Nexus 前端的 **Mindbank** 和 **Chat** 两个页面，使其与 Settings / ToDo / Inbox 等页面的 UI 风格完全统一。**只改样式和布局，不改业务逻辑、不新增 API 调用、不新增 npm 依赖。**

## 项目技术栈

- React 18 / Vite 5 / TypeScript / Tailwind CSS v3 / shadcn/ui / TanStack Query / Zustand / React Router v6 / pnpm 11
- 前端目录：`frontend/`
- 启动命令：`cd frontend && pnpm dev`

---

## 一、Nexus UI 设计规范（从现有页面提取）

以下规范从 Settings (`SettingsDesktopView.tsx`)、ToDo (`TodoDesktopView.tsx`)、Inbox (`InboxDesktopView.tsx`) 等已定型页面中提取，是本次重构的唯一参照标准。

### 1.1 页面外壳

```tsx
<div className="nexus-page-enter mx-auto hidden max-w-[1180px] space-y-4 p-4 md:block lg:p-6">
  {/* 页面头部 + 内容 */}
</div>
```

- `nexus-page-enter`：全局定义的 fade-in 动画（220ms ease-out）
- `max-w-[1180px] mx-auto`：统一的页面最大宽度 + 居中
- `hidden md:block`：桌面端专用，移动端由对应 MobileView 接管
- `space-y-4 p-4 lg:p-6`：段落间距 + 响应式内边距

### 1.2 页面头部

```tsx
<div>
  <p className="text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground">
    类别标签
  </p>
  <h1 className="mt-1 text-[28px] font-black leading-tight text-foreground">
    页面标题
  </h1>
</div>
```

### 1.3 双栏 Grid 布局

```tsx
<div className="grid items-start gap-4 lg:grid-cols-[Npx_minmax(0,1fr)]">
  <aside className="nexus-surface sticky top-4 ...">
    {/* 侧边栏内容 */}
  </aside>
  <div className="min-w-0 space-y-4">
    {/* 主内容区，可多个 .nexus-surface 卡片 */}
  </div>
</div>
```

- Settings 用 `220px`，可根据页面需要调整（Mindbank 推荐 `280px`，Chat 推荐 `240px`）
- 侧边栏 `sticky top-4` 滚动时固定

### 1.4 面板卡片

```tsx
<section className="nexus-surface space-y-4 p-4">
  <h2 className="text-lg font-extrabold text-foreground">面板标题</h2>
  {/* 面板内容 */}
</section>
```

`.nexus-surface` 已在 `index.css` 中全局定义，提供 `border + rounded + shadow + bg-card` 效果。

### 1.5 Tab 切换

```tsx
<div className="inline-grid h-10 grid-cols-N rounded-lg border bg-card p-1 shadow-[var(--shadow-xs)]">
  <button
    className={cn(
      'inline-flex h-full items-center justify-center gap-1.5 rounded-md px-4 text-sm font-bold transition-colors',
      active
        ? 'bg-primary text-primary-foreground'
        : 'text-accent-foreground hover:bg-accent',
    )}
  >
    {label}
  </button>
</div>
```

### 1.6 按钮

| 类型 | 类名 | 用途 |
|------|------|------|
| 主操作 | `nexus-button-primary` | 新建、保存、发送 |
| 次操作 | `nexus-button-utility` | 编辑、取消、辅助 |

### 1.7 输入框

```tsx
<input className="nexus-input h-9 w-full text-xs" />
```

### 1.8 空状态

```tsx
<div className="flex flex-col items-center justify-center py-20 text-center">
  <IconComponent className="h-10 w-10 text-muted-foreground/40" />
  <h3 className="mt-4 text-lg font-extrabold text-foreground">标题文案</h3>
  <p className="mt-1 text-sm text-muted-foreground">描述文案</p>
  <button className="nexus-button-primary mt-4 h-9 px-4 text-sm font-bold">
    CTA 按钮
  </button>
</div>
```

### 1.9 列表项选中态

```
选中：bg-primary text-primary-foreground
未选中：text-foreground hover:bg-accent
```

### 1.10 标签/分类标记

```tsx
<p className="text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground">
  标签文字
</p>
```

### 1.11 色彩变量（CSS custom properties）

```
--primary: 215 65% 12%     → #0B1D33 深蓝
--background: 214 33% 97%  → #F6F8FB 浅蓝灰
--card: 0 0% 100%           → #FFFFFF 白色
--border: 214 34% 90%       → #DCE3EE 浅灰蓝
--accent: 214 35% 94%       → #EEF3F9 极浅蓝
--muted-foreground           → 灰色文字
--ring: 212 45% 45%          → 聚焦环
```

---

## 二、当前问题诊断

### 2.1 Mindbank 页面

**文件**：`frontend/src/pages/Mindbank/MindBankDesktopView.tsx`

| 问题 | 当前代码 | 应改为 |
|------|----------|--------|
| 无标准页面壳 | `h-[calc(100dvh-2rem)] md:flex` | `nexus-page-enter mx-auto max-w-[1180px] ...` |
| 无页面头部 | 标题写在内容区内 | 独立 `Knowledge > Mindbank` 头部 |
| 裸边框分割 | `border-r border-border` | `.nexus-surface` 卡片包裹 |
| 侧边栏无面板感 | 直接 `<aside>` 裸展示 | `nexus-surface sticky top-4` |
| Tab 在 border-b 中 | `<div className="border-b px-6">` | 移入右侧 `.nexus-surface` 内部 |
| 选中态不一致 | `bg-primary/10 text-foreground` | `bg-primary text-primary-foreground` |
| 空状态太简陋 | `⚠ + 灰色文案` | 大图标 + 标题 + 描述 + CTA |
| 无 max-width | 全屏铺满 | `max-w-[1180px]` |
| 无 nexus-page-enter | 无 | 添加 |

**子组件涉及**：
- `components/WorkspaceList.tsx` — 侧边栏列表
- `components/DocumentList.tsx` — 文档列表（内容区）

### 2.2 Chat 页面

**文件**：`frontend/src/pages/Chat/index.tsx`

| 问题 | 当前代码 | 应改为 |
|------|----------|--------|
| 无标准页面壳 | `flex h-dvh flex-col` | `nexus-page-enter mx-auto max-w-[1180px] ...` |
| 无页面头部 | 完全没有 | 独立 `AI > Chat` 头部 |
| 侧边栏无面板感 | `border-r bg-card` | `.nexus-surface sticky top-4` |
| 对话区无面板感 | `bg-background` 裸展示 | `.nexus-surface` 包裹 |
| WelcomeView 太空旷 | 居中文字 + 单行 chips | 大图标 + 换行 chips + 更好间距 |
| Chips 单行截断 | `overflow-hidden whitespace-nowrap` | `flex-wrap gap-2` |
| 输入框无聚焦反馈 | 无 focus ring | `focus-within:ring-2 ring-ring/15` |
| 无 max-width | 全屏铺满 | `max-w-[1180px]` |

**子组件涉及**：
- `ChatSidebar.tsx` — 对话列表侧边栏
- `WelcomeView.tsx` — 空状态欢迎页
- `ChatView.tsx` — 对话视图
- `components/SuggestionChips.tsx` — 推荐词条
- `components/ChatInputBar.tsx` — 输入栏

---

## 三、逐文件改动明细

### 3.1 `MindBankDesktopView.tsx`

**改动 1 — 外层容器**

```diff
- <div className="hidden h-[calc(100dvh-2rem)] md:flex">
+ <div className="nexus-page-enter mx-auto hidden max-w-[1180px] space-y-4 p-4 md:block lg:p-6">
```

**改动 2 — 插入标准页面头部**（在容器内最顶部）

```tsx
<div>
  <p className="text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground">Knowledge</p>
  <h1 className="mt-1 text-[28px] font-black leading-tight text-foreground">Mindbank</h1>
</div>
```

**改动 3 — 双栏改为 grid 布局**

```diff
- <aside className="flex w-72 shrink-0 flex-col border-r border-border">
-   <WorkspaceList ... />
- </aside>
- <main className="flex flex-1 flex-col overflow-hidden">
+ <div className="grid items-start gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
+   <aside className="nexus-surface sticky top-4 overflow-hidden">
+     <WorkspaceList ... />
+   </aside>
+   <section className="nexus-surface flex flex-col overflow-hidden">
```

**改动 4 — 右侧内容区重组**

将 workspace 信息头、Tab 栏、Tab 内容全部放入右侧 `.nexus-surface` 内部：

```tsx
<section className="nexus-surface flex flex-col overflow-hidden">
  {/* workspace 信息头 */}
  <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
    {/* 保持现有 workspace 标题/标签/文档数逻辑 */}
    {/* 无选中 workspace 时显示升级后的空状态 */}
  </div>

  {/* Tab 栏 — 移入卡片内 */}
  {selectedWorkspace && (
    <div className="border-b border-border px-5 py-2">
      <div className="inline-grid h-10 grid-cols-3 rounded-lg border bg-card p-1 shadow-[var(--shadow-xs)]">
        {/* Tab 按钮保持现有逻辑 */}
      </div>
    </div>
  )}

  {/* Tab 内容 */}
  <div className="flex-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
    {/* 保持现有 DocumentList / MindBankQaView / AgentTab 切换逻辑 */}
  </div>
</section>
```

**改动 5 — 空状态升级**

当 `selectedWorkspace` 为 null 时，右侧 `.nexus-surface` 内显示：

```tsx
<div className="flex flex-col items-center justify-center py-20 text-center">
  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/[0.06]">
    <FolderOpen className="h-7 w-7 text-primary/40" />
  </div>
  <h3 className="mt-4 text-lg font-extrabold text-foreground">
    请先选择或创建一个 Workspace
  </h3>
  <p className="mt-1 text-sm text-muted-foreground">
    左侧列表选择已有 Workspace，或新建一个开始管理知识。
  </p>
  <button
    type="button"
    onClick={onOpenCreate}
    className="nexus-button-primary mt-5 inline-flex h-9 items-center gap-1.5 px-4 text-sm font-bold"
  >
    <Plus className="h-4 w-4" />
    新建 Workspace
  </button>
</div>
```

### 3.2 `WorkspaceList.tsx`

**改动 1 — 去掉外层 border，改用内部间距**

```diff
- <div className="flex h-full flex-col">
-   <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
+ <div className="flex flex-col p-3">
+   <div className="flex items-center justify-between gap-2 pb-3">
```

**改动 2 — 标题风格对齐**

```diff
- <h2 className="text-sm font-black text-foreground">Workspaces</h2>
+ <p className="text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground">Workspaces</p>
```

**改动 3 — 选中态统一**

```diff
- selected ? 'bg-primary/10 text-foreground' : 'text-foreground/80 hover:bg-accent',
+ selected ? 'bg-primary text-primary-foreground' : 'text-foreground/80 hover:bg-accent',
```

同时注意选中态下子元素颜色（文档数文案等）需从 `text-muted-foreground` 变为继承或 `text-primary-foreground/70`。

**改动 4 — 底部新建按钮**

```diff
- <div className="border-t border-border p-2">
-   <button className="flex w-full ... border-dashed ...">
+ <div className="pt-3">
+   <button className="nexus-button-primary flex w-full items-center justify-center gap-1.5 h-9 text-sm font-bold">
```

**改动 5 — 空列表状态**

```diff
- <p className="px-3 py-6 text-center text-xs leading-5 text-muted-foreground">
-   还没有 Workspace。<br />点击下方按钮创建第一个。
- </p>
+ <div className="flex flex-col items-center py-8 text-center">
+   <FolderOpen className="h-8 w-8 text-muted-foreground/30" />
+   <p className="mt-2 text-xs leading-5 text-muted-foreground">
+     还没有 Workspace。<br />点击下方按钮创建第一个。
+   </p>
+ </div>
```

### 3.3 `Chat/index.tsx`

**改动 1 — 桌面端外层重构**

桌面端部分从 `flex h-dvh flex-col` 改为标准页面壳 + grid 双栏。移动端部分保持现有逻辑不变。

```tsx
{/* 桌面端 */}
<div className="nexus-page-enter mx-auto hidden max-w-[1180px] space-y-4 p-4 md:block lg:p-6">
  {/* 标准页面头部 */}
  <div>
    <p className="text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground">AI</p>
    <h1 className="mt-1 text-[28px] font-black leading-tight text-foreground">Chat</h1>
  </div>

  {/* 双栏布局 */}
  <div className="grid items-start gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
    <aside className="nexus-surface sticky top-4 overflow-hidden">
      <ChatSidebar ... />
    </aside>
    <div className="nexus-surface flex flex-col overflow-hidden" style={{ height: 'calc(100vh - 200px)' }}>
      {activeId && activeConversation ? (
        <ChatView ... />
      ) : (
        <WelcomeView ... />
      )}
    </div>
  </div>
</div>

{/* 移动端保持现有结构 */}
<div className="flex h-dvh flex-col md:hidden">
  {/* 现有移动端代码不变 */}
</div>
```

注意：需要将原来桌面端和移动端共用的 JSX 拆分为两个独立块（`hidden md:block` 和 `md:hidden`）。ChatSidebar 组件自身不再控制 `hidden md:flex`，由父级控制可见性。

### 3.4 `ChatSidebar.tsx`

**改动 1 — 去掉外层面板样式**（由父级 `.nexus-surface` 提供）

```diff
- <aside className="hidden h-full w-64 flex-col border-r bg-card md:flex">
+ <div className="flex flex-col p-3">
```

**改动 2 — 标题风格对齐**

```diff
- <div className="flex items-center justify-between gap-2 border-b p-3">
-   <h2 className="text-sm font-black text-muted-foreground">最近对话</h2>
+ <div className="flex items-center justify-between gap-2 pb-3">
+   <p className="text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground">最近对话</p>
```

**改动 3 — 搜索框区域**

```diff
- <div className="border-b p-3">
+ <div className="pb-3">
```

**改动 4 — 列表区域设定 max-height**

```diff
- <div className="flex-1 overflow-y-auto p-2">
+ <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 340px)' }}>
```

### 3.5 `WelcomeView.tsx`

**完整重写**：

```tsx
import { MessageCircle } from 'lucide-react'
import { SuggestionChips } from './components/SuggestionChips'
import { ChatInputBar } from './components/ChatInputBar'
import type { ChatSuggestion } from '../../types/domain.types'

type WelcomeViewProps = {
  suggestions: ChatSuggestion[]
  isStreaming: boolean
  onSend: (message: string) => void
}

// WelcomeView Chat 空状态首页：主题图标、标题、推荐词条与输入栏
export function WelcomeView({ suggestions, isStreaming, onSend }: WelcomeViewProps) {
  return (
    <div className="flex h-full flex-col">
      {/* 居中内容区 */}
      <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 py-12">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/[0.06]">
          <MessageCircle className="h-7 w-7 text-primary/40" />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-black text-foreground">今天想聊点什么？</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            日常问答、代码解释、知识梳理，都可以问我。
          </p>
        </div>
        <div className="w-full max-w-lg">
          <SuggestionChips suggestions={suggestions} onSelect={onSend} />
        </div>
      </div>

      {/* 底部输入栏 */}
      <div className="border-t border-border p-4">
        <div className="mx-auto max-w-lg">
          <ChatInputBar placeholder="输入任何问题…" isStreaming={isStreaming} onSend={onSend} />
        </div>
      </div>
    </div>
  )
}
```

### 3.6 `SuggestionChips.tsx`

**改动 — 从单行滚动改为自动换行**

```diff
- <div className="flex gap-2 overflow-hidden whitespace-nowrap">
+ <div className="flex flex-wrap justify-center gap-2">
```

**改动 — chip 增加 hover 阴影**

```diff
- className="inline-flex shrink-0 items-center rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
+ className="inline-flex items-center rounded-full border border-border bg-card px-3.5 py-2 text-xs font-semibold text-muted-foreground transition-all hover:bg-accent hover:text-foreground hover:shadow-[var(--shadow-xs)]"
```

### 3.7 `ChatView.tsx`

**改动 1 — 标题栏融入面板**

```diff
- <div className="hidden items-center gap-2 border-b bg-card/60 px-4 py-2.5 md:flex">
+ <div className="flex items-center gap-2 border-b border-border px-5 py-3">
```

去掉 `hidden md:flex`（可见性由父级的桌面端/移动端分块控制）和 `bg-card/60`（面板自带背景）。

**改动 2 — 底部输入栏**

```diff
- <div className="border-t bg-card p-3 md:p-4">
+ <div className="border-t border-border p-4">
```

### 3.8 `ChatInputBar.tsx`

**改动 — 增加聚焦反馈**

```diff
- <div className="relative rounded-xl border bg-card shadow-[var(--shadow-sm)]">
+ <div className="relative rounded-xl border border-border bg-card shadow-[var(--shadow-sm)] transition-shadow focus-within:ring-2 focus-within:ring-ring/15">
```

---

## 四、移动端同步

### 4.1 Mindbank 移动端

文件 `MindBankMobileView.tsx` 需同步以下改动：
- 空状态组件改为与桌面端一致的三段式（图标 + 标题 + CTA）
- Tab 样式使用相同的 `inline-grid + shadow-xs` 模式
- WorkspaceList 选中态统一为 `bg-primary text-primary-foreground`

### 4.2 Chat 移动端

`Chat/index.tsx` 中移动端部分（`md:hidden` 块）保持现有结构，但：
- `ChatSidebar` 组件内部样式已改，移动端弹出侧边栏自动继承
- `WelcomeView` / `ChatView` / `ChatInputBar` 已改，移动端自动继承
- 移动端顶部栏 + 弹出 overlay 逻辑不变

---

## 五、验证清单

改完后逐项验证：

- [ ] `pnpm dev` 无编译错误、无 TypeScript 类型错误
- [ ] **Mindbank 桌面端**：
  - [ ] 页面头部显示 `Knowledge > Mindbank`
  - [ ] 左侧 workspace 列表在 `.nexus-surface` 面板中
  - [ ] 新建 / 编辑 / 删除 workspace 正常
  - [ ] 选中 workspace 高亮为深蓝色反白
  - [ ] Tab 切换（文档 / Q&A / Agent）正常
  - [ ] 文件导入弹窗正常
  - [ ] 空状态显示大图标 + 新建按钮
- [ ] **Mindbank 移动端**：Tab / 空状态样式一致
- [ ] **Chat 桌面端**：
  - [ ] 页面头部显示 `AI > Chat`
  - [ ] 左侧对话列表在 `.nexus-surface` 面板中
  - [ ] 新建对话、搜索、重命名、删除正常
  - [ ] Welcome 页面显示主题图标 + 换行 chips
  - [ ] 发送消息、SSE 流式渲染正常
  - [ ] 输入框聚焦时出现 ring
- [ ] **Chat 移动端**：顶部栏 + 弹出侧边栏 + 消息收发正常
- [ ] **其他页面无回归**：Settings / ToDo / Inbox 等页面不受影响

---

## 六、注意事项

1. **不改业务逻辑**：所有 hooks（`useConversations`、`useMessages`、`useStreamingMessage` 等）和 state 管理原样保留
2. **不改 API 层**：不修改 `client.ts` 或任何 API 调用
3. **不新增依赖**：所有图标从 `lucide-react` 获取（已安装）
4. **注释规范**：中文注释优先，说明 WHY 不说明 WHAT；组件顶部一行注释说明用途
5. **ChatSidebar 拆分注意**：原来 `ChatSidebar` 内部控制 `hidden md:flex`，改为由 `index.tsx` 父级控制桌面端/移动端可见性；`ChatSidebar` 自身只负责渲染列表内容，不再控制显隐。移动端弹出侧边栏仍需要 `ChatSidebar` 组件，确保复用
6. **高度计算**：对话区使用 `calc(100vh - Npx)` 或 `style={{ height }}` 保证消息区可滚动，具体数值需实测调整
7. **Tailwind v3**：确保 `postcss.config.js` 存在，新增类名能正确编译
