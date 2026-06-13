# DeepSeek UI 规范统一提示词

你现在是 Nexus 项目的前端 UI 规范执行工程师。当前 `DESIGN.md` 中部分规则导致你生成的 UI 按钮普遍偏大、圆角偏大、卡片偏松，并且移动端规则不够系统。请严格按项目已定义的新 UI 标准执行落地，不要自行发散设计标准。

## 先读文件

请先阅读：

1. `AGENTS.md`
2. `DESIGN.md`
3. `docs/superpowers/specs/2026-06-12-nexus-compact-ui-standards.md`
4. `frontend/src/index.css`
5. `frontend/tailwind.config.ts`
6. `frontend/src/components/layout/Sidebar.tsx`
7. `frontend/src/pages/Settings/index.tsx`
8. `frontend/src/pages/Translate/index.tsx`
9. `frontend/src/pages/Translate/components/*`

如果还有其他页面明显使用 `nexus-button-*`、`nexus-surface`、大按钮、大卡片，也一起纳入审计。

## 核心目标

把 Nexus UI 从“偏大、偏圆、偏 SaaS 展示感”统一收敛成“紧凑、专业、后台工具感”的标准，并按 `docs/superpowers/specs/2026-06-12-nexus-compact-ui-standards.md` 第 12 章落地移动端规范。

保留：

- Quiet Knowledge OS
- Navy Mono
- 白色工作面
- 深蓝主色
- 中文 UI 字体
- 清晰 hover/focus/disabled 状态

修正：

- 大按钮泛滥
- 普通按钮都用 pill
- 普通 surface 圆角过大
- 卡片 padding 过大
- 页面标题偏大
- 工具页留白偏松
- 卡片套卡片

## 强制 UI Token

请以 `docs/superpowers/specs/2026-06-12-nexus-compact-ui-standards.md` 为准重写或修订 `DESIGN.md` 的关键规则。

桌面端默认：

- Primary button height: `36px`
- Secondary button height: `32px`
- Icon button: `32px`
- Input / Select: `36px-40px`
- Sidebar nav item: `36px-40px`
- List row: `44px-56px`
- Compact history card: `56px-72px`
- Normal record card: `72px-88px`
- Main surface radius: `10px-12px`
- List/card radius: `8px-10px`
- Button radius: `8px`
- Page block gap: `16px`
- Dense list gap: `8px-10px`
- Card padding: `10px-16px`
- Tool page H1: `24px-28px`

移动端：

- 严格执行 `Mobile UI Standards` 章节。
- 触控目标必须不小于 `44px`。
- 视觉按钮可以是 `40px-44px`，但 hit area 要足够。
- 不要把桌面 compact token 简单套用到移动端。
- 复杂页面必须按项目规范拆 `MobileView` 或移动端专用交互组件。

## 禁止项

不要继续使用这些作为默认：

- 桌面按钮默认 `min-height: 44px`
- 普通按钮默认 `rounded-full`
- 普通 surface 默认 `rounded-[18px]`
- 普通卡片默认 `p-6` 或 `p-8`
- 工具页标题默认 `text-4xl`
- 列表操作按钮使用大号 primary button
- 卡片套卡片
- 大面积重阴影
- 营销型 hero 布局

注意：`rounded-full` 仍可用于小型 chip、badge、头像，不是完全禁用。

## 需要执行的任务

1. 修订 `DESIGN.md`

把现有按钮、输入框、surface、布局、字体尺寸规则改成 compact UI 标准。重点修正：

- `.nexus-button-primary`
- `.nexus-button-utility`
- `.nexus-input`
- `.nexus-surface`
- layout spacing
- type scale
- responsive behavior
- Do's and Don'ts

不要删除项目已有的产品方向，但要让规范明确：Nexus 是后台工具，不是大号 SaaS 展示页。

2. 修订全局 CSS

检查 `frontend/src/index.css` 中是否已有 `.nexus-button-*`、`.nexus-input`、`.nexus-surface` 或 animation 样式。

如果存在偏大规则，请改成 compact token：

- desktop primary button `36px`
- utility button `32px`
- input `36px-40px`
- surface radius `10px-12px`
- card padding 收敛

3. 页面级 UI 审计

至少审计并修正：

- `Sidebar`
- `Settings`
- `Translate`
- Translate result panel
- Translate history
- 其他明显使用大按钮/大卡片的页面

修正原则：

- 每页最多一个明显 primary action。
- 行内操作用 ghost/small/icon button。
- 删除类操作默认低噪声。
- 列表与历史记录要更紧凑。
- 搜索、分页、筛选工具条保持 `36px-40px` 高度。
- 页面 H1 不要超过 `28px`，除非是特殊空态或首页。

4. 保持移动端可用

桌面端视觉收紧后，移动端不能变得难点。请按 `Mobile UI Standards` 审计并修正：

- 页面水平 padding: `16px`
- 页面 H1: `22px-24px`
- 视觉按钮: `40px-44px`
- 图标按钮点击区域: `44px`
- Input / Select: `40px-44px`
- Bottom nav / action bar: 处理 `safe-area inset`
- Table 转 compact card list
- Modal/Dialog 优先转 bottom sheet
- Hover-only 操作必须变成 visible action / tap menu
- 375px / 390px / 430px 视口无横向溢出和按钮文字挤压

## 实施约束

- 不改后端。
- 不改业务逻辑。
- 不新增依赖。
- 不做无关重构。
- 不引入新的颜色体系。
- 不要用硬编码 hex 色值。
- 不要删除已有功能入口。
- 遵守 `AGENTS.md` 的注释规范。

## 验证命令

完成后必须执行：

```bash
cd frontend && pnpm lint
cd frontend && pnpm build
```

如果项目已有前端 dev server 或浏览器验证流程，请再做桌面端和移动端人工检查。

## 输出格式

完成后请汇报：

1. 修改了哪些文件。
2. `DESIGN.md` 中哪些规则被收敛。
3. 全局按钮、输入框、surface 的新默认尺寸。
4. 哪些页面做了 UI 统一。
5. lint/build 验证结果。
6. 仍可能偏大的遗留位置。
7. Mobile UI Standards 已落地到哪些页面，以及哪些移动端页面仍需人工视觉确认。
