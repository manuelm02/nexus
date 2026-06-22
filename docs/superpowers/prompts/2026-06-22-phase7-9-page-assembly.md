# Phase 7.9 — 主页面重组 + Dashboard 增强 + 归档 + 清理提示词

执行计划：`docs/superpowers/plans/2026-06-22-panel-hub-phase7.md`（Phase 7.9 节）  
前置：Phase 7.7 + 7.8 已完成（API Keys Tab 和 Credentials Tab 组件均已到位）

---

你正在开发 Nexus 项目（路径：`/Users/manuelm/Workspace/Projects/Nexus/nexus`），React 18 + TypeScript + Tailwind CSS v3 + shadcn/ui + TanStack Query。请先阅读 `CLAUDE.md`，再阅读计划文档 Phase 7.9 节。

本阶段目标：将 5 个 Tab 组装到 Panel Hub 主页面，重命名所有页面级组件，增强 Dashboard 和归档视图，清理旧的 per_token 文件。这是前端重构的最后一步。

---

## 第一步：阅读当前代码

请完整阅读以下文件，了解当前页面结构：

- `frontend/src/pages/PanelHub/index.tsx`（主入口）
- `frontend/src/pages/PanelHub/SubscriptionsDesktopView.tsx`（桌面视图，4 Tab 结构）
- `frontend/src/pages/PanelHub/SubscriptionsMobileView.tsx`（移动端视图）
- `frontend/src/pages/PanelHub/subscriptions.shared.ts`（共享工具）
- `frontend/src/pages/PanelHub/components/SubscriptionViewTabs.tsx`（Tab 导航）
- `frontend/src/pages/PanelHub/components/SubscriptionsDashboard.tsx`（Dashboard）

## 第二步：重命名共享工具文件

将 `subscriptions.shared.ts` 重命名为 `panelhub.shared.ts`：

```bash
cd /Users/manuelm/Workspace/Projects/Nexus/nexus/frontend/src/pages/PanelHub
mv subscriptions.shared.ts panelhub.shared.ts
```

修改内容：
- `SubscriptionView` 类型更新为：`'dashboard' | 'subscriptions' | 'apikeys' | 'credentials' | 'archived'`
- 移除 `per_token` 的 `FIELD_VISIBILITY` 条目
- 移除 `balanceHealth`、`balanceRatio` 函数（已在 `apikeys/apikeys.shared.ts` 中重新实现）
- 保留所有订阅相关工具函数：`isExpiringSoon`、`isExpired`、`cycleHealth`、`cycleProgress`、`formatMoney`、`dueDateLabel`、`monthlySpendTrend`、`categorySpendConverted`、`upcomingDueItems` 等

更新所有引用此文件的 import 路径。

## 第三步：重命名 Tab 导航组件

将 `components/SubscriptionViewTabs.tsx` 重命名为 `components/PanelHubViewTabs.tsx`：

修改内容：
```typescript
const TABS: { key: SubscriptionView; label: string }[] = [
  { key: 'dashboard',     label: '概览' },
  { key: 'subscriptions', label: '订阅' },
  { key: 'apikeys',       label: 'API Keys' },
  { key: 'credentials',   label: '凭据' },
  { key: 'archived',      label: '已归档' },
]
```

Props 扩展：
```typescript
type PanelHubViewTabsProps = {
  view: SubscriptionView  // 或重命名为 PanelHubView
  archivedCount: number
  apiKeyLowBalanceCount?: number
  credentialExpiringCount?: number
  onViewChange: (view: SubscriptionView) => void
}
```

- API Keys Tab：当 `apiKeyLowBalanceCount > 0` 时显示红点（同现在 usage tab 的低余额红点）
- 凭据 Tab：当 `credentialExpiringCount > 0` 时显示红点

## 第四步：增强 Dashboard

将 `components/SubscriptionsDashboard.tsx` 重命名为 `components/PanelHubDashboard.tsx`。

**新增 Props：**
```typescript
type PanelHubDashboardProps = {
  // ...现有 subscription 相关 props 保持不变...
  apiKeys?: ApiKey[]         // API Key 列表
  credentials?: Credential[]  // 凭证列表
}
```

**新增 Dashboard 区域：**

在现有订阅统计下方，新增两个卡片区域：

**a) API Key 状态概览（与订阅统计并排或下方）：**
- 三个数字统计：Active / Exhausted / Disabled 数量
- 总余额：所有 active API Key 的 remainingBalance 求和
- 低余额警告列表（如有）

**b) 凭证到期提醒：**
- 30 天内到期的凭证列表（使用 `isExpiringSoon` 函数过滤）
- 每项显示：platform + label + "还有 N 天到期"
- 空状态："暂无即将到期的凭证"

## 第五步：重组主入口 index.tsx

修改 `frontend/src/pages/PanelHub/index.tsx`：

**新增 Hook 引用：**
```typescript
import { useApiKeys } from './apikeys/useApiKeys'
import { useCredentials } from './credentials/useCredentials'
```

**新增数据获取：**
```typescript
const { apiKeys, isLoading: apiKeysLoading } = useApiKeys()
const { credentials, isLoading: credentialsLoading } = useCredentials()
```

**计算 badge 数量：**
```typescript
const apiKeyLowBalanceCount = (apiKeys ?? []).filter(k =>
  !k.archived && k.lowBalanceNotify && k.remainingBalance != null &&
  k.lowBalanceThreshold != null && k.remainingBalance < k.lowBalanceThreshold
).length

const credentialExpiringCount = (credentials ?? []).filter(c =>
  !c.archived && isExpiringSoon(c, 30)
).length
```

**传递给 Desktop/Mobile 视图。**

## 第六步：重组桌面视图

将 `SubscriptionsDesktopView.tsx` 重命名为 `PanelHubDesktopView.tsx`。

**修改内容：**

1. **标题和副标题：**
   ```tsx
   <h1 className="text-xl font-semibold">Panel Hub</h1>
   <p className="mt-0.5 text-xs text-muted-foreground">所有服务、密钥和凭证，一处掌控。</p>
   ```

2. **Tab 组件替换为 PanelHubViewTabs（5 Tab）**

3. **"新增"按钮逻辑扩展：**
   ```typescript
   const showAddButton = view === 'subscriptions' || view === 'apikeys' || view === 'credentials'
   // 按钮 onClick 根据 view 分发到对应的创建操作
   ```

4. **Tab 内容渲染：**
   ```tsx
   {view === 'dashboard' && <PanelHubDashboard ... apiKeys={apiKeys} credentials={credentials} />}
   {view === 'subscriptions' && ( /* 保持现有 SubscriptionCard 网格不变 */ )}
   {view === 'apikeys' && <ApiKeyTabView onEdit={...} />}
   {view === 'credentials' && <CredentialTabView onEdit={...} />}
   {view === 'archived' && ( /* 归档视图——见下方 */ )}
   ```

5. **归档视图增强：**
   - 查询所有三种类型的归档项：
     - 订阅：`archivedItems.filter(i => i.billingType !== 'per_token')`（实际已无 per_token）
     - API Keys：从 `useApiKeys` 获取 `listArchived` 或 filter `archived=true`
     - Credentials：同上
   - 按类型分组展示，每组一个小标题（"订阅"、"API Keys"、"凭据"）
   - 每种类型用对应的 Card 组件渲染（SubscriptionCard / ApiKeyCard / CredentialCard）
   - 各 Card 传入 `onUnarchive` 回调

## 第七步：重组移动端视图

将 `SubscriptionsMobileView.tsx` 重命名为 `PanelHubMobileView.tsx`。

同步桌面视图的所有修改：5 Tab、API Keys 和 Credentials 的渲染、归档视图增强。

## 第八步：删除旧文件

删除被替代的 per_token 组件：

```bash
cd /Users/manuelm/Workspace/Projects/Nexus/nexus/frontend/src/pages/PanelHub
rm usage/UsageTabView.tsx
rm usage/UsageAccountCreateDialog.tsx
rm usage/useUsageAccounts.ts
rm components/UsageAccountCard.tsx
```

> 注意：`usage/` 目录下 `BalanceTrendChart.tsx` 和 `LedgerHistory.tsx` 已在 Phase 7.7 移到 `components/`，如果 `usage/` 目录为空则也删除。

## 第九步：更新所有 import

全局搜索并更新所有受影响的 import 路径：

```bash
cd /Users/manuelm/Workspace/Projects/Nexus/nexus/frontend/src
grep -r "subscriptions.shared" --include="*.tsx" --include="*.ts" .
grep -r "SubscriptionViewTabs" --include="*.tsx" --include="*.ts" .
grep -r "SubscriptionsDashboard" --include="*.tsx" --include="*.ts" .
grep -r "SubscriptionsDesktopView" --include="*.tsx" --include="*.ts" .
grep -r "SubscriptionsMobileView" --include="*.tsx" --include="*.ts" .
grep -r "UsageTabView\|UsageAccountCard\|useUsageAccounts\|UsageAccountCreateDialog" --include="*.tsx" --include="*.ts" .
```

修复所有断裂的 import。

## 第十步：修改 subscription.api.ts 最终清理

确认 `frontend/src/api/subscription.api.ts` 中已移除所有 per_token 方法（Phase 7.5 应该已处理，此步做最终确认）。

## 第十一步：验证

```bash
cd /Users/manuelm/Workspace/Projects/Nexus/nexus/frontend

# TypeScript 编译
npx tsc --noEmit
# 必须 0 错误

# 构建
pnpm build
# 必须成功

# 启动开发服务器
pnpm dev
```

**浏览器端到端测试清单：**

- [ ] 侧边栏显示 "Panel Hub" + LayoutDashboard 图标
- [ ] 点击进入 /panel-hub 页面
- [ ] **概览 Tab：**
  - [ ] 订阅统计（月支出、分类饼图、到期时间线）正常
  - [ ] API Key 状态概览（active/exhausted/disabled 计数 + 总余额）
  - [ ] 凭证到期提醒列表
- [ ] **订阅 Tab：**
  - [ ] 现有订阅卡片正常展示
  - [ ] 创建/编辑/删除功能正常
  - [ ] 无任何 per_token 相关 UI 残留
- [ ] **API Keys Tab：**
  - [ ] 创建 API Key → 余额同步
  - [ ] 打码展示 → 复制明文
  - [ ] 状态切换（编辑中改 status）
  - [ ] 余额趋势图
  - [ ] 充值/消费 → 流水记录
  - [ ] 手动同步余额
- [ ] **凭据 Tab：**
  - [ ] 创建凭证
  - [ ] 密码打码 → 揭示（5s 自动隐藏）→ 复制
  - [ ] TOTP 验证码实时显示 + 倒计时
  - [ ] 按分类分组展示
  - [ ] 到期警告 badge
- [ ] **已归档 Tab：**
  - [ ] 显示三种类型的归档项
  - [ ] 取消归档功能
- [ ] 旧路由 `/subscriptions` → Panel Hub
- [ ] 旧路由 `/ledger` → Panel Hub
- [ ] 移动端视图正常
- [ ] Tab 上的 badge 红点正常（低余额 / 到期提醒）

**注意事项：**
- 重命名文件时保持 git 的 rename tracking：用 `git mv` 或确保 git 能自动检测
- 删除文件前确认没有其他地方引用
- Dashboard 新增区域的样式要与现有统计区域保持视觉一致
- 归档视图中三种类型如果某类为空，不显示该分组标题
- 确保 `pnpm build` 成功后再提交——build 比 tsc 更严格（包含 bundle 分析）
