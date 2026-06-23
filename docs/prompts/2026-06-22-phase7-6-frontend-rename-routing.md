# Phase 7.6 — 目录重命名 + 路由更新提示词

执行计划：`docs/superpowers/plans/2026-06-22-panel-hub-phase7.md`（Phase 7.6 节）  
前置：Phase 7.5 已完成（TypeScript 类型和 API 层已到位）

---

你正在开发 Nexus 项目（路径：`/Users/manuelm/Workspace/Projects/Nexus/nexus`），React 18 + TypeScript + React Router v6。请先阅读 `CLAUDE.md`，再阅读计划文档 Phase 7.6 节。

本阶段目标：将 Subscriptions 页面目录重命名为 PanelHub，更新路由和导航配置。**不修改页面内部组件的业务逻辑**，只做重命名和路由接线。

---

## 第一步：阅读参考文件

- `frontend/src/router.tsx`（路由配置）
- `frontend/src/lib/constants.ts`（NAV_ITEMS 和常量）
- `frontend/src/components/layout/Sidebar.tsx`（侧边栏，含图标映射）
- `frontend/src/components/layout/MobileNav.tsx`（移动端导航，含图标映射）

## 第二步：重命名目录

将整个目录重命名：

```bash
cd /Users/manuelm/Workspace/Projects/Nexus/nexus/frontend/src/pages
mv Subscriptions PanelHub
```

目录结构变为：
```
frontend/src/pages/PanelHub/
├── components/
│   ├── CategoryInput.tsx
│   ├── CycleProgressBar.tsx
│   ├── dashboard/
│   ├── DeleteConfirm.tsx
│   ├── SubscriptionCard.tsx
│   ├── SubscriptionFormDialog.tsx
│   ├── SubscriptionFormFields.tsx
│   ├── SubscriptionsDashboard.tsx
│   ├── SubscriptionsStatsRow.tsx
│   ├── SubscriptionViewTabs.tsx
│   └── UsageAccountCard.tsx
├── usage/
│   ├── BalanceTrendChart.tsx
│   ├── LedgerHistory.tsx
│   ├── UsageAccountCreateDialog.tsx
│   ├── UsageTabView.tsx
│   └── useUsageAccounts.ts
├── index.tsx
├── subscriptions.shared.ts
├── SubscriptionsDesktopView.tsx
└── SubscriptionsMobileView.tsx
```

> 注意：此步骤只改目录位置，**不改任何文件名或文件内容**。

## 第三步：修改 router.tsx

```typescript
// 修改 import
const PanelHubPage = lazy(() => import('./pages/PanelHub'))

// 修改路由（在 children 数组中）
// 新增主路由
{ path: 'panel-hub', element: <Wrap><PanelHubPage /></Wrap> },
// 保留别名（改用 PanelHubPage）
{ path: 'subscriptions', element: <Wrap><PanelHubPage /></Wrap> },
{ path: 'ledger', element: <Wrap><PanelHubPage /></Wrap> },

// 删除原来的 SubscriptionsPage import
```

## 第四步：修改 constants.ts

```typescript
// NAV_ITEMS 中，将 subscriptions 改为：
{ path: '/panel-hub', label: 'Panel Hub', icon: 'LayoutDashboard' },

// BILLING_TYPE_LABELS 中，移除 per_token：
export const BILLING_TYPE_LABELS: Record<string, string> = {
  monthly:  '按月',
  yearly:   '按年',
  lifetime: '买断',
  one_time: '一次性',
}
```

## 第五步：修改 Sidebar.tsx

```typescript
// 1. 更新 import：移除 CreditCard，加入 LayoutDashboard
import {
  Target, Feather, Layers, Brain, Radio, FileText,
  LayoutDashboard, Hammer, Sparkles, Settings, Languages, LogOut,
} from 'lucide-react'

// 2. 更新 icons 映射：移除 CreditCard，加入 LayoutDashboard
const icons: Record<string, React.ComponentType<{ className?: string }>> = {
  Target, Feather, Layers, Brain, Radio, FileText,
  LayoutDashboard, Hammer, Sparkles, Settings, Languages,
}
```

## 第六步：修改 MobileNav.tsx

同步更新图标映射，将 `CreditCard` 替换为 `LayoutDashboard`：
- 在 import 中替换
- 在图标映射对象中替换

## 第七步：修复内部 import 路径（如果有其他文件引用了 Subscriptions 路径）

全局搜索确认是否有其他文件引用了旧路径：

```bash
cd /Users/manuelm/Workspace/Projects/Nexus/nexus/frontend/src
grep -r "pages/Subscriptions" --include="*.tsx" --include="*.ts" .
grep -r "from.*Subscriptions" --include="*.tsx" --include="*.ts" .
```

如果发现（比如 Settings 页面中的 SubscriptionModelPanel），更新 import 路径指向 `pages/PanelHub`。

## 第八步：验证

```bash
cd /Users/manuelm/Workspace/Projects/Nexus/nexus/frontend

# TypeScript 编译检查
npx tsc --noEmit
# 可能会有一些错误是因为 per_token 相关代码还未清理（Phase 7.9 处理），暂时忽略

# 启动开发服务器
pnpm dev

# 浏览器测试：
# 1. 侧边栏应显示 "Panel Hub" + LayoutDashboard 图标
# 2. 点击进入 /panel-hub — 页面正常加载（内容暂时还是旧的 Subscriptions UI）
# 3. 访问 /subscriptions — 应跳转到同一页面（别名生效）
# 4. 访问 /ledger — 同上
```

**注意事项：**
- 重命名目录时确保 git 能识别为 rename（`git mv` 或先删后加，git 会自动检测 rename）
- 页面内部的 import 都是相对路径（如 `./components/SubscriptionCard`），目录重命名后相对路径不变，所以内部 import 不需要修改
- 如果有 Settings 页面引用了 `../Subscriptions/...` 的路径，需要改为 `../PanelHub/...`
- 此阶段不改文件名（如 SubscriptionsDesktopView.tsx 保持原名），文件名会在 Phase 7.9 统一重命名
