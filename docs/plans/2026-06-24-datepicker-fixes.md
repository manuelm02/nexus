# 日期选择器修复 — 执行文档

> 将以下内容完整复制给 Claude Code 即可执行

---

```
你正在 Nexus 项目（/Users/manuelm/Workspace/Projects/Nexus/nexus）的 `panelhub` 分支上工作。

本次修复包含两部分：
1. Panel Hub 两个表单中的 `<input type="date">` 替换为项目已有的 `DatePicker` 组件
2. `DatePicker` 组件增强——支持年份直接选择，避免跨年时逐月翻页

---

## 步骤 1：DatePicker 增强 — 年份直接选择

修改 `frontend/src/components/ui/DatePicker.tsx`。

当前日历头部是这样的：

```
[<]   2026年06月   [>]
```

只能逐月点击 `<` / `>` 切换，跨年份非常费劲。

### 1.1 新增 yearPickerOpen 状态

在组件内部（`const [open, setOpen]` 附近）新增：

```ts
const [yearPickerOpen, setYearPickerOpen] = useState(false)
```

当 `yearPickerOpen` 为 true 时，日历区域替换为年份选择网格；选中后回到日历视图。

### 1.2 改造日历头部

将现有的中间标题从静态文本改为可点击按钮，点击后切换到年份选择视图：

当前代码（约第 139 行）：
```tsx
<div className="text-sm font-black text-foreground">
  {visibleMonth.getFullYear()}年{pad2(visibleMonth.getMonth() + 1)}月
</div>
```

改为两个按钮，分别控制年份选择和月份选择：

```tsx
<div className="flex items-center gap-0.5">
  <button
    type="button"
    onClick={() => setYearPickerOpen(!yearPickerOpen)}
    className="rounded-md px-1.5 py-0.5 text-sm font-black text-foreground transition-colors hover:bg-accent"
  >
    {visibleMonth.getFullYear()}年
  </button>
  <button
    type="button"
    onClick={() => { setYearPickerOpen(false); setMonthPickerOpen(!monthPickerOpen) }}
    className="rounded-md px-1.5 py-0.5 text-sm font-black text-foreground transition-colors hover:bg-accent"
  >
    {pad2(visibleMonth.getMonth() + 1)}月
  </button>
</div>
```

同时新增 `monthPickerOpen` 状态，让月份也可以直接选择（与年份选择同理）。

### 1.3 年份选择网格

在日历网格（`<div className="mt-3 grid grid-cols-7 ...">` 开始的那段）前面，加一个条件渲染：

当 `yearPickerOpen` 为 true 时，替换日历网格为年份网格：

```tsx
{yearPickerOpen ? (
  <div className="mt-3">
    <div className="flex items-center justify-between mb-2">
      <button type="button" onClick={() => setYearRangeStart(prev => prev - 12)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" aria-label="上一页年份">
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="text-xs font-bold text-muted-foreground">{yearRangeStart} — {yearRangeStart + 11}</span>
      <button type="button" onClick={() => setYearRangeStart(prev => prev + 12)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" aria-label="下一页年份">
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
    <div className="grid grid-cols-4 gap-1">
      {Array.from({ length: 12 }, (_, i) => yearRangeStart + i).map((year) => (
        <button key={year} type="button"
          onClick={() => {
            setVisibleMonth(new Date(year, visibleMonth.getMonth(), 1))
            setYearPickerOpen(false)
          }}
          className={cn(
            'flex h-9 items-center justify-center rounded-md text-sm font-semibold transition-colors',
            year === visibleMonth.getFullYear() ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-accent',
            year === new Date().getFullYear() && year !== visibleMonth.getFullYear() && 'border border-primary/35 text-primary',
          )}
        >
          {year}
        </button>
      ))}
    </div>
  </div>
) : monthPickerOpen ? (
  /* 月份选择网格 */
) : (
  /* 原有的日历网格 */
)}
```

需要新增状态（在组件内部现有 useState 附近）：

```ts
const [yearRangeStart, setYearRangeStart] = useState(() => {
  const currentYear = (selectedDate ?? new Date()).getFullYear()
  return currentYear - (currentYear % 12)
})
const [monthPickerOpen, setMonthPickerOpen] = useState(false)
```

### 1.4 月份选择网格

当 `monthPickerOpen` 为 true 时，展示 12 个月的网格：

```tsx
monthPickerOpen ? (
  <div className="mt-3 grid grid-cols-4 gap-1">
    {Array.from({ length: 12 }, (_, i) => i).map((month) => (
      <button key={month} type="button"
        onClick={() => {
          setVisibleMonth(new Date(visibleMonth.getFullYear(), month, 1))
          setMonthPickerOpen(false)
        }}
        className={cn(
          'flex h-9 items-center justify-center rounded-md text-sm font-semibold transition-colors',
          month === visibleMonth.getMonth() ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-accent',
        )}
      >
        {month + 1}月
      </button>
    ))}
  </div>
)
```

### 1.5 重置子面板状态

在 `handleOpenChange` 中，打开 Popover 时重置年份/月份子面板：

```ts
const handleOpenChange = (nextOpen: boolean) => {
  if (nextOpen) {
    setVisibleMonth(selectedDate ?? parseDateKey(today) ?? new Date())
    setYearPickerOpen(false)
    setMonthPickerOpen(false)
  }
  setOpen(nextOpen)
}
```

同步更新 `yearRangeStart`（确保打开时定位到当前年份所在区间）：

在 `handleOpenChange` 的 `if (nextOpen)` 块内添加：

```ts
const y = (selectedDate ?? new Date()).getFullYear()
setYearRangeStart(y - (y % 12))
```

### 1.6 左右箭头在子面板打开时隐藏

当 `yearPickerOpen` 或 `monthPickerOpen` 为 true 时，隐藏头部两侧的 `<` / `>` 月份切换按钮（因为子面板有自己的翻页）。修改头部区域的两个 ChevronLeft/ChevronRight 按钮：

```tsx
{!yearPickerOpen && !monthPickerOpen && (
  <button type="button" onClick={() => setVisibleMonth(addMonths(visibleMonth, -1))} ... >
    <ChevronLeft ... />
  </button>
)}
{/* 中间的年月标题 */}
{!yearPickerOpen && !monthPickerOpen && (
  <button type="button" onClick={() => setVisibleMonth(addMonths(visibleMonth, 1))} ... >
    <ChevronRight ... />
  </button>
)}
```

---

## 步骤 2：ApiKeyFormDialog 日期替换

修改 `frontend/src/pages/PanelHub/apikeys/ApiKeyFormDialog.tsx`。

### 2.1 添加 import

在文件顶部 import 块添加：

```tsx
import { DatePicker } from '../../../components/ui/DatePicker'
```

### 2.2 替换原生 input

将第 143-144 行的：

```tsx
<input type="date" value={form.planExpireDate} onChange={(e) => update('planExpireDate', e.target.value)}
  className="nexus-input h-9 w-full px-3 text-xs" />
```

替换为：

```tsx
<DatePicker
  value={form.planExpireDate}
  onChange={(v) => update('planExpireDate', v)}
  allowClear
  compact
  placeholder="选择到期日"
/>
```

---

## 步骤 3：CredentialFormDialog 日期替换

修改 `frontend/src/pages/PanelHub/credentials/CredentialFormDialog.tsx`。

### 3.1 添加 import

在文件顶部 import 块添加：

```tsx
import { DatePicker } from '../../../components/ui/DatePicker'
```

### 3.2 替换原生 input

将第 163-164 行的：

```tsx
<input type="date" value={form.expireDate} onChange={(e) => update('expireDate', e.target.value)}
  className="nexus-input h-9 w-full px-3 text-xs" />
```

替换为：

```tsx
<DatePicker
  value={form.expireDate}
  onChange={(v) => update('expireDate', v)}
  allowClear
  compact
  placeholder="选择到期日"
/>
```

---

## 验证

全部修改完成后执行：

```bash
cd frontend && pnpm build
```

确保 TypeScript 编译和 Vite 构建通过。

然后启动开发服务器验证：

```bash
cd frontend && pnpm dev
```

验证清单：
- [ ] Panel Hub → API Keys → 添加 API Key → "套餐到期日" 使用自定义 DatePicker（不是原生日历）
- [ ] Panel Hub → 凭据 → 添加凭证 → "密码到期日" 使用自定义 DatePicker
- [ ] DatePicker 日历头部的"年份"文字可点击，弹出 4×3 年份网格
- [ ] DatePicker 日历头部的"月份"文字可点击，弹出 4×3 月份网格
- [ ] 年份网格可以翻页（每页 12 年）
- [ ] 选择年份后自动回到日历视图
- [ ] 选择月份后自动回到日历视图
- [ ] 已有使用 DatePicker 的页面不受影响（Subscription 表单、ToDo 等）

## 注意事项

- 所有代码必须符合 CLAUDE.md 中的注释规范（中文优先，WHY 注释）
- 不要引入新的依赖
- DatePicker 组件的改动需要向后兼容——现有 props（value/onChange/allowClear/showQuickChips/compact/invalid/placeholder）全部保留，新增的年份/月份选择是内部交互增强，不影响外部 API
- 修改完成后不要自动 commit，等我确认
```
