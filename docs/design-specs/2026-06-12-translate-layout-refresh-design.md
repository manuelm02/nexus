# Nexus Translate Layout Refresh Design

**Date:** 2026-06-12
**Status:** Ready for implementation
**Scope:** 基于当前 Translate Phase 2 实现做 UI/UX 二次改版，覆盖桌面端布局重组、历史记录增强、provider 提示位置调整、移动端独立重设计

---

## 1. Context

Translate 已经从最初的单表单演进为包含流式翻译、结构化结果、历史回填和 provider 检测的工作台，但当前界面仍有几处和目标体验不一致：

- 桌面端主工作区仍是左右双栏，输入框和结果区同时展开，输入框视觉占比过大
- Header 顶部单独展示 `LLM Provider Ready / Provider 待配置` 徽标，破坏标题区的安静感
- 原文输入区的高度和留白偏大，参数区块与按钮分散，视觉效率低
- 历史记录卡片密度偏低，只展示前 10 条，缺少搜索和分页
- 移动端只是桌面结构的竖排版，还不是针对手机使用场景单独设计

这次改版不改变 Translate 的核心能力，也不推翻现有 Phase 2 数据结构，只做基于现有实现的布局和交互再设计。

## 2. Design Goals

这次改版的目标是把 Translate 从“好看但偏松”的工作台，改成“更紧凑、更顺手、更像日常工具”的工作台。

成功标准：

- 桌面端主工作区采用上下排布，原文输入在上，结果区在下
- 输入区域明显收紧，控制区更集中
- provider 状态不再占据 header，而是在 result 面板内部处理异常和空态
- 历史记录区支持搜索、分页和更高密度卡片
- 移动端采用全新的单手操作优先布局，而不是桌面缩放版

## 3. What Changes from Current Version

### 3.1 Header

保留当前标题文案和整体语气，但移除右上角 provider 状态胶囊。

Header 只保留：

- eyebrow：`Translate`
- 页面标题：`轻量翻译工作台`
- 一句话副标题

Header 不再承担系统状态展示。

### 3.2 Provider Status Handling

`LLM Provider Ready` 不再显式展示。

新的规则：

- provider 正常时：不展示任何“ready”提示
- provider 检测中：仅在 result 区显示轻量 loading 文案
- provider 未配置：仅在 result 面板内显示配置引导

原因：正常状态不需要占用注意力，异常状态才需要占位。

### 3.3 Desktop Main Workbench

桌面端改为上下堆叠主工作区：

1. Header
2. 输入与控制面板
3. 翻译结果面板
4. 历史记录区

这样可以解决两个问题：

- 用户的主阅读路径变成“输入 → 点击 → 立刻往下看结果”，更自然
- 输入框不需要和结果区抢横向空间，结果区可以获得更完整的阅读宽度

## 4. Desktop Layout Specification

### 4.1 Overall Structure

页面主体改为单列主轴，容器宽度建议维持 `max-w-[1120px]` 到 `max-w-[1180px]` 之间，但卡片内部更紧凑。

桌面端顺序：

- `TranslateHeader`
- `TranslateComposerCompact`
- `TranslateResultPanel`
- `TranslateHistorySection`

### 4.2 Composer Card

原文输入卡重构为“紧凑工作条 + 中等高度输入区”的组合。

#### 顶部信息行

- 左侧：标题 `输入原文`
- 左下：辅助文案缩短为一句
- 右侧：字符计数

#### 输入框

现有输入框过高，改为：

- Desktop 默认最小高度：`144px-168px`
- 超长文本时继续可滚动扩展，但不要默认占满半屏

设计原则：

- 输入区要足够写一段话，但不应该压缩结果区和历史区
- 页面首屏应尽量同时看到“输入区起点”和“结果区标题”

#### 控制区

目标语言、风格、主按钮合并为单个横向控制行。

推荐顺序：

- 左：目标语言 Select
- 中：风格选择
- 右：翻译按钮

具体策略：

- `目标语言` 使用当前 select，宽度约 `220-260px`
- `风格` 在桌面端优先使用单行 segmented control，但整体宽度更紧凑
- 如果容器宽度不足，风格区允许降级为 Select，而不是强行挤压
- `翻译` 按钮固定在控制行右侧，不单独掉到底部

这样可以减少视觉跳跃，让操作区像工具栏而不是表单。

## 5. Result Panel Specification

### 5.1 Panel Position

结果区从桌面右栏改为输入区下方全宽显示。

收益：

- explanation、alternatives 可获得更舒展的阅读宽度
- provider 未配置空态不再显得像侧边告警，而是主结果的自然状态
- 流式输出时用户视线只需要向下移动，不需要横移

### 5.2 Panel Sections

结果区结构保留现有字段，但层级再收紧：

- 顶部：`Translated` eyebrow + 复制按钮
- 主译文：更大字号，但与 explanation 间距略收
- Explanation：单独 section
- Keywords：更紧凑标签
- Alternatives：卡片从大块改为更轻、更短的候选条
- 底部 metadata：目标语言 / 风格 / provider

### 5.3 Provider Missing State

当 provider 未配置时：

- 整个 result panel 进入空态
- 显示原因说明
- 给出去 `Settings` 的 CTA
- 不再在 header、按钮区和结果区同时重复提示

### 5.4 Provider Ready State

当 provider 正常可用时，不显示 ready badge。

这是刻意做的减法。

## 6. History Section Redesign

### 6.1 Current Problems

当前历史区的问题：

- 卡片留白偏多
- 同屏可见条目偏少
- 没有搜索
- 没有分页
- 信息结构偏“展示”，不够“检索”

### 6.2 New Desktop History Layout

历史区升级为三部分：

1. 区块标题行
2. 搜索与分页控制条
3. 高密度结果网格

#### 标题行

- 左：`历史记录`
- 左下：简短辅助说明
- 右：总条数

#### 控制条

- 搜索框：按 `sourceText / translatedText / keywords` 本地过滤
- 每页条数：默认 `12`
- 分页控件：上一页 / 下一页 / 页码摘要

#### 卡片设计

卡片改为更紧凑的双列信息结构：

- 左上：原文
- 右上：主译文
- 左下：时间 + 目标语言 + 风格
- 右下：可选关键词 / provider 简写

卡片高度建议从当前 `min-h-24` 收到 `min-h-[92px]` 左右。

### 6.3 Interaction

- 点击整张卡片回填
- Hover 明显但轻量
- 搜索只影响当前历史列表显示，不应修改工作区内容

## 7. Mobile Redesign

移动端必须单独设计，不再只是 Header / Composer / Result / History 的简单直排。

### 7.1 Mobile Core Principle

Translate 在手机上是“快速输入一句话，马上拿结果，再复用历史”。

因此移动端要强调：

- 单手操作
- 短路径
- 首屏尽快看到输入与结果

### 7.2 Mobile Structure

移动端建议顺序：

1. 轻量 Header
2. 浮层式输入卡
3. 紧凑控制条
4. 结果卡
5. 历史工具条
6. 历史列表

### 7.3 Mobile Header

- 保留标题和副标题
- 不展示 provider ready 状态
- 视觉比桌面更紧凑，减少顶部空白

### 7.4 Mobile Input

移动端输入框高度建议：

- 默认 `112px-128px`

输入框上方只保留标题，不要重复过长说明。

### 7.5 Mobile Controls

移动端控制区不要复制桌面单行 segmented toolbar，而应改成：

- 第一行：目标语言 Select
- 第二行：风格横向 chips，可横滑
- 第三行：全宽翻译按钮

原因：

- 手机横向宽度不足，强行把语言、风格、按钮塞同一行会显得拥挤
- 风格 chips 横滑比下拉更快，也比四等分按钮更自然

### 7.6 Mobile Result Card

结果卡直接跟在输入和按钮后面，让用户翻译后无需滚太多。

细节：

- 复制按钮固定在卡片右上
- explanation 默认展开
- keywords 横向 wrap
- alternatives 只显示前 2-3 条，剩余通过“展开更多”显示

### 7.7 Mobile History

移动端历史区不做桌面双列卡片，而改成单列高密度列表：

- 顶部有搜索框
- 默认每页 `8` 条
- 卡片高度更扁
- 底部分页按钮大触控区

## 8. Component-Level Decisions

### 8.1 `TranslateHeader`

要修改：

- 删除 provider badge 区域
- 收紧标题区域纵向间距

### 8.2 `TranslateComposer`

要修改：

- 缩短 textarea 高度
- 控制区从两列 + 按钮下置，改为更紧凑的工具栏布局
- Desktop / Mobile 内部布局分叉

### 8.3 `TranslateResultPanel`

要修改：

- 结果区默认全宽
- provider missing 状态在此集中处理
- alternative 条目视觉更轻

### 8.4 `TranslateHistoryList`

要修改：

- 增加 search state
- 增加 pagination state
- 卡片更紧凑
- Desktop 与 Mobile 展示方式分叉

## 9. State Additions

相比当前版本，前端需要新增的纯 UI state：

- `historyQuery`
- `historyPage`
- `historyPageSize`
- `historyExpanded`（可选，用于移动端备选表达展开）

这些 state 只属于前端视图层，不要求改后端接口。

## 10. Responsive Rules

- Desktop：主工作区单列堆叠，历史卡片双列
- Tablet：控制栏允许换行，但结果仍在输入下方
- Mobile：输入、控制、结果、历史严格按手机节奏重排
- 移动端任意宽度不得出现横向溢出
- 所有点击目标保持 `44x44`

## 11. Do's and Don'ts

Do:

- 保留 Quiet Knowledge OS 的安静感
- 用减法处理 provider 正常态
- 让首屏更快出现“输入 + 结果”
- 提高历史区的信息密度
- 让移动端像独立产品，而不是响应式附属品

Don't:

- 不要在 header 再放 provider ready 徽标
- 不要保留过高 textarea 占掉首屏
- 不要把语言、风格、按钮继续拆得过散
- 不要让历史记录永远只显示前 10 条
- 不要把移动端做成桌面双栏的压缩版

## 12. Acceptance Criteria

- Header 中不再显示 provider ready / waiting badge
- provider 未配置时仅在 result panel 内提示
- Desktop 端输入区和结果区改为上下堆叠
- 输入框视觉明显更紧凑
- 目标语言、风格、翻译动作形成更集中操作区
- 历史区支持搜索和分页
- 历史卡片比当前版本更紧凑
- Mobile 有独立布局设计，不复用桌面结构直接压缩
- 不改变现有流式翻译、结构化结果、历史回填的核心能力
