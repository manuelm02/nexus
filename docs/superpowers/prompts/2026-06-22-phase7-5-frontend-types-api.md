# Phase 7.5 — 前端 Types + API 层提示词

执行计划：`docs/superpowers/plans/2026-06-22-panel-hub-phase7.md`（Phase 7.5 节）  
前置：Phase 7.4 已完成（后端全部就绪，per_token 逻辑已清理）

---

你正在开发 Nexus 项目（路径：`/Users/manuelm/Workspace/Projects/Nexus/nexus`），React 18 + TypeScript + TanStack Query 前端。请先阅读 `CLAUDE.md`，再阅读计划文档 Phase 7.5 节。

本阶段目标：新建 API Key 和 Credential 的 TypeScript 类型定义和 API 调用层，同时清理 Subscription 类型中的 per_token 字段。**不涉及任何 UI 组件。**

---

## 第一步：阅读参考文件

- `frontend/src/types/domain.types.ts`（现有 Subscription 接口定义）
- `frontend/src/api/subscription.api.ts`（API 调用风格和模式）
- `frontend/src/lib/client.ts`（HTTP client，了解请求拦截和 token 刷新机制）

## 第二步：修改 domain.types.ts

在 `frontend/src/types/domain.types.ts` 中：

**新增 ApiKey 接口：**
```typescript
export interface ApiKey {
  id: string
  label: string
  provider: string
  maskedKey: string
  baseUrl?: string
  status: 'active' | 'exhausted' | 'disabled'
  planName?: string
  planExpireDate?: string
  subscriptionId?: string
  remainingBalance?: number
  monthlySpend: number
  lowBalanceNotify: boolean
  lowBalanceThreshold?: number
  apiFetchEnabled: boolean
  apiLastFetchedAt?: string
  apiBalanceJson?: Record<string, unknown> | null
  notes?: string
  archived: boolean
  createdAt: string
  updatedAt: string
}
```

**新增 ApiKeyLedgerEntry 接口：**
```typescript
export interface ApiKeyLedgerEntry {
  id: string
  apiKeyId: string
  entryType: 'recharge' | 'consume'
  amount: number
  balanceAfter: number
  note?: string
  occurredOn: string
  createdAt: string
}
```

**新增 ApiKeyBalanceSnapshot 接口：**
```typescript
export interface ApiKeyBalanceSnapshot {
  id: string
  apiKeyId: string
  balance: number
  currency: string
  rawJson?: Record<string, unknown>
  snapshottedAt: string
}
```

**新增 Credential 接口：**
```typescript
export interface Credential {
  id: string
  platform: string
  label?: string
  category?: string
  username?: string
  passwordSet: boolean
  totpSet: boolean
  url?: string
  expireDate?: string
  subscriptionId?: string
  notes?: string
  archived: boolean
  createdAt: string
  updatedAt: string
}
```

**从 Subscription 接口中移除 per_token 字段：**
- 移除：`remainingBalance`、`monthlySpend`、`lowBalanceNotify`、`lowBalanceThreshold`、`apiProvider`、`apiFetchEnabled`、`apiLastFetchedAt`、`apiBalanceJson`

## 第三步：新建 apiKey.api.ts

创建 `frontend/src/api/apiKey.api.ts`，参照 `subscription.api.ts` 的风格：

```typescript
import { client } from '../lib/client'
import type { ApiKey, ApiKeyLedgerEntry, ApiKeyBalanceSnapshot } from '../types/domain.types'

const BASE = '/api/v1/api-keys'

export const apiKeyApi = {
  list: () =>
    client.get<ApiKey[]>(BASE),

  create: (data: {
    label: string
    provider: string
    apiKey: string
    baseUrl?: string
    planName?: string
    planExpireDate?: string
    subscriptionId?: string
    lowBalanceNotify?: boolean
    lowBalanceThreshold?: number
    notes?: string
  }) =>
    client.post<ApiKey>(BASE, data),

  update: (id: string, data: Record<string, unknown>) =>
    client.patch<ApiKey>(`${BASE}/${id}`, data),

  remove: (id: string) =>
    client.delete(`${BASE}/${id}`),

  recharge: (id: string, data: { amount: number; date?: string; note?: string }) =>
    client.post<ApiKey>(`${BASE}/${id}/recharge`, data),

  consume: (id: string, data: { amount: number; note?: string }) =>
    client.post<ApiKey>(`${BASE}/${id}/consume`, data),

  syncBalance: (id: string) =>
    client.post<ApiKey>(`${BASE}/${id}/sync-balance`),

  ledger: (id: string, limit = 20) =>
    client.get<ApiKeyLedgerEntry[]>(`${BASE}/${id}/ledger`, { params: { limit } }),

  balanceHistory: (id: string, days = 30) =>
    client.get<ApiKeyBalanceSnapshot[]>(`${BASE}/${id}/balance-history`, { params: { days } }),

  revealKey: (id: string) =>
    client.post<string>(`${BASE}/${id}/reveal-key`),
}
```

> 注意：`client.get/post/patch/delete` 的具体写法需要匹配项目中 `client.ts` 的导出方式。阅读 `subscription.api.ts` 确认实际调用模式（可能是 `client.get(url).then(r => r.data.data)` 或其他模式）。

## 第四步：新建 credential.api.ts

创建 `frontend/src/api/credential.api.ts`：

```typescript
import { client } from '../lib/client'
import type { Credential } from '../types/domain.types'

const BASE = '/api/v1/credentials'

export const credentialApi = {
  list: () =>
    client.get<Credential[]>(BASE),

  create: (data: {
    platform: string
    label?: string
    category?: string
    username?: string
    password?: string
    totpSecret?: string
    url?: string
    expireDate?: string
    subscriptionId?: string
    notes?: string
  }) =>
    client.post<Credential>(BASE, data),

  update: (id: string, data: Record<string, unknown>) =>
    client.patch<Credential>(`${BASE}/${id}`, data),

  remove: (id: string) =>
    client.delete(`${BASE}/${id}`),

  revealPassword: (id: string) =>
    client.post<string>(`${BASE}/${id}/reveal-password`),

  revealTotp: (id: string) =>
    client.post<string>(`${BASE}/${id}/reveal-totp`),
}
```

## 第五步：修改 subscription.api.ts

从 `frontend/src/api/subscription.api.ts` 中移除以下方法（这些功能已迁移到 apiKey.api.ts）：

- `createUsageAccount()` — per_token 创建
- `recharge()` — 充值
- `consume()` — 消费
- `syncBalance()` — 余额同步
- `balanceHistory()` — 余额快照
- `ledger()` — 流水记录

保留：`list`、`create`、`update`、`remove`、`stats`、`updateUsage`、`suggestCategory`、`exchangeRates`

## 第六步：验证

```bash
cd frontend && npx tsc --noEmit
# 确认 TypeScript 编译通过，无类型错误
# 注意：如果现有组件引用了已删除的 Subscription 字段或 API 方法，会报错
# 这些编译错误是预期的——它们会在 Phase 7.6~7.9 修复
# 此处只需确认新建的 api 文件和 types 本身没有语法错误
```

**注意事项：**
- API 调用方法的返回类型需要匹配 `client.ts` 的响应包装结构（后端统一返回 `{ success, data, message, errorCode }`，前端通常取 `res.data.data`）
- 仔细对照 `subscription.api.ts` 中的实际调用模式来写，不要凭空猜测
- `revealKey` 和 `revealPassword` 返回的是 `string`（包在 ApiResponse 中），注意解包方式
- 类型文件中不要加 `export default`，用命名导出
