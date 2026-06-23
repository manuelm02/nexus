# Mindbank UI Design Alignment — 2026-06-22

> 范围:Phase 6-4 (Port 抽象层 + Mindbank 核心页面) 交付的 UI 严格对齐 `DESIGN.md`  
> 触发:用户反馈"分割线太丑了 + 是否严格按 DESIGN.md 实现"  
> 决策:只动 Mindbank 模块,其他模块(Inbox/Settings/ToDo)的同问题不在本 spec 范围

## 1. 诊断

对比 `DESIGN.md` 与 `Inbox/Settings/ToDo` 现有实现,Mindbank 存在 5 类违规:

| # | 违规 | DESIGN.md 引用 | 当前代码 | 标准 |
|---|---|---|---|---|
| 1 | 主区域分割线用深蓝色 | §1 强制禁止项 "大面积重阴影"、"卡片套卡片" 隐含语义 | `border-secondary/80` | `border-border`(Inbox/Settings 全用) |
| 2 | 桌面端按钮过高 | §4 "桌面端 36px (primary) / 32px (secondary) / 32px (icon)" | `h-10` (40px) | `h-9` (36px) |
| 3 | 桌面端 Input 过高 | §4 "桌面端单行 input 36px-40px" | `h-10` (40px) | `h-9` (36px) |
| 4 | 工具页 H1 过小 | §3 "page-h1 24-28px / 1.2 / 800" | `text-xl` (20px) | `text-2xl` 或 `text-[24px]` (24-28px) |
| 5 | Mobile chip 容器套层 | §1 强制禁止项 "卡片套卡片" | `border-y border-secondary/80 bg-muted/30` | 仅用 chip border + gap,移除外层背景 |

注:`DocumentCard` 内部 `border-t border-border/50` 属于 Inbox/Settings 同模式,合规,保留。

## 2. 修复清单(逐文件)

### `MindBankDesktopView.tsx`

| 位置 | 现状 | 改为 |
|---|---|---|
| L86 aside | `border-r border-secondary/80` | `border-r border-border` |
| L102 workspace 信息条 | `border-b border-secondary/80` | `border-b border-border` |
| L145 Tab 切换区 | `border-b border-secondary/80` | `border-b border-border` |
| L107-108 H1 | `text-xl font-black` | `text-[24px] font-black` (page-h1 desktop token) |
| L113-115 "添加文件" 按钮 | `h-10 px-3` | `h-9 px-3.5` (桌面 36px) |
| L141 Tab 切换容器 | `h-11` | `h-10` (与按钮同高,符合 Inbox 模式) |

### `MindBankMobileView.tsx`

| 位置 | 现状 | 改为 |
|---|---|---|
| L67 chip 容器 | `border-y border-secondary/80 bg-muted/30 px-2 py-2` | 仅 `px-1 py-2` + chip 自带 border(移除外层边框和背景) |
| L114 当前 workspace 信息条 | `border-b border-secondary/80` | `border-b border-border` |
| L134 Tab 切换区 | `border-b border-secondary/80` | `border-b border-border` |
| L122 "添加" 按钮 | `h-9 px-3` | 保留(mobile 44px 标准) |
| L139 Tab 切换容器 | `h-10` | 保留(mobile 适当) |
| L204 底部 action bar | `border-t` | 保留(已是 border-t,加 shadow) |

### `components/WorkspaceList.tsx`

| 位置 | 现状 | 改为 |
|---|---|---|
| L45 标题区 | `border-b border-secondary/80` | `border-b border-border` |
| L91 底部新建按钮区 | `border-t border-secondary/80` | `border-t border-border` |

### `components/WorkspaceDialog.tsx`

| 位置 | 现状 | 改为 |
|---|---|---|
| L83 名称 input | `h-10` | `h-9` (桌面 36px) |
| L93 标签 input | `h-10` | `h-9` |
| L103 描述 textarea | `min-h-[80px]` + `text-sm` | 保留(desktop 仍可用 80px) |
| L146 提交按钮 | `h-10` | `h-9` (桌面 36px) |

注:Dialog 在 mobile 时仍是 sheet 模式,sm 断点以下不强制 36px;但当前 h-9 在 mobile 会显得过小——保留 Dialog 容器已用 sm: 控制,button 内部 sm 仍可单独 h-10。修正:`h-9 sm:h-9` 即可,desktop 36px / mobile 36px 是统一(因为 Dialog 已经是 sheet 模式,mobile 主操作在 sheet 内,仍可紧凑)。

### `components/MinioFilePicker.tsx`

| 位置 | 现状 | 改为 |
|---|---|---|
| L79 搜索 input | `h-9` | 保留(已合规) |
| L91 Prompt select | `h-9` | 保留 |
| L164 文件选择行 | `h-4 w-4` checkbox | 保留 |
| L113 搜索+Prompt 区分隔 | `border-b` | 保留(已用 border-b) |
| L200 操作栏 | `border-t` | 保留 |

注:MinioFilePicker 整体合规,无需改动。

### `components/DocumentCard.tsx` / `DocumentList.tsx` / `PipelineStatus.tsx`

合规,保留。

## 3. 不改的事项

- 布局结构、左 288 / 右 flex-1、Tab 三栏、Pill chip 圆角、Card 内部 grid、icon 颜色 token
- Dialog 居中弹窗 ↔ 移动 sheet 的响应式切分
- 流水线状态视觉(pending/processing/done/failed 四色)
- Workspace 列表的 domainTag 分组(合规)
- MinioFilePicker 整体结构

## 4. 验证

```bash
# 1. 类型 + build
pnpm build

# 2. 视觉对比 checklist
# - Desktop 顶部信息条分割线浅色(border-border)
# - Desktop "添加文件" 按钮高度 36px
# - Desktop H1 字号 24-28px
# - Mobile chip 区域无外层 bg-muted/30 + 浅色 border
# - 移动端触控目标保持 ≥ 40px
```

## 5. 风险评估

- 高度变化 36-40px 可能让 Dialog 内按钮视觉上略小,经 `h-9` 验证 Inbox 大量采用,无回归
- 移除 chip 容器背景会让 chip 直接落在 page-enter 背景上,信息层级靠 chip 自身的 border 维持,与 DESIGN.md "不为子区域再套一层" 一致
