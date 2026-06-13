# Settings / Translate Panel Refresh Execution Plan

**Date:** 2026-06-12  
**Goal:** 基于已确认设计，重构 `Sidebar`、`Settings`、`Translate` 的信息架构与前端视图层，不改后端接口语义。  
**Audience:** DeepSeek / Codex / 任意执行型代理  
**Execution style:** 先读设计，再改代码，再验证。  

---

## 1. 实施原则

- 不新增移动端路由，继续使用同一路由。
- 不复制业务逻辑；共享 query、mutation、表单状态与数据转换。
- 视图层复杂度上升时优先拆组件，而不是把所有 JSX 堆在一个文件里。
- 所有新增代码遵守项目注释规范，注释写 why，不写废话 what。
- 优先复用现有样式变量、`nexus-surface`、`nexus-button-*`、`nexus-input`。

---

## 2. 目标文件范围

### Sidebar

- `frontend/src/components/layout/Sidebar.tsx`

### Settings

- `frontend/src/pages/Settings/index.tsx`
- 如有必要，新建：
  - `frontend/src/pages/Settings/SettingsDesktopView.tsx`
  - `frontend/src/pages/Settings/SettingsMobileView.tsx`
  - `frontend/src/pages/Settings/components/*`

### Translate

- `frontend/src/pages/Translate/index.tsx`
- `frontend/src/pages/Translate/TranslateDesktopView.tsx`
- `frontend/src/pages/Translate/TranslateMobileView.tsx`
- `frontend/src/pages/Translate/components/TranslateComposer.tsx`
- `frontend/src/pages/Translate/components/TranslateHistoryList.tsx`
- 如有必要：`TranslateHeader.tsx`、`TranslateResultPanel.tsx`

---

## 3. 建议执行顺序

### Phase 1. Sidebar 账户胶囊区

#### 目标

把底部零散入口重构为统一账户模块。

#### 具体任务

1. 保留主导航区不动。
2. 移除底部独立 `Profile` 卡片样式。
3. 新增统一 `account capsule` 容器。
4. 容器上半区展示：
   - 头像
   - 昵称
   - `Personal workspace` 或类似身份说明
5. 点击身份区进入 `/profile`。
6. 容器下半区只保留：
   - `Settings`
   - `退出登录`
7. `退出登录` 默认低噪声，hover/focus 才增强危险语义。

#### 验收

- 左下角看起来是一个模块，而不是三个散按钮。
- 账户信息、设置、退出之间层级清楚。

---

### Phase 2. Settings 页面信息架构重组

#### 目标

从“tab + 表单”改成“模型工作台”。

#### 具体任务

1. 弱化或移除现有 `LLM 配置 / 系统参数` 作为主导航的地位。
2. 页面改为纵向面板结构，顺序如下：
   - 页面头部说明
   - 默认模型面板
   - Provider 列表面板
   - 工作流覆盖面板
   - 系统参数 / Jobs 面板
3. 保留现有 query/mutation 逻辑，但重新组织 UI。

#### 注意

- 如果继续保留 tab，也只能作为次级切换，不可继续作为主体验骨架。
- 最推荐做法是直接改为单页连续面板。

---

### Phase 3. 默认模型规则显性化

#### 目标

把“唯一默认模型”从隐藏规则变成显性规则。

#### 具体任务

1. 在页面上明确显示当前默认 provider。
2. 在 provider 列表中让默认项有 `默认` 徽标。
3. 把“设为默认”操作移动到列表项交互中。
4. 新建 provider 时不再把 `设为默认` checkbox 当作主入口；即使保留，也应弱化。
5. 确保任何时刻都能清楚看见谁是默认模型。

#### 验收

- 用户不需要读说明文案，也能看懂哪个是默认模型。

---

### Phase 4. Provider 列表的操作化重构

#### 目标

每个 provider 项都可直接管理，而不是只读展示。

#### 具体任务

1. 每张 provider 卡片显示：
   - 名称
   - provider
   - model
   - enabled 状态
   - default 状态
2. 卡片动作区至少包括：
   - `编辑`
   - `设为默认`
   - `删除`
3. 删除保留确认语义。
4. 如当前后端没有单独“设为默认”接口，可复用已有编辑/保存流程实现。
5. 编辑表单建议做成可展开/复用的内联面板，而不是长期常驻大表单。

#### 技术提示

- 如果 `Settings/index.tsx` 开始变臃肿，应提取 provider card、provider editor、workflow override row 等子组件。

---

### Phase 5. Translate 工作流覆盖区明确化

#### 目标

让 `Translate` 的模型选择看起来是“工作流覆盖”，而不是一个孤立下拉框。

#### 具体任务

1. 新建或重命名该区块为 `工作流覆盖`。
2. 只先展示 `Translate` 一项。
3. 每一项都要说明：
   - 继承全局默认时的行为
   - 选择指定 provider 后的覆盖含义
4. 下拉框首选项为 `继承全局默认`。
5. 继续保留现有 sentinel 方案，例如 `__inherit__`。

---

### Phase 6. Translate 输入区紧凑化

#### 目标

默认两行，自适应增高，减少首屏压迫感。

#### 具体任务

1. 修改 `TranslateComposer` 中的原文输入控件：
   - 起始高度改为两行附近
   - 根据内容自动增长
   - 禁止手动 resize
2. 字符计数保留，但视觉权重降低。
3. 桌面端把目标语言、风格、翻译按钮压成一条紧凑工具条。
4. 移动端允许拆成两行，但顺序不变。

#### 实现建议

- 用 `textarea` + `scrollHeight` 同步高度。
- 需要在逻辑上兼容“清空内容后回到最小高度”。
- 这类非显而易见逻辑必须写中文注释，说明为何不用固定高度。

---

### Phase 7. Translate 历史工具条重构

#### 目标

把搜索、条数、分页收进统一控制带。

#### 具体任务

1. 重做 `TranslateHistoryList` 顶部区域。
2. 搜索框、每页条数、分页状态、前后页按钮视觉上属于同一组。
3. 桌面端优先一行布局。
4. 移动端允许两行布局，但用同一 surface 包裹。

#### 验收

- 用户第一眼能看出这是一组“检索/翻页工具”，不是散落表单。

---

### Phase 8. Translate 历史卡片压缩

#### 目标

让历史记录更像扫描列表，而不是阅读卡片。

#### 具体任务

1. 保留整卡点击回填。
2. 压缩卡片高度和留白。
3. 每张卡只展示：
   - 原文一行摘要
   - 译文一行摘要
   - 时间、目标语言、风格
4. 桌面端删除按钮 hover 才强化。
5. 移动端删除按钮保持可见，但不能干扰主点击区。

#### 验收

- 同屏能看到更多记录。
- 信息仍可快速扫读。

---

### Phase 9. 响应式与组件拆分

#### 目标

满足项目的“同一路由、业务共享、视图拆分”规范。

#### 具体任务

1. `Settings` 如果结构变复杂，必须拆出 `DesktopView` / `MobileView`。
2. `Translate` 继续共享 page 层业务逻辑。
3. 避免桌面端改动误伤移动端。
4. 与设备差异强相关的控件优先拆成独立视图组件。

---

## 4. 验证步骤

### 必跑

1. `cd frontend && pnpm lint`
2. `cd frontend && pnpm build`

### 建议人工检查

1. 桌面端打开 `Sidebar`，确认左下角已统一。
2. 打开 `Settings`：
   - 默认模型是否明确
   - Provider 列表是否支持编辑/删除/设为默认
   - Translate override 是否明确表达“继承默认”
3. 打开 `Translate`：
   - 输入框是否两行起步并自动增高
   - 搜索/分页工具条是否统一
   - 历史卡片是否更紧凑
4. 检查移动端布局是否仍可用。

---

## 5. 风险与回退点

### 风险 1

`Settings/index.tsx` 当前把 query、mutation、表单状态、UI 混在一起，直接继续堆可能导致文件快速失控。

处理：

- 优先在本次重构中把 provider 相关 UI 拆成子组件。

### 风险 2

自动增高 textarea 容易造成高度闪烁或清空后高度不回退。

处理：

- 在桌面端和移动端分别验证短文本、长文本、清空文本三种状态。

### 风险 3

列表级“设为默认”可能需要额外 mutation 组合，如果没有单独接口，容易和现有创建/编辑逻辑打架。

处理：

- 先明确复用哪个已有接口更新 `defaultProvider`。

---

## 6. 完成定义

只有当以下全部成立时，才算完成：

- 文档中的三块重构都已落地
- `pnpm lint` 通过
- `pnpm build` 通过
- 桌面端与移动端均可用
- 注释规范已满足
- 未引入新的硬编码业务色或破坏现有设计系统

