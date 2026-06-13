# DeepSeek 执行提示词

你现在是这个项目里的前端实施工程师。请基于仓库内已有代码，严格执行一份已确认的 UI/UX 重构设计，不要自己发散需求，不要改后端接口语义，不要新增移动端专属路由。

## 先读这些文件

1. `AGENTS.md`
2. `DESIGN.md`
3. `docs/superpowers/specs/2026-06-12-settings-translate-panel-refresh-design.md`
4. `docs/superpowers/plans/2026-06-12-settings-translate-panel-refresh-execution.md`

## 项目背景

- 项目是 Nexus，前端技术栈为 React 18 + Vite + TypeScript + Tailwind CSS v3 + shadcn/ui + TanStack Query + Zustand + React Router v6。
- 后端统一返回 `{ success, data, message, errorCode }`，取值时注意 `res.data.data`。
- 所有代码必须遵守 AGENTS.md 中的中文注释规范。
- 不允许无意改变桌面端和移动端共享的业务逻辑。

## 本次任务目标

只重构以下 3 个区域：

1. `Sidebar` 左下角账户区
2. `Settings` 页面
3. `Translate` 页面的输入区、历史工具条、历史卡片

不要扩展到无关页面。

## 强约束

- 同一路由，不新增 `/m/*` 路由。
- 业务逻辑只写一套，桌面端和移动端共用 page 层状态。
- 优先改视图层与组件结构，不改后端接口契约。
- 不要引入新的设计风格，继续沿用 `Quiet Knowledge OS / Navy Mono / L1`。
- 不要硬编码新的业务色值，继续使用 CSS variables 与现有 `nexus-*` 样式体系。
- 如果组件逻辑变复杂，必须拆出子组件，不要让单文件失控。

## 需要实现的结果

### 1. Sidebar

- 把底部 `Settings / Profile / Logout` 三段式结构改成统一的账户胶囊区。
- 上半区显示头像、昵称、workspace 身份说明。
- 点击身份区进入 `Profile`。
- 下半区只保留 `Settings` 和 `退出登录`。
- `退出登录` 默认低噪声，hover/focus 才增强危险语义。

### 2. Settings

- 从当前“tab + 表单”形态改成更像“模型工作台”的连续面板。
- 要清楚展示“全局默认模型”这个唯一兜底规则。
- Provider 列表每项支持：
  - 浏览信息
  - 编辑
  - 删除
  - 设为默认
  - 状态展示
- `Translate` 必须有一个工作流覆盖设置，下拉可选“继承全局默认”或指定 provider。
- `系统参数` 和 `Jobs / Tasks` 下沉为次级区域，不要抢主视觉。

### 3. Translate

- 原文输入框默认两行起步，随着内容自动增高。
- 控制条更紧凑，优先级为：目标语言 > 风格 > 翻译按钮。
- 历史记录顶部重构为统一工具条，整合搜索、每页条数、分页状态和翻页按钮。
- 历史卡片面积缩小，只展示必要信息：
  - 原文摘要
  - 译文摘要
  - 时间
  - 目标语言
  - 风格
  - 删除按钮

## 实施要求

1. 先阅读代码，理解当前实现。
2. 先改结构，再补样式细节。
3. 每个导出组件顶部写一句中文注释，解释用途。
4. 对非显而易见逻辑写中文 why 注释，尤其是：
   - 默认模型唯一性表达
   - workflow override
   - textarea 自动增高
5. 修改完成后必须执行：
   - `cd frontend && pnpm lint`
   - `cd frontend && pnpm build`
6. 输出结果时请汇报：
   - 改了哪些文件
   - 核心 UI 变化
   - 验证结果
   - 剩余风险

## 工作方式

- 直接在现有代码上实施，不要只给建议。
- 如果发现某个点与现有代码冲突，优先遵守设计文档和 AGENTS.md，再做最小必要调整。
- 如果 `Settings/index.tsx` 过于臃肿，请主动拆组件。
- 最终交付应是已落地的代码，不是停留在设计说明。
