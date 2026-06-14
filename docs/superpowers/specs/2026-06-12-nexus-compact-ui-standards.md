# Nexus Compact UI Standards

**Date:** 2026-06-12  
**Purpose:** 统一 Nexus 前端 UI 密度，修正按钮、卡片、间距偏大的问题。  
**Audience:** DeepSeek / Codex / 前端执行工程师  
**Scope:** React 前端全局 UI 规范、DESIGN.md 修订、页面级 UI 审计与收敛。  

---

## 1. Design Direction

Nexus 是个人 AI 工作台，不是营销站、官网或展示型 SaaS 首页。界面应像长期使用的专业工具：安静、紧凑、明确、可扫描。

关键词：

- Compact
- Workbench
- Dense but readable
- Low noise
- Stable controls
- Clear hierarchy

必须避免：

- 大按钮
- 大圆角胶囊按钮滥用
- 卡片套卡片
- 大面积留白
- 过厚阴影
- 过大的页面标题
- 营销型 hero 版式

---

## 2. Density Principles

### 2.1 Page Density

Nexus 的页面默认是工具页，不是 landing page。

页面布局默认值：

- 主内容最大宽度：`1120px-1180px`
- 桌面端页面外边距：`24px`
- 移动端页面外边距：`16px`
- 主要区块间距：`16px`
- 紧凑列表区块间距：`8px-10px`
- 表单字段间距：`10px-12px`

禁止默认使用：

- `space-y-8`
- 大面积 `p-8`
- 卡片内无理由 `p-6`
- 页面标题下过大的 hero 留白

### 2.2 Component Density

默认控件应该是紧凑但可点击的后台工具尺寸。

桌面端：

- 主按钮高度：`36px`
- 次级按钮高度：`32px`
- 图标按钮：`32px`
- 输入框高度：`36px-40px`
- Select trigger：`36px-40px`
- 列表行最小高度：`44px`

移动端：

- 可点击目标不得小于 `44px`
- 但视觉按钮可以是 `40px` 高，通过 padding 或 hit area 保证触控

---

## 3. Button Standards

### 3.1 Button Size Scale

按钮必须按用途选尺寸，不允许所有按钮都用大号。

| Token | Height | Padding | Font | Use |
|---|---:|---:|---:|---|
| `xs` | 28px | `8px-10px` | 12px / 700 | 表格行内、卡片行内小动作 |
| `sm` | 32px | `10px-12px` | 13px / 700 | 次级操作、筛选、工具条 |
| `md` | 36px | `14px-16px` | 14px / 750 | 默认按钮 |
| `lg` | 40px | `16px-18px` | 14px / 800 | 页面主动作 |
| `touch` | 44px | `16px-18px` | 14px / 800 | 移动端关键动作 |

`44px` 不是桌面端默认按钮高度，只能用于：

- 移动端主操作
- 登录/注册等少数独立表单主按钮
- 需要明显触控目标的底部 action bar

### 3.2 Button Shape

默认圆角：

- 普通按钮：`8px`
- 图标按钮：`8px`
- segmented/chip：`999px` 可用，但只用于小尺寸筛选 chip
- 页面主 CTA 不默认使用 `999px`

禁止：

- 所有按钮都做成 pill
- 大号 pill button 塞满后台工具页
- 为了“高级感”给按钮加大阴影

### 3.3 Button Hierarchy

每个页面最多一个视觉主按钮。

优先级：

- Primary：页面主提交或主要生成动作
- Secondary：常规次级动作
- Ghost：列表行内操作、工具栏轻动作
- Destructive：删除、退出，仅在 hover/focus 或确认状态强化

Primary button 不应到处出现。列表卡片里的 `编辑`、`删除`、`设为默认` 默认用 secondary / ghost。

### 3.4 Button Visual CSS Guidance

推荐规范：

```css
.nexus-button-primary {
  min-height: 36px;
  border-radius: 8px;
  padding: 0 14px;
  font-size: 14px;
  font-weight: 750;
}

.nexus-button-secondary {
  min-height: 32px;
  border-radius: 8px;
  padding: 0 12px;
  font-size: 13px;
  font-weight: 700;
}

.nexus-button-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
}
```

---

## 4. Input And Form Standards

### 4.1 Inputs

桌面端输入框默认高度：

- 单行 input：`36px-40px`
- Select：`36px-40px`
- Search：`36px`
- Textarea：按内容场景定义，不默认大块

圆角：

- 输入框：`8px`
- 搜索框：`8px` 或小型 `999px`

禁止：

- 所有 input 都 `min-height: 44px`
- 搜索框像移动端大输入框一样占据过多高度

### 4.2 Forms

后台工具表单应优先紧凑排列。

桌面端：

- label 与 input 间距：`4px-6px`
- 字段行间距：`10px-12px`
- 表单 section 间距：`16px`

移动端：

- 字段可纵向堆叠
- 保证触控舒适，但不要扩大所有视觉元素

---

## 5. Surface And Card Standards

### 5.1 Surface Radius

默认圆角：

- 页面主 surface：`10px-12px`
- 列表卡片：`8px-10px`
- 弹窗：`12px`
- 小 badge/chip：`999px`

`18px` 不作为默认 surface 圆角，只能用于少数大面积聚合面板。

### 5.2 Surface Padding

默认 padding：

- 紧凑列表卡片：`10px-12px`
- 普通工具卡片：`14px-16px`
- 复杂表单面板：`16px`
- 移动端卡片：`14px-16px`

禁止默认：

- 卡片 `p-6`
- 页面大区块 `p-8`
- 为每个子区域再套一层卡片

### 5.3 Card Usage

卡片只用于：

- 重复列表项
- 表单工作面
- 弹窗或详情面板
- 需要框住的一组操作

不要把整个页面 section 都做成漂浮卡片。页面大分区可以是无框布局或轻边界区域。

---

## 6. Typography Standards

### 6.1 Page Titles

页面标题默认不要过大。

| Token | Desktop | Mobile | Use |
|---|---:|---:|---|
| Page H1 | 28px / 1.2 | 24px / 1.25 | 工具页标题 |
| Section H2 | 18px / 1.35 | 17px / 1.4 | 区块标题 |
| Card title | 14px-15px / 1.4 | 14px / 1.4 | 卡片标题 |
| Body | 14px-15px / 1.65 | 15px / 1.7 | 正文 |
| Metadata | 12px-13px / 1.5 | 12px-13px / 1.5 | 辅助信息 |
| Label | 11px-12px / 1.4 | 11px-12px / 1.4 | eyebrow / field label |

`44px display` 只能用于极少数首页或空态，不适合作为工具页默认标题。

### 6.2 Font Weight

推荐：

- Page H1：`800`
- Section H2：`750-800`
- Button：`700-750`
- Body：`400-500`
- Metadata：`500-650`

避免所有文字都 `font-black`。

---

## 7. Navigation Standards

### 7.0 Page Shell And Header

Nexus 工具页必须使用统一页面骨架，避免每个模块自行发明标题区和宽度。

桌面端默认页面容器：

- 通用工具页最大宽度：`1180px`
- 信息密度更高的双栏工作台可放宽到 `1280px`，例如 Inbox 书签/文档工作台
- 页面水平 padding：`24px`
- 页面区块间距：`16px`

页面标题区默认是无卡片标题，不使用独立 logo/icon：

```tsx
<div>
  <p className="text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground">Module</p>
  <h1 className="mt-1 text-[28px] font-black leading-tight text-foreground">Page</h1>
</div>
```

禁止：

- 把页面标题区做成 hero/card
- 为普通工具页标题额外加大 logo/icon
- 同一类工具页使用不同最大宽度，除非内容结构确实需要更宽工作台

### 7.0.1 Settings Navigation

Settings 是跨模块配置页，桌面端主分类必须优先使用左侧垂直导航，而不是顶部横向大 Tab。

原因：

- 后续会继续加入 Chat、ToDo、Crawl、Mindbank、Coding Practice、Subscription 等设置项
- 横向 Tab 在分类增多时会挤压、换行或隐藏
- 左侧导航更适合低频配置页的长期扩展

桌面端 Settings 布局：

- 页面容器：`max-w-[1180px]`
- 页头：使用标准无卡片标题区
- 主体：`grid-cols-[220px_minmax(0,1fr)]`
- 左侧导航：轻 surface，`sticky top-4`，每项高度 `40px`
- 右侧内容：当前设置页表单或面板

移动端 Settings 布局：

- 保持单列
- 主分类可使用横向紧凑 segmented tab
- 不使用左侧导航，避免占用窄屏主内容宽度

### 7.1 Sidebar

桌面侧边栏导航项：

- 高度：`36px-40px`
- 圆角：`8px`
- 图标：`16px`
- 字号：`14px`
- 内边距：`10px-12px`

底部账户区可以是聚合面板，但不要做成大卡片：

- padding：`10px-12px`
- 内部按钮高度：`30px-32px`
- 头像：`28px-32px`

### 7.2 Mobile Navigation

移动底部导航：

- 保证触控目标 `44px`
- 图标优先
- 文案短
- 不把桌面 sidebar 结构完整搬到移动端

---

## 8. Table, List, And History Standards

Nexus 很多页面是信息流和记录流，默认应该可扫描。

列表行：

- 桌面高度：`44px-56px`
- 紧凑历史卡片：`56px-72px`
- 普通记录卡片：`72px-88px`
- 只有详情丰富的卡片才超过 `96px`

列表内操作：

- 默认 ghost/icon button
- 高度 `28px-32px`
- 删除动作默认低噪声，hover/focus 强化

搜索/分页工具条：

- 高度 `36px-40px`
- 内部 gap `8px`
- 不要单独做多个大控件散落

---

## 9. Animation Standards

交互级别默认是 L1，工具页面可使用少量 L2 微动效。

允许：

- hover color transition
- focus ring
- small fade in
- streaming caret blink
- alternatives stagger reveal

默认时长：

- hover/focus：`120ms-160ms`
- content reveal：`160ms-220ms`
- stagger interval：`80ms-100ms`

禁止：

- 长时间大幅位移动画
- 大面积 blur / glassmorphism
- 装饰性光球
- 页面级滚动叙事动画

必须支持 `prefers-reduced-motion`。

---

## 10. DESIGN.md Correction Checklist

DeepSeek 重写 `DESIGN.md` 时必须完成这些修正：

- 把主按钮默认高度从 `44px` 改为桌面 `36px`，移动关键动作才用 `44px`。
- 把普通按钮默认圆角从 `999px` 改为 `8px`。
- 把普通 surface 圆角从 `18px` 收敛到 `10px-12px`。
- 把输入框默认高度从 `44px` 收敛到 `36px-40px`。
- 把图标按钮默认尺寸从 `40px-44px` 收敛到桌面 `32px`。
- 把工具页标题默认从 `32px-44px` 收敛到 `24px-28px`。
- 把页面主要区块间距从 `20px+` 收敛到默认 `16px`。
- 明确禁止卡片套卡片、大按钮泛滥、大圆角泛滥。
- 保留移动端 `44px` 触控目标要求，但区分视觉高度和触控面积。
- 保留现有 Navy Mono 色彩基调，但不要把按钮和卡片都做得过重。

---

## 11. UI Audit Checklist

执行全面 UI 统一时逐页检查：

- 每页是否只有一个明显 primary action。
- 列表行内动作是否使用 small/ghost/icon button。
- 桌面端按钮是否普遍高于 `40px`，若是则收敛。
- 是否存在无理由 `rounded-full` 主按钮。
- 是否存在无理由 `p-6` / `p-8` 面板。
- 是否存在卡片套卡片。
- 是否存在工具页标题过大。
- 是否存在每个 surface 都有重阴影。
- 移动端触控是否仍满足 `44px`。
- 所有可交互元素是否有 hover/focus/disabled 状态。

---

## 12. Mobile UI Standards

Mobile UI Standards 是 Nexus 移动端的项目级设计标准，用来规定移动端页面如何从桌面端能力转换成手机上的可用界面。它不是某个页面的实现细节，而是所有移动端页面必须遵守的设计和验收规则。

核心原则：

- 同一路由，不新增 `/m/*`。
- 业务逻辑只写一套，移动端只拆视图和交互组件。
- 移动端不是桌面端缩放版。
- 触控舒适优先于桌面端紧凑密度。
- 关键操作必须可见或可点击到，不能依赖 hover。
- 固定底部导航和底部操作条不得遮挡内容。

### 12.1 Mobile Base Metrics

移动端默认尺寸：

- 页面水平 padding：`16px`
- 页面主区块间距：`14px-16px`
- 紧凑列表间距：`8px-10px`
- 卡片 padding：`14px-16px`
- 最小触控目标：`44px`
- 视觉按钮高度：`40px-44px`
- 图标按钮点击区域：`44px`
- 图标尺寸：`18px-20px`
- Input / Select 高度：`40px-44px`
- Bottom nav / bottom action bar：`56px-64px + safe-area inset`

`44px` 是移动端触控底线，不代表所有移动 UI 都要显得很大。视觉元素可以保持克制，但点击区域必须足够。

### 12.2 Mobile Typography

移动端字号必须服务于工具页扫描，不使用桌面大标题。

| Token | Mobile | Use |
|---|---:|---|
| Page H1 | 22px-24px / 1.25 | 工具页标题 |
| Section title | 16px-17px / 1.35 | 页面分区 |
| Card title | 14px-15px / 1.4 | 卡片标题 |
| Body | 15px / 1.7 | 正文和表单内容 |
| Metadata | 12px-13px / 1.5 | 时间、状态、辅助信息 |
| Label | 11px-12px / 1.4 | eyebrow / field label |

禁止：

- 移动工具页默认 `text-3xl` / `text-4xl`
- 标题区域占据首屏过多空间
- 按钮文字为了塞进容器而缩到不可读

### 12.3 Mobile Buttons

移动端按钮规范：

- 主按钮视觉高度：`40px-44px`
- 次级按钮视觉高度：`40px`
- 图标按钮 hit area：`44px`
- 图标按钮必须有 `aria-label`
- 按钮文字必须短，不允许挤压、换行或溢出
- 底部 action bar 只放一个主动作，最多一个次动作
- 危险动作默认低噪声，确认态再强化

按钮选择：

- 页面主提交：primary
- 工具条动作：secondary / ghost
- 行内操作：icon / ghost
- 删除、退出：destructive ghost，进入确认态后才使用 destructive fill

### 12.4 Mobile Navigation

移动端导航采用 bottom nav + More sheet，不复制桌面 sidebar。

要求：

- Bottom nav 固定在底部，点击区域不小于 `44px`
- 当前页面状态必须清楚
- More sheet 承载 Settings、Profile、Logout、低频入口
- Bottom nav 和 action bar 必须处理 `safe-area inset`
- 主内容底部必须预留 padding，避免被 fixed nav 遮挡

禁止：

- 把桌面 sidebar 原样塞进移动端
- 在多个地方重复放 Logout
- Bottom nav 遮挡页面最后一条列表或表单按钮

### 12.5 Mobile Layout Conversion

桌面到移动端的转换规则：

- 多列布局 → 单列布局
- Table → compact card list
- Modal/Dialog → bottom sheet
- Sidebar → bottom nav / More sheet
- Hover menu → visible action / tap menu
- Right detail pane → bottom sheet / inline collapsible detail
- Toolbar → 可折成两行，但同一组工具必须在同一个容器里
- Desktop card grid → mobile vertical list，除非每张卡信息极少

当出现以下情况，必须拆 `MobileView` 或移动端专用组件：

- table 变 card list
- modal 变 sheet
- sidebar 变 bottom nav / More sheet
- hover 操作变点击操作
- 桌面横向工具条变移动端分组工具条
- 布局顺序发生变化

### 12.6 Mobile Forms

移动端表单规则：

- 字段纵向堆叠
- label 与 input 间距：`4px-6px`
- 字段间距：`10px-12px`
- 表单分组间距：`14px-16px`
- Select / popover 选项高度不小于 `44px`
- 页面主提交可以放入底部 action bar
- 底部 action bar 必须处理 `safe-area inset`
- 表单聚焦后，关键按钮不能被键盘永久遮挡

不要在移动端使用桌面式密集两列表单。

### 12.7 Mobile Lists

移动端列表应优先可扫描。

默认尺寸：

- 紧凑列表项：`56px-64px`
- 普通记录卡片：`64px-76px`
- 展开态详情卡片：最多按内容增长，但默认不超过 `96px`
- 卡片间距：`8px-10px`

内容规则：

- 只展示主标题、摘要、关键 metadata、必要动作
- 不把桌面所有列都塞进移动卡片
- 删除、复制、更多操作必须可触达
- 不依赖 hover 才能看到关键操作

### 12.8 Mobile Sheets And Dialogs

移动端优先使用 bottom sheet。

Sheet 规则：

- 圆角：`12px-16px`
- 内容区可滚动
- Footer 固定时必须加 `safe-area inset`
- 关闭按钮 hit area：`44px`
- 不在 sheet 内部继续套多层卡片

Dialog 只用于真正短小、需要强确认的操作，例如删除确认。

### 12.9 Mobile Page Patterns

常见页面模式：

- Dashboard / Settings：单列 section，主任务在上，低频设置在下
- Translate / AI tool：输入、结果、历史纵向排列，底部操作不遮挡结果
- ToDo / Task list：分组列表 + compact row，详情用 sheet
- History / records：搜索工具条 + compact card list + 简洁分页
- Profile / account：单列表单，保存动作固定或靠近表单末尾

### 12.10 Mobile Acceptance Checklist

每次移动端 UI 改动必须检查：

- `375px` 宽度无横向溢出
- `390px` 宽度无按钮文字挤压
- `430px` 宽度布局仍保持节奏
- 所有点击目标至少 `44px`
- Bottom nav / action bar 不遮挡内容
- 表单聚焦后关键按钮不被键盘永久遮挡
- Hover-only 操作在移动端有可触达替代方案
- 移动端页面没有桌面式大标题、大卡片、大留白
