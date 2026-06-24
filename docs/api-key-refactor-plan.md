# API Key 分类重构执行方案

> 将 API Key 管理从"一种卡片、一套逻辑"拆分为两种计费类型：按量计费（pay_as_you_go）和 套餐型（plan_based），各自拥有独立的展示卡片和业务逻辑。

---

## 一、目标与需求

### 1.1 两种计费类型

| 维度 | 按量计费 (pay_as_you_go) | 套餐型 (plan_based) |
|------|:---:|:---:|
| 典型代表 | DeepSeek | OpenCode GO、百炼、方舟 |
| API Key 存储 | ✅ 加密存储 | ✅ 加密存储 |
| 余额追踪 | ✅ Provider API 同步 | ❌ 无 |
| 手动充值 | ✅ 仅充值 | ❌ 无 |
| 手动消费 | ❌ 删除（消费由公式计算） | ❌ 无 |
| 当月消费 | ✅ 自动计算 | ❌ 无 |
| 余额趋势图 | ✅ | ❌ |
| 充值流水 | ✅ 仅 recharge | ❌ |
| 低余额预警 | ✅ | ❌ |
| 套餐到期提醒 | 可选 | ✅ 核心 |
| 关联订阅 | 可选 | 可选 |

### 1.2 当月消费计算公式

```
当月消费 = 月初余额 + 当月充值总额 - 当前余额
```

- **月初余额**：每月 1 号由定时任务快照 `remaining_balance → month_start_balance`
- **当月充值总额**：从 `api_key_ledger_entries` 中查询本月 `entry_type = 'recharge'` 的 SUM
- **当前余额**：`remaining_balance`，由 DeepSeek API 同步
- 如果计算结果为负数，说明有未记录的充值（用户直接在 DeepSeek 平台充值），前端应提示

### 1.3 UI 布局

```
┌─────────────────────────────────────────────────────┐
│  按量计费 (占满一行, 置顶)                             │
│  ┌─────────────────────────────────────────────────┐ │
│  │ DeepSeek  余额: 31.11  当月消费: 12.50          │ │
│  │ [趋势图]                                        │ │
│  │ [充值入口] [充值流水]                             │ │
│  └─────────────────────────────────────────────────┘ │
│                                                      │
│  套餐型 (两列网格, 在下方)                             │
│  ┌────────────────────┐  ┌────────────────────┐      │
│  │ OpenCode GO         │  │ 百炼 Pro            │      │
│  │ 到期: 2026-12-31   │  │ 到期: 2026-08-15   │      │
│  └────────────────────┘  └────────────────────┘      │
│  ┌────────────────────┐                              │
│  │ 方舟 Standard       │                              │
│  └────────────────────┘                              │
└─────────────────────────────────────────────────────┘
```

---

## 二、数据库变更

### 2.1 新增 Flyway 迁移

文件：`V1_10__api_key_billing_type.sql`

```sql
-- 1. 新增 billing_type 列
ALTER TABLE api_keys
  ADD COLUMN billing_type VARCHAR(20) NOT NULL DEFAULT 'plan_based';

-- 2. 新增 month_start_balance 列，按量计费用于月消费计算
ALTER TABLE api_keys
  ADD COLUMN month_start_balance NUMERIC(12,2);

-- 3. 将已有的 DeepSeek (api_fetch_enabled = true) 标记为按量计费
UPDATE api_keys
SET billing_type = 'pay_as_you_go'
WHERE api_fetch_enabled = true;

-- 4. 初始化 month_start_balance（用 当前余额 + 已记录月消费 近似月初余额）
UPDATE api_keys
SET month_start_balance = COALESCE(remaining_balance, 0) + COALESCE(monthly_spend, 0)
WHERE billing_type = 'pay_as_you_go';

-- 5. 清理套餐型的余额相关字段（保留列结构，只清数据）
UPDATE api_keys
SET remaining_balance = NULL,
    monthly_spend = 0,
    low_balance_notify = false,
    low_balance_threshold = NULL,
    api_fetch_enabled = false,
    api_last_fetched_at = NULL,
    api_balance_json = NULL
WHERE billing_type = 'plan_based';
```

### 2.2 字段归属表

保留所有现有列，不做 DROP。按 `billing_type` 区分哪些字段有意义：

| 字段 | pay_as_you_go | plan_based | 说明 |
|------|:---:|:---:|------|
| `billing_type` | ✅ | ✅ | 新增，核心分类字段 |
| `month_start_balance` | ✅ | NULL | 新增，月初余额快照 |
| `label` | ✅ | ✅ | |
| `provider` | ✅ | ✅ | |
| `encrypted_key` | ✅ | ✅ | |
| `base_url` | ✅ | ✅ | |
| `status` | ✅ | ✅ | |
| `plan_name` | 可选 | ✅ | |
| `plan_expire_date` | 可选 | ✅ | |
| `subscription_id` | 可选 | 可选 | |
| `remaining_balance` | ✅ (API 同步) | NULL | |
| `monthly_spend` | 不再存储，响应中实时计算 | 0 | |
| `low_balance_notify` | ✅ | false | |
| `low_balance_threshold` | ✅ | NULL | |
| `api_fetch_enabled` | true | false | |
| `api_last_fetched_at` | ✅ | NULL | |
| `api_balance_json` | ✅ | NULL | |
| `notes` | ✅ | ✅ | |
| `archived` | ✅ | ✅ | |

---

## 三、后端变更

### 3.1 Entity — `ApiKey.java`

新增两个字段：

```java
// 计费类型：pay_as_you_go(按量) / plan_based(套餐)
private String billingType;

// 月初余额快照，用于计算当月消费（仅按量计费使用）
private BigDecimal monthStartBalance;
```

### 3.2 DTO 变更

#### `ApiKeyCreateRequest.java`

新增字段：

```java
/** 计费类型：pay_as_you_go / plan_based，默认 plan_based */
private String billingType;
```

#### `ApiKeyUpdateRequest.java`

新增字段：

```java
private String billingType;
```

#### `ApiKeyResponse.java`

新增字段：

```java
private String billingType;
private BigDecimal monthStartBalance;
```

同时在 `from()` 方法中映射这两个新字段。

#### `ApiKeyConsumeRequest.java`

**不删除文件**，保留向后兼容，但后续不再使用。

### 3.3 Service — `ApiKeyService.java`

#### 3.3.1 `create()` 方法修改

```java
// 读取 billingType，默认 plan_based
String billingType = req.getBillingType() != null ? req.getBillingType() : "plan_based";
entity.setBillingType(billingType);

// apiFetchEnabled 由 billingType 决定，不再硬编码 provider 判断
entity.setApiFetchEnabled("pay_as_you_go".equals(billingType));

// 按量计费：初始化 monthStartBalance 为 0（创建后立即同步会覆盖）
if ("pay_as_you_go".equals(billingType)) {
    entity.setMonthStartBalance(BigDecimal.ZERO);
}

// 套餐型：清空余额相关字段
if ("plan_based".equals(billingType)) {
    entity.setRemainingBalance(null);
    entity.setMonthlySpend(BigDecimal.ZERO);
    entity.setLowBalanceNotify(false);
    entity.setLowBalanceThreshold(null);
}
```

#### 3.3.2 `consume()` 方法

在方法开头新增校验：

```java
if ("pay_as_you_go".equals(entity.getBillingType())) {
    throw new IllegalStateException("按量计费 API Key 不支持手动消费记录，消费由系统自动计算");
}
```

保留对 plan_based 的兼容（虽然目前也不需要），主要是防御性编程。

#### 3.3.3 新增 `computeMonthlySpend()` 方法

```java
/**
 * 实时计算按量计费 API Key 的当月消费。
 * 公式：月初余额 + 当月充值总额 - 当前余额
 */
private BigDecimal computeMonthlySpend(ApiKey entity) {
    if (!"pay_as_you_go".equals(entity.getBillingType())) {
        return entity.getMonthlySpend();
    }

    BigDecimal monthStart = entity.getMonthStartBalance() != null
        ? entity.getMonthStartBalance() : BigDecimal.ZERO;
    BigDecimal currentBalance = entity.getRemainingBalance() != null
        ? entity.getRemainingBalance() : BigDecimal.ZERO;

    // 查询当月 recharge 总额
    LocalDate firstDayOfMonth = LocalDate.now().withDayOfMonth(1);
    BigDecimal monthlyRecharges = getMonthlyRechargeSum(entity.getId(), firstDayOfMonth);

    // 当月消费 = 月初余额 + 当月充值 - 当前余额
    BigDecimal spend = monthStart.add(monthlyRecharges).subtract(currentBalance);

    // 负值意味着有未记录的充值，返回 0 并让前端提示
    return spend.compareTo(BigDecimal.ZERO) < 0 ? BigDecimal.ZERO : spend;
}
```

#### 3.3.4 新增 `getMonthlyRechargeSum()` 方法

```java
/**
 * 查询指定 API Key 从 since 日期开始的 recharge 流水总额。
 */
private BigDecimal getMonthlyRechargeSum(String apiKeyId, LocalDate since) {
    List<ApiKeyLedgerEntry> entries = ledgerMapper.selectList(
        new LambdaQueryWrapper<ApiKeyLedgerEntry>()
            .eq(ApiKeyLedgerEntry::getApiKeyId, apiKeyId)
            .eq(ApiKeyLedgerEntry::getEntryType, "recharge")
            .ge(ApiKeyLedgerEntry::getOccurredOn, since));

    return entries.stream()
        .map(ApiKeyLedgerEntry::getAmount)
        .reduce(BigDecimal.ZERO, BigDecimal::add);
}
```

#### 3.3.5 `toResponse()` 方法修改

```java
private ApiKeyResponse toResponse(ApiKey entity) {
    String maskedKey = maskKey(entity.getEncryptedKey());
    ApiKeyResponse response = ApiKeyResponse.from(entity, maskedKey);

    // 按量计费：monthlySpend 由公式实时计算，覆盖 DB 中存储的值
    if ("pay_as_you_go".equals(entity.getBillingType())) {
        response.setMonthlySpend(computeMonthlySpend(entity));
    }

    return response;
}
```

#### 3.3.6 `resetMonthlySpend()` 方法重构

将原来的"重置 monthlySpend 为 0"改为"快照月初余额"：

```java
/**
 * 月初任务：为所有按量计费 Key 快照当前余额到 monthStartBalance。
 * 月消费由公式 (monthStartBalance + 月充值 - 当前余额) 实时计算，
 * 更新 monthStartBalance 后公式自然归零。
 */
public int snapshotMonthStartBalance() {
    List<ApiKey> targets = apiKeyMapper.selectList(
        new LambdaQueryWrapper<ApiKey>()
            .eq(ApiKey::getBillingType, "pay_as_you_go")
            .eq(ApiKey::isArchived, false));

    int count = 0;
    for (ApiKey key : targets) {
        key.setMonthStartBalance(
            key.getRemainingBalance() != null ? key.getRemainingBalance() : BigDecimal.ZERO);
        apiKeyMapper.updateById(key);
        count++;
    }
    return count;
}
```

#### 3.3.7 `getLedger()` 方法修改

对按量计费 Key，只返回 recharge 类型的流水：

```java
public List<ApiKeyLedgerEntry> getLedger(String id, int limit) {
    ApiKey entity = getOrThrow(id);
    int safeLimit = Math.min(Math.max(limit, 1), 100);

    LambdaQueryWrapper<ApiKeyLedgerEntry> query = new LambdaQueryWrapper<ApiKeyLedgerEntry>()
        .eq(ApiKeyLedgerEntry::getApiKeyId, id)
        .orderByDesc(ApiKeyLedgerEntry::getCreatedAt)
        .last("LIMIT " + safeLimit);

    // 按量计费只展示充值记录
    if ("pay_as_you_go".equals(entity.getBillingType())) {
        query.eq(ApiKeyLedgerEntry::getEntryType, "recharge");
    }

    return ledgerMapper.selectList(query);
}
```

### 3.4 Controller — `ApiKeyController.java`

**无结构性变更**，所有端点保持不变。`consume` 端点保留但会被 Service 层拦截（按量计费类型抛异常）。

### 3.5 Scheduler — `SubscriptionNotifyScheduler.java`

#### 月初任务修改

将 `resetMonthlySpend()` 调用改为 `snapshotMonthStartBalance()`：

```java
// 原来：
@Scheduled(cron = "0 10 0 1 * *")
public void resetMonthlySpend() {
    int affected = apiKeyService.resetMonthlySpend();
    log.info("API Key 月初消费重置完成，共 {} 条", affected);
}

// 改为：
@Scheduled(cron = "0 10 0 1 * *")
public void snapshotMonthStartBalance() {
    int affected = apiKeyService.snapshotMonthStartBalance();
    log.info("API Key 月初余额快照完成，共 {} 条", affected);
}
```

#### 低余额检查

`checkLowBalance()` 无需修改 — `findLowBalance()` 已通过 `lowBalanceNotify=true` 过滤，套餐型默认 false，天然排除。

#### 套餐到期检查

`checkApiKeyPlanExpiry()` 无需修改 — 通过 `planExpireDate IS NOT NULL` 过滤，两种类型都适用。

---

## 四、前端变更

### 4.1 类型 — `domain.types.ts`

#### `ApiKey` 接口新增字段

```typescript
export interface ApiKey {
  // ... 现有字段 ...
  billingType: 'pay_as_you_go' | 'plan_based'  // 新增
  monthStartBalance?: number                     // 新增
}
```

### 4.2 API 客户端 — `apiKey.api.ts`

#### `create` 方法参数新增 `billingType`

```typescript
create: (data: {
  label: string
  provider: string
  apiKey: string
  billingType?: 'pay_as_you_go' | 'plan_based'  // 新增
  baseUrl?: string
  planName?: string
  planExpireDate?: string
  subscriptionId?: string
  lowBalanceNotify?: boolean
  lowBalanceThreshold?: number
  notes?: string
}) => apiClient.post<ApiResponse<ApiKey>>('/api-keys', data),
```

`consume` 方法保留但前端不再调用。

### 4.3 Hook — `useApiKeys.ts`

- `consumeMutation` 保留但前端不再调用（渐进废弃）
- 无其他结构性变更

### 4.4 共享工具 — `apikeys.shared.ts`

#### `balanceHealth()` 添加类型守卫

```typescript
export function balanceHealth(item: ApiKey): BalanceHealth {
  // 套餐型没有余额概念，永远 normal
  if (item.billingType === 'plan_based') return 'normal'
  // ... 原有逻辑不变 ...
}
```

#### 新增 Provider 颜色（按需扩展）

```typescript
export const PROVIDER_COLORS: Record<string, string> = {
  deepseek: 'bg-blue-100 text-blue-700',
  openai: 'bg-green-100 text-green-700',
  anthropic: 'bg-orange-100 text-orange-700',
  claude: 'bg-purple-100 text-purple-700',
  // 可追加：阿里云、火山引擎等
}
```

### 4.5 表单 — `ApiKeyFormDialog.tsx`

#### 核心改动：新增 billingType 选择，动态显示字段

表单数据新增 `billingType` 字段：

```typescript
type ApiKeyFormData = {
  billingType: 'pay_as_you_go' | 'plan_based'  // 新增
  label: string
  provider: string
  apiKey: string
  baseUrl: string
  planName: string
  planExpireDate: string
  lowBalanceNotify: boolean
  lowBalanceThreshold: string
  notes: string
}
```

#### 表单 UI 结构

```
┌───────────────────────────────────┐
│ 计费类型 *                        │
│ [○ 按量计费] [○ 套餐型]           │  ← 新增：顶部切换
├───────────────────────────────────┤
│ 平台 *         [deepseek ▼]      │  ← 按量：下拉选择(deepseek等)
│                                   │     套餐：自由输入(任意平台名)
│ 标签 *         [___________]      │
│ API Key        [___________]      │
│ Base URL       [___________]      │
├───────────────────────────────────┤
│ ── 按量计费专属 ──                │
│ 低余额预警     [开/关]            │
│ 预警阈值       [___________]      │
├───────────────────────────────────┤
│ ── 套餐型专属 ──                  │
│ 套餐名称       [___________]      │
│ 套餐到期日     [___________]      │
├───────────────────────────────────┤
│ 备注           [___________]      │
│                                   │
│      [取消]  [创建并同步余额/创建] │
└───────────────────────────────────┘
```

#### Provider 选择逻辑

- **按量计费**：Provider 用下拉（`PROVIDERS` 数组），因为只有支持 API 余额查询的才有意义
- **套餐型**：Provider 改为文本输入框，允许自由输入任何平台名（OpenCode GO、百炼、方舟等）

#### 按钮文案

- 按量 + 新建：`创建并同步余额`
- 套餐 + 新建：`创建`
- 编辑模式：`保存`

### 4.6 卡片 — 拆分为两个组件

将现有 `ApiKeyCard.tsx` 拆分为：

#### `PayAsYouGoCard.tsx` — 按量计费卡片（占满一行）

```
┌─────────────────────────────────────────────────────────────┐
│ [deepseek] DeepSeek [可用]                    [✏️] [🗑️]    │
│ uu5l4...zHPA [复制]                                         │
│ https://api.deepseek.com                                    │
│                                                             │
│ 官方余额：31.11    当月消费：12.50                           │
│ 预警阈值：10.00                                             │
│                                                             │
│ 余额由 deepseek 官方同步（同步于 2 分钟前）    [🔄 刷新余额]  │
│                                                             │
│ ╭─────────────────────────────────────────────╮             │
│ │ [余额趋势图 - AreaChart]                     │             │
│ ╰─────────────────────────────────────────────╯             │
│                                                             │
│ 充值: [金额____] [充值]                                      │
│                                                             │
│ ▶ 查看充值记录                                               │
└─────────────────────────────────────────────────────────────┘
```

关键区别：
- 占满一行（不在 grid 里）
- 只有充值入口，没有消费入口
- 流水标题改为"查看充值记录"
- 当月消费由后端计算返回
- 如果当月消费计算出负值（后端已兜底为 0），可在前端展示提示

#### `PlanBasedCard.tsx` — 套餐型卡片（两列网格）

```
┌──────────────────────────────┐
│ [百炼] 百炼 Pro [可用]  [✏️][🗑️] │
│ uu5l4...zHPA [复制]           │
│ https://dashscope.aliyun.com │
│ 套餐到期：2026-12-31          │
│ 备注：阿里云百炼Pro套餐        │
└──────────────────────────────┘
```

关键区别：
- 两列网格布局
- 无余额、无消费、无趋势图、无充值、无流水
- 核心信息：provider、label、key、到期日、备注
- 精简紧凑

### 4.7 列表视图 — `ApiKeyTabView.tsx`

#### 布局重构

```tsx
export function ApiKeyTabView({ ... }) {
  const activeItems = apiKeys.filter((k) => !k.archived)

  // 按 billingType 分组
  const payAsYouGo = activeItems.filter((k) => k.billingType === 'pay_as_you_go')
  const planBased = activeItems.filter((k) => k.billingType === 'plan_based')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-muted-foreground">
          {activeItems.length} 个 API Key
        </p>
      </div>

      {activeItems.length === 0 ? (
        <section className="nexus-surface p-8 text-center text-sm text-muted-foreground">
          暂无 API Key 记录
        </section>
      ) : (
        <div className="space-y-4">
          {/* 按量计费：每个占满一行，置顶 */}
          {payAsYouGo.map((k) => (
            <PayAsYouGoCard key={k.id} item={k} ... />
          ))}

          {/* 套餐型：两列网格 */}
          {planBased.length > 0 && (
            <div className="grid gap-3 lg:grid-cols-2">
              {planBased.map((k) => (
                <PlanBasedCard key={k.id} item={k} ... />
              ))}
            </div>
          )}
        </div>
      )}

      <ApiKeyFormDialog ... />
    </div>
  )
}
```

### 4.8 Props 清理

#### `ApiKeyTabView` Props

- 移除 `onConsume` prop（不再需要）

#### `PayAsYouGoCard` Props

- 保留 `onRecharge`、`onSyncBalance`
- 不需要 `onConsume`

#### `PlanBasedCard` Props

- 只需要 `onEdit`、`onDelete`、`onUnarchive`
- 不需要余额/充值/消费/同步相关 props

---

## 五、边界情况与注意事项

### 5.1 当月消费为负

**场景**：用户直接在 DeepSeek 平台充值，未通过系统记录充值。
**表现**：`月初余额 + 当月充值 - 当前余额 < 0`
**处理**：后端兜底返回 0，前端可选择性展示提示文案："余额高于预期，可能有未记录的充值"。

### 5.2 月中新建按量计费 Key

**场景**：6月15日创建一个新的 pay_as_you_go Key。
**处理**：`monthStartBalance` 初始化为 0，创建后立即同步余额。当月消费 = 0 + 0 - 当前余额 = 负值 → 兜底为 0。从下个月 1 号快照后开始正常计算。

### 5.3 现有数据迁移

- 现有 DeepSeek Key（`api_fetch_enabled = true`）→ `billing_type = 'pay_as_you_go'`
- `month_start_balance` 初始化为 `remaining_balance + monthly_spend`（近似月初值）
- 现有 consume 类型的流水记录不删除，保留历史数据

### 5.4 `api_fetch_enabled` 与 `billing_type` 的关系

- `billing_type` 是业务分类的主字段
- `api_fetch_enabled` 保留为独立开关（未来可能有按量计费但临时关闭同步的场景）
- 新建时：`pay_as_you_go` 默认 `api_fetch_enabled = true`；`plan_based` 强制 `false`
- 前端判断是否展示余额相关 UI 统一用 `billingType`，不再用 `apiFetchEnabled`

### 5.5 `monthly_spend` 列保留

- DB 列不删除，避免破坏性迁移
- 对 `pay_as_you_go`：Response 中由公式覆盖，DB 值不再维护
- 对 `plan_based`：始终为 0，不展示

---

## 六、执行顺序

```
Phase 1: 后端基础改造
├── 1.1 创建 Flyway 迁移 V1_10__api_key_billing_type.sql
├── 1.2 Entity 新增 billingType / monthStartBalance 字段
├── 1.3 DTO 新增字段（Create/Update/Response）
├── 1.4 Service 改造
│   ├── create() 按类型初始化
│   ├── consume() 添加类型校验
│   ├── 新增 computeMonthlySpend() / getMonthlyRechargeSum()
│   ├── toResponse() 实时计算月消费
│   ├── resetMonthlySpend() → snapshotMonthStartBalance()
│   └── getLedger() 按类型过滤
└── 1.5 Scheduler 更新月初任务

Phase 2: 前端改造
├── 2.1 domain.types.ts 新增字段
├── 2.2 apiKey.api.ts create 参数新增 billingType
├── 2.3 ApiKeyFormDialog.tsx 重构（billingType 切换 + 动态字段）
├── 2.4 拆分卡片组件
│   ├── PayAsYouGoCard.tsx（从 ApiKeyCard.tsx 演化）
│   └── PlanBasedCard.tsx（新建精简卡片）
├── 2.5 ApiKeyTabView.tsx 分组布局
├── 2.6 apikeys.shared.ts 更新（balanceHealth 类型守卫）
└── 2.7 useApiKeys.ts 清理（保留 consume 但不再从 UI 触发）

Phase 3: 验证
├── 3.1 后端启动，执行 Flyway 迁移
├── 3.2 验证现有 DeepSeek Key 数据迁移正确
├── 3.3 创建新的 plan_based Key，确认字段隔离
├── 3.4 创建新的 pay_as_you_go Key，确认余额同步 + 月消费计算
├── 3.5 充值后验证月消费公式更新
├── 3.6 验证布局：按量占一行在上，套餐两列在下
└── 3.7 验证定时任务（月初快照）逻辑
```

---

## 七、涉及文件清单

### 后端 (8 文件)

| 文件 | 操作 |
|------|------|
| `db/migration/V1_10__api_key_billing_type.sql` | **新建** |
| `entity/ApiKey.java` | 新增 2 字段 |
| `dto/request/ApiKeyCreateRequest.java` | 新增 billingType |
| `dto/request/ApiKeyUpdateRequest.java` | 新增 billingType |
| `dto/response/ApiKeyResponse.java` | 新增 2 字段 + 映射 |
| `service/ApiKeyService.java` | 核心改造（6 处修改） |
| `scheduler/SubscriptionNotifyScheduler.java` | 月初任务改调用 |
| `controller/ApiKeyController.java` | 无变更 |

### 前端 (9 文件)

| 文件 | 操作 |
|------|------|
| `types/domain.types.ts` | ApiKey 接口新增 2 字段 |
| `api/apiKey.api.ts` | create 参数新增 billingType |
| `PanelHub/apikeys/ApiKeyFormDialog.tsx` | **重构**：billingType 切换 + 动态字段 |
| `PanelHub/apikeys/ApiKeyCard.tsx` | **删除**（拆分为下面两个） |
| `PanelHub/apikeys/PayAsYouGoCard.tsx` | **新建**：按量计费全宽卡片 |
| `PanelHub/apikeys/PlanBasedCard.tsx` | **新建**：套餐型精简卡片 |
| `PanelHub/apikeys/ApiKeyTabView.tsx` | 分组布局 + Props 清理 |
| `PanelHub/apikeys/apikeys.shared.ts` | balanceHealth 类型守卫 |
| `PanelHub/apikeys/useApiKeys.ts` | 保留 consume（渐进废弃） |
