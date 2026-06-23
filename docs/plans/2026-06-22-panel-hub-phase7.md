# Phase 7：Panel Hub — 执行计划

> 创建日期：2026-06-22  
> 分支：`panel-hub`（从 `mindbank` 切出）  
> 前置依赖：Phase 6 Mindbank 已完成（V1_19 已存在）

---

## 0. 基础信息与约定

### 背景

用户的 API Key、账号密码散落在多个平台，找不到、管不住、看不清状态。现有 Subscriptions 页面已有订阅管理和 per_token 用量面板，但 subscription 实体同时承载订阅和 API Key 管理，职责混杂。

### 目标

将 Subscriptions 页面重构为 **Panel Hub**——集中管理订阅信息、API Key、账号密码的统一面板，为未来 API 转发网关打好架构基础。

### 已确认决策

| 决策项 | 结论 |
|--------|------|
| 页面名 | Panel Hub |
| 路由 | `/panel-hub`（保留 `/subscriptions`、`/ledger` 别名） |
| 数据模型 | 拆分实体——新建 `api_keys` + `credentials` 表，subscription 表只管订阅 |
| Credentials 功能 | 增强版：分类标签、到期提醒、关联订阅、TOTP 2FA 密钥存储 |
| per_token 迁移 | 开发期可清空重来，不影响其他表数据 |

### Flyway 起始版本：V1_20

### Tab 结构（5 个）

| Tab | Key | 说明 |
|-----|-----|------|
| 概览 | `dashboard` | 现有订阅统计 + API Key 状态概览 + 凭证到期提醒 |
| 订阅 | `subscriptions` | 保留现有卡片网格（monthly/yearly/one_time/lifetime） |
| API Keys | `apikeys` | **新增** — API Key 保险箱 |
| 凭据 | `credentials` | **新增** — 账号密码管理 |
| 已归档 | `archived` | 展示三种类型的归档项 |

### npm 依赖变更

```bash
pnpm add otpauth    # TOTP 客户端验证码计算
```

---

## Phase 7.1：数据库迁移

### 目标
新建 `api_keys`、`credentials`、`api_key_ledger_entries`、`api_key_balance_snapshots` 四张表，清理现有 per_token 数据。

### 新建文件
- `backend/src/main/resources/db/migration/V1_20__panel_hub_api_keys_and_credentials.sql`

### 表结构

#### api_keys
```sql
CREATE TABLE api_keys (
    id                    VARCHAR(36)   PRIMARY KEY,
    label                 VARCHAR(100)  NOT NULL,
    provider              VARCHAR(50)   NOT NULL,
    encrypted_key         TEXT          NOT NULL,
    base_url              VARCHAR(500),
    status                VARCHAR(20)   NOT NULL DEFAULT 'active',
    plan_name             VARCHAR(100),
    plan_expire_date      DATE,
    subscription_id       VARCHAR(36)   REFERENCES subscriptions(id) ON DELETE SET NULL,
    remaining_balance     NUMERIC(12,2),
    monthly_spend         NUMERIC(12,2) NOT NULL DEFAULT 0,
    low_balance_notify    BOOLEAN       NOT NULL DEFAULT false,
    low_balance_threshold NUMERIC(12,2),
    api_fetch_enabled     BOOLEAN       NOT NULL DEFAULT false,
    api_last_fetched_at   TIMESTAMP,
    api_balance_json      JSONB,
    notes                 TEXT,
    archived              BOOLEAN       NOT NULL DEFAULT false,
    created_at            TIMESTAMP     NOT NULL DEFAULT now(),
    updated_at            TIMESTAMP     NOT NULL DEFAULT now()
);
```

#### credentials
```sql
CREATE TABLE credentials (
    id                    VARCHAR(36)   PRIMARY KEY,
    platform              VARCHAR(100)  NOT NULL,
    label                 VARCHAR(100),
    category              VARCHAR(50),
    username              VARCHAR(200),
    encrypted_password    TEXT,
    encrypted_totp_secret TEXT,
    url                   VARCHAR(500),
    expire_date           DATE,
    subscription_id       VARCHAR(36)   REFERENCES subscriptions(id) ON DELETE SET NULL,
    notes                 TEXT,
    archived              BOOLEAN       NOT NULL DEFAULT false,
    created_at            TIMESTAMP     NOT NULL DEFAULT now(),
    updated_at            TIMESTAMP     NOT NULL DEFAULT now()
);
```

#### api_key_ledger_entries
```sql
CREATE TABLE api_key_ledger_entries (
    id            VARCHAR(36)   PRIMARY KEY,
    api_key_id    VARCHAR(36)   NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
    entry_type    VARCHAR(16)   NOT NULL,
    amount        NUMERIC(12,2) NOT NULL,
    balance_after NUMERIC(12,2) NOT NULL,
    note          VARCHAR(255),
    occurred_on   DATE          NOT NULL,
    created_at    TIMESTAMP     NOT NULL DEFAULT now()
);
CREATE INDEX idx_api_key_ledger_api_key ON api_key_ledger_entries (api_key_id, created_at DESC);
```

#### api_key_balance_snapshots
```sql
CREATE TABLE api_key_balance_snapshots (
    id             VARCHAR(36)   PRIMARY KEY,
    api_key_id     VARCHAR(36)   NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
    balance        NUMERIC(12,2) NOT NULL,
    currency       VARCHAR(8)    NOT NULL,
    raw_json       JSONB,
    snapshotted_at TIMESTAMP     NOT NULL DEFAULT now()
);
CREATE INDEX idx_api_key_balance_api_key ON api_key_balance_snapshots (api_key_id, snapshotted_at DESC);
```

#### 清理 per_token 数据
```sql
DELETE FROM subscription_balance_snapshots WHERE subscription_id IN
    (SELECT id FROM subscriptions WHERE billing_type = 'per_token');
DELETE FROM subscription_ledger_entries WHERE subscription_id IN
    (SELECT id FROM subscriptions WHERE billing_type = 'per_token');
DELETE FROM subscriptions WHERE billing_type = 'per_token';
```

### 验证
```bash
mise exec java@21 -- mvn spring-boot:run -Dspring-boot.run.profiles=local
# 确认 V1_20 migration applied，4 张新表创建，per_token 数据清除
```

---

## Phase 7.2：后端实体 + Mapper + DTO

### 目标
创建 ApiKey、Credential 及其关联的 Java 实体类、MyBatis-Plus Mapper 接口、请求/响应 DTO。

### 新建文件（16 个）

**实体（4 个）：**
- `backend/src/main/java/com/nexus/entity/ApiKey.java`
- `backend/src/main/java/com/nexus/entity/Credential.java`
- `backend/src/main/java/com/nexus/entity/ApiKeyLedgerEntry.java`
- `backend/src/main/java/com/nexus/entity/ApiKeyBalanceSnapshot.java`

**Mapper（4 个）：**
- `backend/src/main/java/com/nexus/mapper/ApiKeyMapper.java`
- `backend/src/main/java/com/nexus/mapper/CredentialMapper.java`
- `backend/src/main/java/com/nexus/mapper/ApiKeyLedgerEntryMapper.java`
- `backend/src/main/java/com/nexus/mapper/ApiKeyBalanceSnapshotMapper.java`

**DTO Request（6 个）：**
- `ApiKeyCreateRequest` — @NotBlank: label, provider, apiKey(明文)
- `ApiKeyUpdateRequest` — 全部 nullable（PATCH 语义）
- `ApiKeyRechargeRequest` — amount + date + note
- `ApiKeyConsumeRequest` — amount + note
- `CredentialCreateRequest` — @NotBlank: platform
- `CredentialUpdateRequest` — 全部 nullable

**DTO Response（2 个）：**
- `ApiKeyResponse` — 不暴露 encryptedKey，提供 maskedKey（如 `sk-abc...wxyz`）
- `CredentialResponse` — 不暴露加密字段，提供 passwordSet/totpSet boolean 标志

### 关键约束

- boolean 不用 `isXxx` 命名 + `@TableField("column_name")` 显式指定
- JSONB 字段用 `@TableField(typeHandler = JsonbTypeHandler.class)` + `@TableName(autoResultMap = true)`
- `createdAt` → `@TableField(fill = FieldFill.INSERT)`，`updatedAt` → `@TableField(fill = FieldFill.INSERT_UPDATE)`

### 验证
```bash
mise exec java@21 -- mvn -q -pl backend compile
```

---

## Phase 7.3：后端 Service + Controller

### 目标
实现 ApiKey 和 Credential 的业务逻辑层和 REST API 层。

### 新建文件（4 个）

- `backend/src/main/java/com/nexus/service/ApiKeyService.java`
- `backend/src/main/java/com/nexus/service/CredentialService.java`
- `backend/src/main/java/com/nexus/controller/ApiKeyController.java`（`/api/v1/api-keys`）
- `backend/src/main/java/com/nexus/controller/CredentialController.java`（`/api/v1/credentials`）

### ApiKeyService 方法

| 方法 | 说明 |
|------|------|
| `list()` | 所有非归档，createdAt DESC |
| `listArchived()` | 所有已归档 |
| `create(ApiKeyCreateRequest)` | 加密 Key → 可选余额同步 → 保存（@Transactional） |
| `update(id, ApiKeyUpdateRequest)` | PATCH 语义，Key 若更新则重新加密 |
| `delete(id)` | 硬删除 |
| `recharge(id, req)` | 写 ledger + 更新余额（apiFetchEnabled=true 时仅写 ledger） |
| `consume(id, req)` | 写 ledger + 更新余额 + monthlySpend |
| `syncBalance(id)` | 解密 Key → Provider Client → 更新余额 + snapshot |
| `syncAllEnabledBalances()` | 批量同步 |
| `getLedger(id, limit)` | 最近 N 条流水 |
| `getBalanceHistory(id, days)` | 最近 N 天快照 |
| `findLowBalance()` | 低余额告警项 |
| `resetMonthlySpend()` | 月初重置 |
| `revealKey(id)` | 解密返回明文（一键复制用） |

### CredentialService 方法

| 方法 | 说明 |
|------|------|
| `list()` / `listArchived()` | 列表 |
| `create(req)` | 加密 password + totpSecret → 保存 |
| `update(id, req)` | PATCH 语义 |
| `delete(id)` | 硬删除 |
| `revealPassword(id)` | 解密明文密码 |
| `revealTotpSecret(id)` | 解密明文 TOTP 密钥 |
| `findExpiringPasswords(daysAhead)` | N 天内到期凭证 |

### API 端点

**ApiKeyController — `/api/v1/api-keys`**

| Method | Path | 说明 |
|--------|------|------|
| GET | `/` | 列表 |
| POST | `/` | 创建 |
| PATCH | `/{id}` | 更新 |
| DELETE | `/{id}` | 删除 |
| POST | `/{id}/recharge` | 充值 |
| POST | `/{id}/consume` | 消费 |
| POST | `/{id}/sync-balance` | 同步余额 |
| GET | `/{id}/ledger` | 流水（?limit=20） |
| GET | `/{id}/balance-history` | 快照（?days=30） |
| POST | `/{id}/reveal-key` | 解密返回明文 |

**CredentialController — `/api/v1/credentials`**

| Method | Path | 说明 |
|--------|------|------|
| GET | `/` | 列表 |
| POST | `/` | 创建 |
| PATCH | `/{id}` | 更新 |
| DELETE | `/{id}` | 删除 |
| POST | `/{id}/reveal-password` | 解密密码 |
| POST | `/{id}/reveal-totp` | 解密 TOTP |

### 验证
```bash
mise exec java@21 -- mvn spring-boot:run -Dspring-boot.run.profiles=local
# 用 curl 或 Postman 测试：
# POST /api/v1/api-keys 创建 → GET 列表 → POST reveal-key
# POST /api/v1/credentials 创建 → POST reveal-password
```

---

## Phase 7.4：后端重构（移除 per_token 逻辑）

### 目标
从 Subscription 相关代码中清理 per_token 逻辑，将 Scheduler 切换到 ApiKeyService。

### 修改文件

| 文件 | 变更 |
|------|------|
| `SubscriptionService.java` | 移除 recharge/consume/syncBalance/writeLedgerEntry/getLedger/findLowBalance/resetMonthlySpend 等方法；移除 DeepSeekBalanceClient 注入；create() 移除 apiProvider/apiKey 处理 |
| `SubscriptionController.java` | 移除 recharge/consume/ledger/syncBalance/balanceHistory 端点 |
| `SubscriptionNotifyScheduler.java` | 注入 ApiKeyService + CredentialService；syncApiBalances/resetMonthlySpend/checkLowBalance 改调 apiKeyService；新增 checkCredentialExpiry + checkApiKeyPlanExpiry |
| `SubscriptionCreateRequest.java` | 移除 apiProvider、apiKey 字段 |
| `SubscriptionResponse.java` | 移除 per_token 相关字段 |

### 删除文件
- `SubscriptionRechargeRequest.java`
- `SubscriptionConsumeRequest.java`

### 验证
```bash
mise exec java@21 -- mvn -q -pl backend compile
# 确保现有订阅 CRUD 不受影响
```

---

## Phase 7.5：前端 Types + API 层

### 目标
新建 TypeScript 类型定义和 API 调用层。

### 文件变更

**新建：**
- `frontend/src/api/apiKey.api.ts`
- `frontend/src/api/credential.api.ts`

**修改：**
- `frontend/src/types/domain.types.ts` — 新增 ApiKey、Credential 接口；从 Subscription 移除 per_token 字段
- `frontend/src/api/subscription.api.ts` — 移除 per_token 相关方法

### 验证
```bash
cd frontend && npx tsc --noEmit
```

---

## Phase 7.6：目录重命名 + 路由更新

### 目标
将 Subscriptions 页面目录重命名为 PanelHub，更新路由和导航。

### 文件变更

| 操作 | 文件 |
|------|------|
| 重命名 | `pages/Subscriptions/` → `pages/PanelHub/` |
| 修改 | `router.tsx` — 新增 `panel-hub` 路由，保留别名 |
| 修改 | `lib/constants.ts` — NAV_ITEMS 改为 Panel Hub + LayoutDashboard 图标 |
| 修改 | `components/layout/Sidebar.tsx` — 图标映射加入 LayoutDashboard |
| 修改 | `components/layout/MobileNav.tsx` — 同步更新图标映射 |

### 验证
```bash
cd frontend && pnpm dev
# 访问 /panel-hub 和 /subscriptions，确认都能正常加载
```

---

## Phase 7.7：API Keys Tab 组件

### 目标
实现 API Key 保险箱的完整 UI。

### 新建文件
- `pages/PanelHub/apikeys/apikeys.shared.ts` — balanceHealth / balanceRatio 工具函数
- `pages/PanelHub/apikeys/useApiKeys.ts` — TanStack Query hook
- `pages/PanelHub/apikeys/ApiKeyTabView.tsx` — Tab 主视图
- `pages/PanelHub/apikeys/ApiKeyCard.tsx` — 卡片组件
- `pages/PanelHub/apikeys/ApiKeyFormDialog.tsx` — 创建/编辑表单

### 修改文件（泛化共用组件）
- `usage/BalanceTrendChart.tsx` → 移到 `components/BalanceTrendChart.tsx`，泛化 props
- `usage/LedgerHistory.tsx` → 移到 `components/LedgerHistory.tsx`，泛化 props

### ApiKeyCard 布局
```
┌─────────────────────────────────────────────┐
│  [DeepSeek]  opencode 账号 A          [active] │
│  Key:  sk-abc...wxyz  [📋 复制]              │
│  URL:  https://api.deepseek.com              │
│  套餐: Pro Plan $20/mo  到期 2024-12-31      │
│  余额: ¥ 128.50    本月消耗: ¥ 32.00        │
│  ──────── 余额趋势 ────────                  │
│  ┌─ 充值 ─┐  ┌─ 消费 ─┐                      │
│  ▸ 查看流水                                   │
│  [编辑] [归档] [删除]                         │
└─────────────────────────────────────────────┘
```

### 验证
```bash
pnpm dev
# API Keys Tab → 创建 Key → 打码展示 → 复制 → 余额同步 → 充值/消费 → 流水
```

---

## Phase 7.8：Credentials Tab 组件

### 目标
实现账号密码管理的完整 UI。

### 前置
```bash
cd frontend && pnpm add otpauth
```

### 新建文件
- `pages/PanelHub/credentials/credentials.shared.ts` — 到期判断 / 分类分组
- `pages/PanelHub/credentials/useCredentials.ts` — TanStack Query hook
- `pages/PanelHub/credentials/CredentialTabView.tsx` — Tab 主视图（按分类分组）
- `pages/PanelHub/credentials/CredentialCard.tsx` — 卡片组件
- `pages/PanelHub/credentials/CredentialFormDialog.tsx` — 创建/编辑表单

### CredentialCard 布局
```
┌─────────────────────────────────────────────┐
│  [GitHub]  工作账号                    [⚠ 30天] │
│  用户名:  manuelm@example.com   [📋]         │
│  密码:    ••••••••••            [👁] [📋]     │
│  2FA:     384 521              (29s)          │
│  URL:  https://github.com/login              │
│  分类:  开发工具                              │
│  [编辑] [归档] [删除]                         │
└─────────────────────────────────────────────┘
```

### 验证
```bash
pnpm dev
# Credentials Tab → 创建凭证 → 密码打码/揭示/复制 → TOTP 验证码显示 → 分类分组
```

---

## Phase 7.9：主页面重组 + Dashboard 增强 + 归档

### 目标
将 5 个 Tab 组装到 Panel Hub 主页面，增强 Dashboard 和归档视图，清理旧文件。

### 文件重命名/修改

| 旧文件 | 新文件 |
|--------|--------|
| `subscriptions.shared.ts` | `panelhub.shared.ts` |
| `SubscriptionViewTabs.tsx` | `PanelHubViewTabs.tsx`（5 Tab） |
| `SubscriptionsDashboard.tsx` | `PanelHubDashboard.tsx`（新增 API Key 状态 + 凭证到期） |
| `SubscriptionsDesktopView.tsx` | `PanelHubDesktopView.tsx` |
| `SubscriptionsMobileView.tsx` | `PanelHubMobileView.tsx` |
| `index.tsx` | 重构，引入 useApiKeys + useCredentials |

### 删除文件（被替代的 per_token 组件）
- `usage/UsageTabView.tsx`
- `usage/UsageAccountCreateDialog.tsx`
- `usage/useUsageAccounts.ts`
- `components/UsageAccountCard.tsx`

### 验证
```bash
pnpm build
mise exec java@21 -- mvn -q -pl backend compile
# 端到端验证清单见下方
```

---

## 端到端验证（Phase 7.9 完成后）

### 后端
```bash
mise exec java@21 -- mvn spring-boot:run -Dspring-boot.run.profiles=local
```
- [ ] V1_20 迁移成功
- [ ] `POST /api/v1/api-keys` 创建 → 加密存储 + 余额同步
- [ ] `POST /api/v1/api-keys/{id}/reveal-key` → 返回明文
- [ ] `POST /api/v1/api-keys/{id}/recharge` + `consume` → ledger 写入
- [ ] `POST /api/v1/credentials` → 密码/TOTP 加密存储
- [ ] `POST /api/v1/credentials/{id}/reveal-password` → 返回明文
- [ ] 现有 `/api/v1/subscriptions` CRUD 不受影响

### 前端
```bash
cd frontend && pnpm dev
```
- [ ] 侧边栏显示 "Panel Hub" + LayoutDashboard 图标
- [ ] 5 个 Tab 切换正常
- [ ] 订阅 Tab：功能不变
- [ ] API Keys Tab：创建/打码/复制/状态/同步/充值/消费/流水
- [ ] Credentials Tab：创建/密码揭示复制/TOTP 实时码/分类分组/到期警告
- [ ] Dashboard：三种类型统计
- [ ] 已归档：三种类型归档项
- [ ] `/subscriptions` 和 `/ledger` 别名路由正常

---

## 文件改动总览

### 新建（约 31 个）

**后端（21 个）：**
```
db/migration/V1_20__panel_hub_api_keys_and_credentials.sql
entity/ApiKey.java, Credential.java, ApiKeyLedgerEntry.java, ApiKeyBalanceSnapshot.java
mapper/ApiKeyMapper.java, CredentialMapper.java, ApiKeyLedgerEntryMapper.java, ApiKeyBalanceSnapshotMapper.java
dto/request/ApiKeyCreateRequest.java, ApiKeyUpdateRequest.java, ApiKeyRechargeRequest.java, ApiKeyConsumeRequest.java
dto/request/CredentialCreateRequest.java, CredentialUpdateRequest.java
dto/response/ApiKeyResponse.java, CredentialResponse.java
service/ApiKeyService.java, CredentialService.java
controller/ApiKeyController.java, CredentialController.java
```

**前端（10 个）：**
```
api/apiKey.api.ts, credential.api.ts
pages/PanelHub/apikeys/apikeys.shared.ts, useApiKeys.ts, ApiKeyTabView.tsx, ApiKeyCard.tsx, ApiKeyFormDialog.tsx
pages/PanelHub/credentials/credentials.shared.ts, useCredentials.ts, CredentialTabView.tsx, CredentialCard.tsx, CredentialFormDialog.tsx
```

### 修改（约 15 个）

**后端（5 个）：** SubscriptionService, SubscriptionController, SubscriptionNotifyScheduler, SubscriptionCreateRequest, SubscriptionResponse

**前端（10 个）：** domain.types.ts, subscription.api.ts, router.tsx, constants.ts, Sidebar.tsx, MobileNav.tsx, index.tsx, panelhub.shared.ts, PanelHubDesktopView.tsx, PanelHubMobileView.tsx, PanelHubViewTabs.tsx, PanelHubDashboard.tsx, BalanceTrendChart.tsx, LedgerHistory.tsx

### 删除（6 个）

**后端（2 个）：** SubscriptionRechargeRequest, SubscriptionConsumeRequest

**前端（4 个）：** UsageTabView, UsageAccountCreateDialog, useUsageAccounts, UsageAccountCard

---

## 建议 Commit 粒度

| # | Commit | Phase |
|---|--------|-------|
| 1 | `feat: Panel Hub 数据库迁移 — api_keys + credentials 表 (V1_20)` | 7.1 |
| 2 | `feat: ApiKey/Credential 后端实体、Mapper、DTO` | 7.2 |
| 3 | `feat: ApiKeyService + CredentialService 业务逻辑` | 7.3 |
| 4 | `feat: ApiKeyController + CredentialController REST API` | 7.3 |
| 5 | `refactor: 从 Subscription 移除 per_token 逻辑` | 7.4 |
| 6 | `refactor: 更新 Scheduler 支持 API Key / Credential 监控` | 7.4 |
| 7 | `feat: 前端 API Key + Credential 类型定义和 API 层` | 7.5 |
| 8 | `refactor: Subscriptions 页面重命名为 Panel Hub + 路由更新` | 7.6 |
| 9 | `feat: API Keys Tab — 保险箱 UI 组件` | 7.7 |
| 10 | `feat: Credentials Tab — 账号密码管理 UI 组件` | 7.8 |
| 11 | `feat: Panel Hub 主页面重组 + Dashboard 增强 + 归档视图` | 7.9 |
| 12 | `chore: 清理 per_token 遗留文件和组件` | 7.9 |
