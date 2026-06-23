# Chat 页面三次重构方案

## 背景

经过两轮重构，Chat 页面仍存在布局问题。本方案是最终修正版。

## 当前问题（从截图确认）

1. **顶部「AI / Chat」头部冗余**：侧边栏已高亮 Chat 导航项，独立头部浪费 ~60px 垂直空间，且让页面看起来"头重"
2. **底部空白间隙**：`h-[calc(100dvh-4rem)]` 减去了 4rem，但 AppLayout 的 `<main>` 并没有这 4rem 偏移——`<main>` 是 `flex-1 overflow-y-auto`，直接占满视口高度，多减的 4rem 导致底部露出背景色

## AppLayout 结构（改动依据）

```tsx
// AppLayout.tsx — Chat 页面渲染在 <Outlet /> 位置
<div className="flex min-h-dvh bg-background text-foreground">
  <Sidebar />   {/* w-64 h-screen sticky top-0 — 左侧导航，不影响内容区高度 */}
  <main className="flex-1 overflow-y-auto pb-0(桌面端)">
    <Outlet />  {/* ← Chat 页面在这里 */}
  </main>
</div>
```

`<main>` 在桌面端是 `flex-1` + `pb-0`，所以内容区可用高度 = `100dvh`。Chat 页面应该用 `h-dvh` 精确填满，不做任何减法。

## 设计方向

- **去掉独立页面头部**：Chat 是沉浸式对话界面，侧边栏已标识当前页面，不需要额外的 `AI > Chat` 标题行
- **`h-dvh` 精确填满**：不再用 `calc(100dvh - Xrem)` 做猜测性减法
- **双栏 flex 等高**：左右都贴满顶底，与侧边栏视觉对齐
- **四周留出呼吸间距**：`p-4` 提供统一的内边距

---

## 逐文件改动明细

### 1. `Chat/index.tsx` — 桌面端外层布局

**当前代码**（第 82-132 行）：
```tsx
<div>
  <div className="nexus-page-enter hidden h-[calc(100dvh-4rem)] flex-col md:flex">
    {/* 紧凑页面头部 */}
    <div className="shrink-0 px-6 pb-3 pt-4">
      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground">AI</p>
      <h1 className="mt-0.5 text-xl font-black leading-tight text-foreground">Chat</h1>
    </div>

    <div className="flex min-h-0 flex-1 gap-4 px-6 pb-4">
      <aside className="nexus-surface flex w-[260px] shrink-0 flex-col overflow-hidden">
        <ChatSidebar ... />
      </aside>
      <div className="nexus-surface flex min-w-0 flex-1 flex-col overflow-hidden">
        ...
      </div>
    </div>
    {streamingError && ...}
  </div>
```

**改为**：
```tsx
<div className="nexus-page-enter">
  {/* 桌面端：h-dvh 精确填满视口，不做减法；去掉独立头部，侧边栏已标识当前页面 */}
  <div className="hidden h-dvh flex-col p-4 md:flex">
    {/* 双栏 flex 等高拉满 */}
    <div className="flex min-h-0 flex-1 gap-4">
      {/* 左侧对话列表 */}
      <aside className="nexus-surface flex w-[260px] shrink-0 flex-col overflow-hidden">
        <ChatSidebar ... />
      </aside>

      {/* 右侧对话/欢迎区域 */}
      <div className="nexus-surface flex min-w-0 flex-1 flex-col overflow-hidden">
        {activeId && activeConversation ? (
          <ChatView ... />
        ) : (
          <WelcomeView ... />
        )}
      </div>
    </div>

    {streamingError && (
      <div className="mt-2 rounded-lg bg-destructive-soft px-4 py-2 text-xs text-destructive">
        {streamingError}
      </div>
    )}
  </div>
```

**关键变化**：
- **删除整个页面头部块**（`<div className="shrink-0 px-6 pb-3 pt-4">` 及其子元素），消除顶部冗余空间
- **`h-[calc(100dvh-4rem)]` → `h-dvh`**：精确填满视口，不做错误的减法，消除底部间隙
- **`px-6 pb-4` → `p-4`**：统一四周内边距，顶部也有呼吸空间
- **`nexus-page-enter` 移到外层包裹 div**，桌面端内层不再需要
- streamingError 区域加 `mt-2 rounded-lg`，不再用 `border-t`（因为它不再贴着页面底边）

### 2. `ChatSidebar.tsx` — 无额外改动

上一轮已改为 `h-full flex-col` + `flex-1 overflow-y-auto`，这是正确的，保持不变。

### 3. `WelcomeView.tsx` — 无额外改动

上一轮已去掉输入栏的 `max-w-lg` 约束，保持不变。

### 4. 移动端 — 无需改动

移动端部分（`md:hidden` 块）保持现有 `h-dvh flex-col` 结构，不受影响。

---

## 改动汇总

| 文件 | 改动点 | 复杂度 |
|------|--------|--------|
| `Chat/index.tsx` | 删除页面头部 + `h-dvh` 替换 `h-[calc(100dvh-4rem)]` + `p-4` 统一间距 | 低 |

本轮只改 **1 个文件**，且是缩减代码（删除头部），不新增任何内容。

---

## 验证清单

- [ ] `pnpm dev` 无编译错误
- [ ] Chat 桌面端：内容区从顶到底精确填满，无顶部冗余头部，无底部空白间隙
- [ ] Chat 桌面端：左右两栏等高，四周有均匀的 `p-4` 呼吸间距
- [ ] Chat 桌面端：Welcome 状态——图标/标题居中，chips 换行，输入栏贴底全宽
- [ ] Chat 桌面端：对话状态——消息可滚动，输入栏贴底
- [ ] Chat 桌面端：新建 / 搜索 / 重命名 / 删除对话正常
- [ ] Chat 桌面端：发送消息 + SSE 流式渲染正常
- [ ] Chat 桌面端：窗口缩放时布局不错乱
- [ ] Chat 移动端：无回归
- [ ] 其他页面无回归

---

---

## Mindbank 附带修复：WorkspaceList 选中行操作按钮对比度

### 问题

`WorkspaceList.tsx` 的 `WorkspaceRow` 组件中，选中行背景为 `bg-primary`（深蓝 #0B1D33），但编辑/删除按钮使用了 `nexus-button-utility` 类。该类定义了 `border bg-card`——`bg-card` 是纯白 `#FFFFFF`，在深蓝底上形成两个高对比度白色方块，图标几乎看不清。

### 文件

`frontend/src/pages/Mindbank/components/WorkspaceList.tsx`

### 改动

选中态下的操作按钮不使用 `nexus-button-utility`，改为透明 ghost 按钮：

**编辑按钮（约第 153 行）**：
```diff
- className={cn('nexus-button-utility h-7 w-7', selected ? 'text-primary-foreground/70 hover:text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
+ className={cn(
+   'inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors',
+   selected
+     ? 'text-primary-foreground/60 hover:bg-white/10 hover:text-primary-foreground'
+     : 'nexus-button-utility text-muted-foreground hover:text-foreground',
+ )}
```

**删除按钮（约第 162 行）**：
```diff
- className={cn('nexus-button-utility h-7 w-7', selected ? 'text-primary-foreground/70 hover:text-primary-foreground' : 'text-muted-foreground hover:text-destructive')}
+ className={cn(
+   'inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors',
+   selected
+     ? 'text-primary-foreground/60 hover:bg-white/10 hover:text-primary-foreground'
+     : 'nexus-button-utility text-muted-foreground hover:text-destructive',
+ )}
```

**原理**：选中态下去掉 `nexus-button-utility` 的 `bg-card border`，改用无背景 + `text-primary-foreground/60`（半透明白色图标），hover 时 `bg-white/10` 轻微提亮。未选中时保持原有 `nexus-button-utility` 不变。

### 验证

- [ ] 选中行：编辑/删除按钮为半透明白色图标，无白色背景块
- [ ] 选中行 hover：按钮轻微提亮，图标变为全白
- [ ] 未选中行：按钮保持原有 `nexus-button-utility` 样式不变
- [ ] 编辑/删除功能正常

---

## 约束

- 不改任何 hooks / state / API 调用
- 不新增 npm 依赖
- 不改移动端结构
- 中文注释，说明 WHY
