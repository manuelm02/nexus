# Phase 7.7 — API Keys Tab 组件提示词

执行计划：`docs/superpowers/plans/2026-06-22-panel-hub-phase7.md`（Phase 7.7 节）  
前置：Phase 7.6 已完成（目录已重命名为 PanelHub，路由已更新）

---

你正在开发 Nexus 项目（路径：`/Users/manuelm/Workspace/Projects/Nexus/nexus`），React 18 + TypeScript + Tailwind CSS v3 + shadcn/ui + TanStack Query。请先阅读 `CLAUDE.md`，再阅读计划文档 Phase 7.7 节。

本阶段目标：实现 API Key 保险箱的完整 UI 组件——卡片、创建/编辑表单、Hook、工具函数。同时将 BalanceTrendChart 和 LedgerHistory 泛化为共用组件。

---

## 第一步：阅读参考文件

请仔细阅读以下文件，理解现有组件结构、TanStack Query 模式、卡片布局、样式风格：

- `frontend/src/pages/PanelHub/components/UsageAccountCard.tsx`（**核心参考**——被替代的 per_token 卡片，布局/交互/样式都要参考）
- `frontend/src/pages/PanelHub/usage/useUsageAccounts.ts`（TanStack Query + mutation 模式）
- `frontend/src/pages/PanelHub/usage/UsageAccountCreateDialog.tsx`（创建表单写法）
- `frontend/src/pages/PanelHub/usage/BalanceTrendChart.tsx`（趋势图组件）
- `frontend/src/pages/PanelHub/usage/LedgerHistory.tsx`（流水组件）
- `frontend/src/pages/PanelHub/subscriptions.shared.ts`（共享工具函数模式）
- `frontend/src/api/apiKey.api.ts`（Phase 7.5 创建的 API 层）
- `frontend/src/types/domain.types.ts`（ApiKey 类型定义）

## 第二步：泛化共用组件

### 2a. 移动并泛化 BalanceTrendChart

将 `frontend/src/pages/PanelHub/usage/BalanceTrendChart.tsx` 移动到 `frontend/src/pages/PanelHub/components/BalanceTrendChart.tsx`。

修改为接受通用 props：
```typescript
type BalanceTrendChartProps = {
  entityId: string
  fetchFn: (id: string, days: number) => Promise<{ balance: number; snapshottedAt: string }[]>
  queryKey: string[]  // 如 ['api-key-balance-history', id]
  days?: number
}
```

移除对 `subscriptionApi.balanceHistory` 的直接依赖。

### 2b. 移动并泛化 LedgerHistory

将 `frontend/src/pages/PanelHub/usage/LedgerHistory.tsx` 移动到 `frontend/src/pages/PanelHub/components/LedgerHistory.tsx`。

修改为接受通用 props：
```typescript
type LedgerHistoryProps = {
  entityId: string
  fetchFn: (id: string, limit: number) => Promise<{ id: string; entryType: string; amount: number; balanceAfter: number; note?: string; occurredOn: string }[]>
  queryKey: string[]
  limit?: number
}
```

## 第三步：创建 apikeys/apikeys.shared.ts

创建 `frontend/src/pages/PanelHub/apikeys/apikeys.shared.ts`：

```typescript
import type { ApiKey } from '../../../types/domain.types'

export type BalanceHealth = 'normal' | 'low' | 'empty'

/** 根据余额和阈值判断健康状态 */
export function balanceHealth(item: ApiKey): BalanceHealth {
  const balance = item.remainingBalance ?? 0
  if (balance <= 0) return 'empty'
  if (item.lowBalanceNotify && item.lowBalanceThreshold && balance < item.lowBalanceThreshold) return 'low'
  return 'normal'
}

/** 余额健康度比率（用于视觉指示器） */
export function balanceRatio(item: ApiKey): number {
  const balance = item.remainingBalance ?? 0
  const full = (item.lowBalanceThreshold ?? 1) * 3
  return Math.min(balance / full, 1)
}

/** Provider 名称到展示色的映射 */
export const PROVIDER_COLORS: Record<string, string> = {
  deepseek: 'bg-blue-100 text-blue-700',
  openai: 'bg-green-100 text-green-700',
  anthropic: 'bg-orange-100 text-orange-700',
  claude: 'bg-purple-100 text-purple-700',
}

/** Status 到展示色的映射 */
export const STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  exhausted: 'bg-red-100 text-red-700',
  disabled: 'bg-gray-100 text-gray-500',
}

export const STATUS_LABELS: Record<string, string> = {
  active: '可用',
  exhausted: '已耗尽',
  disabled: '已禁用',
}
```

## 第四步：创建 apikeys/useApiKeys.ts

创建 `frontend/src/pages/PanelHub/apikeys/useApiKeys.ts`：

参照 `useUsageAccounts.ts` 的模式，实现 TanStack Query hook：

- **Queries：**
  - `useQuery(['api-keys'], apiKeyApi.list)` — API Key 列表
  
- **Mutations：**
  - `createMutation` → `apiKeyApi.create` → invalidate `['api-keys']`
  - `updateMutation` → `apiKeyApi.update` → invalidate `['api-keys']`
  - `deleteMutation` → `apiKeyApi.remove` → invalidate `['api-keys']`
  - `rechargeMutation` → `apiKeyApi.recharge` → invalidate `['api-keys']`
  - `consumeMutation` → `apiKeyApi.consume` → invalidate `['api-keys']`
  - `syncBalanceMutation` → `apiKeyApi.syncBalance` → invalidate `['api-keys']`

- **状态管理：**
  - `syncingId: string | null` — 当前正在同步的 Key ID（显示 spinner）

- **返回值：**
  - `apiKeys`、`isLoading`
  - `create`、`update`、`remove`、`recharge`、`consume`、`syncBalance`（包装后的方法）
  - `syncingId`

## 第五步：创建 apikeys/ApiKeyCard.tsx

创建 `frontend/src/pages/PanelHub/apikeys/ApiKeyCard.tsx`：

参照 `UsageAccountCard.tsx` 的布局和交互模式：

**卡片布局（从上到下）：**

1. **头部行：** provider 徽章（彩色小标签）+ label 名称 + status badge（右对齐）
2. **Key 行：** 打码显示 maskedKey + 复制按钮
   - 点击复制：调用 `apiKeyApi.revealKey(id)` → `navigator.clipboard.writeText(plainKey)` → 短暂显示"已复制"
3. **Base URL 行（如有）：** 文本展示，可复制
4. **套餐行（如有）：** planName + planExpireDate（到期前30天显示 warning 色）
5. **余额行：** remainingBalance（按健康状态着色） + monthlySpend
6. **余额趋势图（apiFetchEnabled=true）：** 嵌入泛化后的 `<BalanceTrendChart />`，传入 `apiKeyApi.balanceHistory` 作为 fetchFn
7. **同步按钮（apiFetchEnabled=true）：** "刷新余额"按钮 + 最后同步时间
8. **充值/消费行：** 两个内联输入框 + 按钮（参照 UsageAccountCard 的写法）
9. **折叠流水：** 嵌入泛化后的 `<LedgerHistory />`，传入 `apiKeyApi.ledger` 作为 fetchFn
10. **底部操作栏：** 编辑 / 归档 / 删除

**Props：**
```typescript
type ApiKeyCardProps = {
  item: ApiKey
  deleting: boolean
  syncing: boolean
  onEdit: (item: ApiKey) => void
  onDelete: (id: string) => void
  onUnarchive?: (id: string) => void
  onRecharge: (id: string, amount: number, note?: string) => void
  onConsume: (id: string, amount: number, note?: string) => void
  onSyncBalance: (id: string) => void
}
```

## 第六步：创建 apikeys/ApiKeyFormDialog.tsx

创建 `frontend/src/pages/PanelHub/apikeys/ApiKeyFormDialog.tsx`：

使用 Radix Dialog（或项目现有的 Dialog 组件），支持创建和编辑两种模式：

**表单字段：**
1. Provider — Select 下拉（选项：DeepSeek / OpenAI / Anthropic / Claude / 其他）
2. 标签 (label) — 文本输入
3. API Key — Password 输入
   - 创建模式：必填，placeholder "输入 API Key"
   - 编辑模式：可选，placeholder "留空表示不修改"，显示当前 maskedKey
4. Base URL — 文本输入（可选）
5. 套餐名称 (planName) — 文本输入（可选）
6. 套餐到期日 (planExpireDate) — 日期选择（可选）
7. 低余额预警 — Switch 开关 + 阈值输入框（switch 开启后显示）
8. 关联订阅 (subscriptionId) — Select 下拉（可选，选项从订阅列表获取）
9. 备注 (notes) — Textarea（可选）

**提交按钮文案：**
- 创建模式 + Provider 支持余额查询 → "创建并同步余额"
- 创建模式 + Provider 不支持 → "创建"
- 编辑模式 → "保存"

## 第七步：创建 apikeys/ApiKeyTabView.tsx

创建 `frontend/src/pages/PanelHub/apikeys/ApiKeyTabView.tsx`：

```typescript
type ApiKeyTabViewProps = {
  onEdit: (item: ApiKey) => void
}
```

- 顶部显示 API Key 数量
- 使用 `useApiKeys()` hook 获取数据
- 卡片网格布局（`grid gap-3 lg:grid-cols-2`）
- 创建按钮 → 打开 ApiKeyFormDialog
- 空状态提示

## 第八步：验证

```bash
cd /Users/manuelm/Workspace/Projects/Nexus/nexus/frontend

# TypeScript 检查
npx tsc --noEmit

# 启动并在浏览器测试（确保后端也在运行）
pnpm dev

# 测试：
# 1. 暂时手动在 SubscriptionsDesktopView.tsx 中引入 ApiKeyTabView 替换 usage tab，确认渲染正常
# 2. 创建一个 DeepSeek API Key → 验证余额同步
# 3. 打码展示 → 点击复制 → 剪贴板中是明文 Key
# 4. 充值/消费 → 流水记录展示
# 5. 余额趋势图正常（需要有 2+ 个 snapshot 数据点）
```

**注意事项：**
- 复制到剪贴板后需要短暂的 toast 或文字反馈（如按钮文字变为"已复制"1.5秒后恢复）
- Status badge 的颜色：active=绿色、exhausted=红色、disabled=灰色
- Provider badge 的颜色：每个 provider 不同色系（见 PROVIDER_COLORS）
- 日期展示用相对时间（如"3小时前同步"），使用项目已有的日期格式化工具
- 每个导出组件顶部一行注释说明用途（CLAUDE.md 要求）
