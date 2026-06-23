# Nexus Translate Phase 2 Design

**Date:** 2026-06-11
**Status:** Approved for planning
**Scope:** `frontend/src/pages/Translate`、Translate 后端返回结构、Phase 2 交互与响应式工作台设计

---

## 1. Background

Nexus 当前的视觉和产品方向已经在根目录 `DESIGN.md` 固化为 `Quiet Knowledge OS / Navy Mono / L1`。`Translate` 页面目前仅是一个轻量表单，支持输入、目标语言、风格、单一译文和最近历史，但还没有对齐以下要求：

- 与 ToDo 页面一致的工作台式信息层级
- 桌面端 / 移动端分视图但共享业务逻辑
- Phase 2 所需的扩展结果结构：译文、解释、关键词、备选表达
- LLM provider 未配置时的明确引导
- 历史记录回填而不是只读列表

Translate Phase 2 的目标不是做“翻译聊天”，而是做一个高频、低干扰、可靠的翻译工作台。

## 2. Product Goal

在不改变 `/translate` 路由的前提下，把 Translate 从“单次翻译表单”升级为“轻量翻译工作台”。

成功标准：

- 用户可以快速输入原文、选择目标语言和风格，并在同一屏完成翻译与复制。
- 译文输出不再只有 `translatedText`，而是支持分层结果展示。
- 历史记录可以快速回填当前工作区，形成个人翻译工作记忆。
- 当翻译 provider 不可用时，页面提供明确、可操作的空态引导。
- 桌面端和移动端均遵循现有设计体系，不引入营销页式视觉。

## 3. Experience Principles

### 3.1 定位

Translate 是工作区，不是内容页。用户来到这个页面的核心动作是“快速转换、比对、复制、复用”，因此页面应优先强调可用性和连续操作效率。

### 3.2 视觉基调

Translate 必须完全继承根目录 `DESIGN.md` 的现有方向：

- 深蓝用于主操作、选中态和关键状态
- 白色用于输入面板、结果卡片、历史卡片
- 黑色和蓝灰用于主文本与辅助信息
- 保持安静、清晰、长期使用友好，不做大面积装饰性渐变

### 3.3 动效档位

保持 `L1`，允许少量 `L1.5`：

- 页面进入：轻微上移淡入
- 按钮 / 卡片 hover：边框、阴影、底色轻变化
- 复制成功：图标切换和短暂状态反馈

禁止：

- 沉浸式滚动动画
- 重视差
- 会影响输入专注的背景动效

## 4. Information Architecture

### 4.1 Desktop

桌面端使用双栏工作台布局：

- 顶部：标题、说明文案、可选 provider 状态摘要
- 左栏：输入工作区
  - 原文输入
  - 目标语言选择
  - 风格选择
  - 翻译提交按钮
  - 可选字符数 / 状态提示
- 右栏：结果工作区
  - 主译文
  - explanation
  - keywords
  - alternatives
  - 复制按钮
  - 结果元信息（语言、风格、生成时间、provider）
- 底部次级区域：历史记录
  - 展示最近若干条翻译
  - 点击可回填到当前工作区

### 4.2 Mobile

移动端使用纵向卡片流：

- Header 卡
- 输入卡
- 参数卡
- 结果卡
- 历史卡

移动端不能简单复用桌面双栏压缩。布局顺序和交互方式都要针对窄屏重新组织，但数据流与 mutation 逻辑保持共享。

## 5. Core Interactions

### 5.1 Compose and Translate

用户输入原文、选择语言和风格后触发翻译。按钮 pending 时：

- 按钮进入 loading 文案
- 保持输入框内容不丢失
- 结果区显示 loading skeleton 或“正在生成”状态

### 5.2 Result Layers

Phase 2 的结果区必须分层显示，而不是一个大文本块：

- `translatedText`：主结果，最高视觉权重
- `explanation`：对语气、上下文或措辞的简短说明
- `keywords`：本次翻译涉及的关键词或术语
- `alternatives`：备选表达，帮助用户做语气判断

如果后端尚未返回 `explanation / keywords / alternatives`，前端必须兼容缺省字段，并在代码注释中说明这是为后端 Phase 2 演进做兼容。

### 5.3 Copy Feedback

复制仅针对主译文。复制成功时：

- 图标从 `Copy` 切到 `Check`
- 状态持续约 2 秒
- 不额外弹出打断式 toast

### 5.4 History Rehydrate

历史记录点击后，应把以下内容回填到当前工作区：

- 原文
- 目标语言
- 风格
- 当前结果摘要

这是 Translate 从“查询页”变成“工作台”的关键动作。

### 5.5 Provider Empty State

当后端返回“provider 未配置”或相关错误码时，结果区不能只显示泛化错误文案，必须展示可操作空态：

- 明确说明当前未配置可用翻译模型
- 解释为何当前无法生成译文
- 提供进入 `/settings` 的主操作按钮

## 6. Data Contract

### 6.1 Frontend Type Shape

前端应从单一 `Translation` 结果演进为兼容 Phase 2 的结果结构，建议命名：

```ts
export interface TranslationResult {
  id: string
  sourceText: string
  translatedText: string
  sourceLang?: string
  targetLang: string
  style?: string
  explanation?: string
  keywords?: string[]
  alternatives?: string[]
  provider?: string
  createdAt: string
}
```

### 6.2 Compatibility Strategy

后端未完整上线新字段前，前端必须允许字段为空：

- `explanation` 缺省时不渲染模块
- `keywords` 为空数组时不渲染标签区
- `alternatives` 为空数组时不渲染备选区

这样可以让前后端分阶段推进，避免必须同步上线。

## 7. File Decomposition

遵循项目的“同一路由、业务共享、视图按复杂度拆分”规范，Translate 页面建议拆分为：

```text
frontend/src/pages/Translate/
  index.tsx
  TranslateDesktopView.tsx
  TranslateMobileView.tsx
  translate.shared.ts
  components/
    TranslateHeader.tsx
    TranslateComposer.tsx
    TranslateResultPanel.tsx
    TranslateHistoryList.tsx
    ProviderEmptyState.tsx
```

责任边界：

- `index.tsx`：query、mutation、回填、复制状态、错误判定
- `TranslateDesktopView.tsx`：桌面布局编排
- `TranslateMobileView.tsx`：移动布局编排
- `translate.shared.ts`：常量、文案映射、辅助类型
- `components/*`：无业务副作用的视图组件

## 8. Visual Spec

### 8.1 Header

- 标题使用现有页面标题层级，不做夸张展示
- 副标题保持一句话，传达“同一意思在不同语言里的细微差别”
- Header 不承担过滤和复杂操作

### 8.2 Input Surface

- 使用 `nexus-surface`
- 多行输入框使用 `nexus-input` 风格衍生
- 目标语言选择器和风格按钮要统一高度和边界
- 主 CTA 使用 `nexus-button-primary`

### 8.3 Result Surface

- 主译文放在最显眼区域，字号大于解释与元信息
- explanation 为次级正文
- keywords 用低干扰标签
- alternatives 使用列表或分段块，不要模拟聊天气泡

### 8.4 History Surface

- 每条历史记录展示原文截断、译文截断、时间、目标语言、风格
- Hover / active 时清晰提示“可回填”
- 移动端历史项保持可点击大触达面

## 9. State Matrix

页面必须覆盖以下状态：

- 初始空态：未翻译，结果区显示占位说明
- Pending：提交中
- Success：显示结果分层
- Empty Provider：显示配置引导
- Generic Error：显示错误提示但保留当前输入
- History Empty：显示轻量空态

## 10. Responsive Rules

- `md` 以上进入桌面双栏
- `md` 以下切换移动卡片流
- 移动端底部预留给现有 `MobileNav`
- 任意宽度下不允许出现横向滚动
- 交互目标最小尺寸 `44x44`

## 11. Acceptance Criteria

- 页面仍使用同一路由 `/translate`
- 业务逻辑只保留一套
- 桌面和移动视图明确拆分
- 输出支持 `translatedText / explanation / keywords / alternatives`
- 历史记录支持回填
- provider 未配置时有明确引导
- 所有新增导出组件有中文用途注释
- 复杂 query / mutation / 副作用有中文 WHY 注释
- 风格完全对齐现有 `DESIGN.md`

## 12. Risks and Constraints

- 后端返回结构与前端展示结构存在演进差，需要兼容策略
- Translate 目前没有独立测试基建，Phase 2 至少要用 `pnpm lint` 和 `pnpm build` 做前端验证
- 如果后端要持久化新字段，需要新增 Flyway；迁移脚本一旦应用不可修改
- 如果使用 `boolean isXxx` 风格命名新增字段，会触发既有 MyBatis-Plus 限制，命名要避开

## 13. Implementation Recommendation

先做后端结果结构和 provider 抽象，再做前端页面拆分与展示重构，最后补齐状态与验收。这样可以避免前端先写死单一结构，后续再返工。
