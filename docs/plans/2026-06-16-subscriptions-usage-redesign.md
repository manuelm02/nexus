# Subscriptions：用量面板隔离 + DeepSeek 余额自动监控 + 概览图表 — 执行计划

> 创建日期：2026-06-16
> 前置依赖：`2026-06-15-subscriptions-dashboard.md`（4 Tab 布局、流水表、UsageAccountCard、Dashboard Tab 已落地）
> 本计划是在已有 4 Tab 基础上的下一阶段改造，聚焦用户反馈的 5 点问题。

---

## 0. 背景与已确认的决策

当前 `/subscriptions` 已是 4 Tab（概览 / 订阅 / 用量面板 / 已归档），但：
- 概览 Tab 内容单薄（仅统计卡 + 用量汇总 + 月度汇总条），无趋势图
- 用量面板与订阅在概览/组件层面仍有交叉引用（`UsageAccountsSummary` 出现在概览里）
- 新建用量账户没有"选择监控类型 + 自动拉取余额"的入口，`apiProvider/apiKeyMasked/apiFetchEnabled/apiBalanceJson` 字段建好后一直没用上
- 充值/消费仍是弹窗（Popover）承载

与用户讨论后确认的方向：

| 决策点 | 结论 |
|---|---|
| 隔离程度 | **同路由下两个完全独立 Tab**：订阅 Tab 与用量面板 Tab 各自拥有独立组件树、hooks、状态；概览 Tab 此后**只服务于"订阅"**，用量面板拿掉、不再共用 |
| 概览趋势图 | 三块：①未来 6 个月支出预测（柱状图）②分类支出占比（饼图，全币种按实时汇率折算为 CNY 汇总）③未来到期时间线（自定义列表，非 recharts） |
| DeepSeek 余额刷新 | 手动"刷新余额"按钮 + 每日 00:30 定时同步，写入余额历史快照供卡片内迷你趋势图使用 |
| 卡片内联充值/消费 | 卡片内直接放充值/消费输入框；完整流水通过卡片内"查看流水"可展开折叠区域显示，不再用 Popover |

新增依赖：`recharts`（图表）。

---

## 1. 设计决策与待用户最终确认的细节（先看这里）

实现过程中有一个**之前讨论未覆盖**的逻辑点，按以下默认方案实现，如不认可请在开工前提出：

> **`apiFetchEnabled=true` 的账户，`remainingBalance` 的"真值"来自 DeepSeek 同步结果，而不是充值/消费流水累加。**
> - 同步（手动或定时）成功后，直接用 DeepSeek 返回的余额覆盖 `remainingBalance`，并写入一条 `subscription_balance_snapshots` 快照。
> - 卡片上的"充值/消费"按钮对这类账户仍可用，但语义降级为**记账备注**（写入 `subscription_ledger_entries`，`balanceAfter` 按当前 `remainingBalance` ± amount 计算用于展示），**不会**改变 `remainingBalance` 本身——下一次同步会用真实余额覆盖。
> - 非 `apiFetchEnabled`（手动维护）账户行为不变：充值/消费直接驱动 `remainingBalance`，与现状一致。
>
> 理由：DeepSeek 余额是唯一真实来源，避免"手动记账"和"API 同步"互相打架导致余额漂移。卡片上需要用小字提示这一差异（例如同步账户显示"余额由 DeepSeek 自动同步"，手动账户显示"余额由充值/消费记录计算"）。

另一个小假设（按现有项目惯例处理，不再单独确认）：
- DeepSeek API Key 复用 `LlmConfigService.encrypt()/decrypt()`（同一套 AES 实现），通过构造注入到 `SubscriptionService`。

分类支出占比饼图改为**全币种汇总**：所有非 CNY 订阅按实时汇率折算为 CNY 后一起统计。汇率获取/缓存方案见第 21 节。

---

## 2. 文件改动清单（总览）

### 后端新增
- `backend/src/main/resources/db/migration/V1_13__subscription_balance_snapshots.sql`
- `backend/src/main/resources/db/migration/V1_14__exchange_rates.sql`
- `backend/src/main/java/com/nexus/entity/SubscriptionBalanceSnapshot.java`
- `backend/src/main/java/com/nexus/entity/ExchangeRate.java`
- `backend/src/main/java/com/nexus/mapper/SubscriptionBalanceSnapshotMapper.java`
- `backend/src/main/java/com/nexus/mapper/ExchangeRateMapper.java`
- `backend/src/main/java/com/nexus/dto/response/BalanceSnapshotResponse.java`
- `backend/src/main/java/com/nexus/integration/balance/DeepSeekBalanceClient.java`
- `backend/src/main/java/com/nexus/integration/balance/ProviderBalanceResult.java`
- `backend/src/main/java/com/nexus/integration/exchange/ExchangeRateClient.java`
- `backend/src/main/java/com/nexus/service/ExchangeRateService.java`

### 后端修改
- `backend/src/main/java/com/nexus/dto/request/SubscriptionCreateRequest.java`（新增 `apiProvider` / `apiKey`）
- `backend/src/main/java/com/nexus/dto/response/SubscriptionResponse.java`（暴露 `apiProvider`/`apiFetchEnabled`/`apiLastFetchedAt`/`apiBalanceJson`）
- `backend/src/main/java/com/nexus/entity/Subscription.java`（无新字段，确认现有字段够用）
- `backend/src/main/java/com/nexus/service/SubscriptionService.java`（创建时接入余额拉取、新增 `syncBalance`/`getBalanceHistory`、批量同步入口）
- `backend/src/main/java/com/nexus/controller/SubscriptionController.java`（新增 `/sync-balance`、`/balance-history`、`/exchange-rates`）
- `backend/src/main/java/com/nexus/scheduler/SubscriptionNotifyScheduler.java`（新增每日余额同步任务 + 每日汇率刷新任务）
- `backend/src/test/java/com/nexus/service/SubscriptionServiceTest.java`（新增 sync/history 测试）

### 前端新增
- `frontend/src/components/ui/Select.tsx`（shadcn 风格 Radix Select 封装，复用于 Provider 下拉）
- `frontend/src/pages/Subscriptions/usage/useUsageAccounts.ts`
- `frontend/src/pages/Subscriptions/usage/UsageTabView.tsx`
- `frontend/src/pages/Subscriptions/usage/UsageAccountCreateDialog.tsx`
- `frontend/src/pages/Subscriptions/usage/LedgerHistory.tsx`
- `frontend/src/pages/Subscriptions/usage/BalanceTrendChart.tsx`
- `frontend/src/pages/Subscriptions/components/dashboard/ForecastChart.tsx`
- `frontend/src/pages/Subscriptions/components/dashboard/CategoryPieChart.tsx`
- `frontend/src/pages/Subscriptions/components/dashboard/ExpiryTimeline.tsx`

### 前端修改
- `frontend/package.json`（新增 `recharts`）
- `frontend/src/types/domain.types.ts`（Subscription 增补 api* 字段、新增 `BalanceSnapshot` 类型、新增 `ExchangeRates` 类型）
- `frontend/src/api/subscription.api.ts`（新增 `syncBalance`/`balanceHistory`/`createUsageAccount`/`exchangeRates`）
- `frontend/src/pages/Subscriptions/subscriptions.shared.ts`（新增 forecast/分类占比（多币种折算）/到期时间线 计算函数）
- `frontend/src/pages/Subscriptions/components/SubscriptionsDashboard.tsx`（移除 UsageAccountsSummary，接入三块图表）
- `frontend/src/pages/Subscriptions/components/UsageAccountCard.tsx`（重写：内联充值/消费 + 折叠流水 + 趋势图 + 刷新余额）
- `frontend/src/pages/Subscriptions/components/UsagePopover.tsx`（删除，逻辑拆分进 `usage/` 目录）
- `frontend/src/pages/Subscriptions/components/UsageAccountsSummary.tsx`（删除）
- `frontend/src/pages/Subscriptions/components/SubscriptionFormFields.tsx`（per_token 编辑态：`apiFetchEnabled=true` 时余额字段只读并提示来源）
- `frontend/src/pages/Subscriptions/SubscriptionsDesktopView.tsx` / `SubscriptionsMobileView.tsx`（"用量面板" Tab 渲染改为 `UsageTabView`；"添加用量账户"打开 `UsageAccountCreateDialog`）
- `frontend/src/pages/Subscriptions/index.tsx`（拆出用量面板的数据/mutation 到 `useUsageAccounts`，订阅 Tab 状态保留在 index.tsx）

---

## 3. 数据库迁移：V1_13 余额快照表

```sql
-- V1_13: DeepSeek 等 API 余额监控的历史快照，供卡片内迷你趋势图和定时同步使用

CREATE TABLE IF NOT EXISTS subscription_balance_snapshots (
    id VARCHAR(36) PRIMARY KEY,
    subscription_id VARCHAR(36) NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    balance NUMERIC(12,2) NOT NULL,
    currency VARCHAR(8) NOT NULL,
    raw_json JSONB,
    snapshotted_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscription_balance_snapshots_sub
    ON subscription_balance_snapshots (subscription_id, snapshotted_at DESC);
```

---

## 4. 后端：DeepSeek 余额客户端

### 4.1 `backend/src/main/java/com/nexus/integration/balance/ProviderBalanceResult.java`

```java
package com.nexus.integration.balance;

import java.math.BigDecimal;

/** Provider 余额查询结果，currency/raw 用于落库 subscription_balance_snapshots.raw_json。 */
public record ProviderBalanceResult(BigDecimal balance, String currency, Object raw) {
}
```

### 4.2 `backend/src/main/java/com/nexus/integration/balance/DeepSeekBalanceClient.java`

```java
package com.nexus.integration.balance;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import java.math.BigDecimal;
import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * 调用 DeepSeek 官方余额接口 GET /user/balance。
 * 响应结构：{"is_available": bool, "balance_infos": [{"currency": "CNY", "total_balance": "100.00", ...}]}
 * DeepSeek 不提供按 token 的用量明细接口，这里只能获取余额，token 消耗仍依赖用户在卡片里手动记录。
 */
@Slf4j
@Component
public class DeepSeekBalanceClient {

    private static final String BASE_URL = "https://api.deepseek.com";

    @SuppressWarnings("unchecked")
    public ProviderBalanceResult fetchBalance(String apiKey) {
        Map<String, Object> body = WebClient.create(BASE_URL).get()
                .uri("/user/balance")
                .header("Authorization", "Bearer " + apiKey)
                .retrieve()
                .bodyToMono(Map.class)
                .timeout(Duration.ofSeconds(10))
                .block();

        if (body == null || !Boolean.TRUE.equals(body.get("is_available"))) {
            throw new IllegalStateException("DeepSeek 账户当前不可用或 API Key 无效");
        }

        List<Map<String, Object>> infos = (List<Map<String, Object>>) body.get("balance_infos");
        if (infos == null || infos.isEmpty()) {
            throw new IllegalStateException("DeepSeek 余额接口未返回数据");
        }

        Map<String, Object> primary = infos.get(0);
        BigDecimal balance = new BigDecimal(String.valueOf(primary.get("total_balance")));
        String currency = String.valueOf(primary.get("currency"));
        return new ProviderBalanceResult(balance, currency, body);
    }
}
```

> 调用方需捕获 `WebClient` 抛出的 4xx/5xx（`WebClientResponseException`）和上面的 `IllegalStateException`，统一转换成"API Key 无效或余额接口调用失败"的业务异常。

---

## 5. 后端：余额快照实体 + Mapper + Response

### 5.1 `backend/src/main/java/com/nexus/entity/SubscriptionBalanceSnapshot.java`

```java
package com.nexus.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.nexus.handler.JsonbTypeHandler;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** API 余额监控历史快照，每次手动/定时同步写入一条，供卡片内趋势图使用。 */
@Data
@TableName(value = "subscription_balance_snapshots", autoResultMap = true)
public class SubscriptionBalanceSnapshot {
    @TableId(type = IdType.ASSIGN_UUID)
    private String id;
    private String subscriptionId;
    private BigDecimal balance;
    private String currency;
    @TableField(typeHandler = JsonbTypeHandler.class)
    private Object rawJson;
    private LocalDateTime snapshottedAt;
}
```

### 5.2 `backend/src/main/java/com/nexus/mapper/SubscriptionBalanceSnapshotMapper.java`

```java
package com.nexus.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.nexus.entity.SubscriptionBalanceSnapshot;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface SubscriptionBalanceSnapshotMapper extends BaseMapper<SubscriptionBalanceSnapshot> {

    @Select("SELECT * FROM subscription_balance_snapshots WHERE subscription_id = #{subscriptionId} " +
            "AND snapshotted_at >= now() - (#{days} || ' days')::interval ORDER BY snapshotted_at ASC")
    List<SubscriptionBalanceSnapshot> selectRecent(@Param("subscriptionId") String subscriptionId, @Param("days") int days);
}
```

### 5.3 `backend/src/main/java/com/nexus/dto/response/BalanceSnapshotResponse.java`

```java
package com.nexus.dto.response;

import com.nexus.entity.SubscriptionBalanceSnapshot;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
public class BalanceSnapshotResponse {
    private BigDecimal balance;
    private String currency;
    private LocalDateTime snapshottedAt;

    public static BalanceSnapshotResponse from(SubscriptionBalanceSnapshot entity) {
        BalanceSnapshotResponse r = new BalanceSnapshotResponse();
        r.setBalance(entity.getBalance());
        r.setCurrency(entity.getCurrency());
        r.setSnapshottedAt(entity.getSnapshottedAt());
        return r;
    }
}
```

---

## 6. 后端：DTO 改动

### 6.1 `SubscriptionCreateRequest.java` 新增字段

```java
    /** 余额自动监控的 Provider 标识，目前仅支持 "deepseek"；为空表示不开启自动监控 */
    private String apiProvider;

    /** 创建时一次性传入的明文 API Key，仅在 apiProvider 非空时使用，落库前会加密 */
    private String apiKey;
```

### 6.2 `SubscriptionResponse.java` 新增字段 + `from()` 补充

```java
    private String apiProvider;
    private boolean apiFetchEnabled;
    private LocalDateTime apiLastFetchedAt;
    private Object apiBalanceJson;
```

`from()` 方法对应补充：

```java
        response.setApiProvider(entity.getApiProvider());
        response.setApiFetchEnabled(entity.isApiFetchEnabled());
        response.setApiLastFetchedAt(entity.getApiLastFetchedAt());
        response.setApiBalanceJson(entity.getApiBalanceJson());
```

> 注意：`apiKeyMasked` 字段**不**暴露到 `SubscriptionResponse`（即使是脱敏值也不返回），与 `LlmProvider` 对 API Key 的处理一致。

---

## 7. 后端：`SubscriptionService` 改造

### 7.1 构造注入新依赖

```java
    private final SubscriptionMapper subscriptionMapper;
    private final SubscriptionLedgerEntryMapper ledgerMapper;
    private final SubscriptionBalanceSnapshotMapper balanceSnapshotMapper;
    private final LlmConfigService llmConfigService;       // 复用 encrypt()/decrypt()
    private final DeepSeekBalanceClient deepSeekBalanceClient;
```

### 7.2 `create()` 接入自动余额拉取

在现有字段赋值之后、`subscriptionMapper.insert(subscription)` 之前/之后，插入如下逻辑（保存后立即同步一次）：

```java
        // apiProvider 非空且提供了 apiKey 时，开启自动余额监控：加密存储 Key 并立即同步一次余额
        if (req.getApiProvider() != null && !req.getApiProvider().isBlank()) {
            if (req.getApiKey() == null || req.getApiKey().isBlank()) {
                throw new IllegalArgumentException("开启自动余额监控需要提供 API Key");
            }
            subscription.setApiProvider(req.getApiProvider());
            subscription.setApiKeyMasked(llmConfigService.encrypt(req.getApiKey()));
            subscription.setApiFetchEnabled(true);
        }

        subscriptionMapper.insert(subscription);

        if (subscription.isApiFetchEnabled()) {
            // 创建即同步一次，失败则直接抛出（避免用户拿到一个"余额未知"的账户却以为已生效）
            syncBalanceInternal(subscription);
        }

        return SubscriptionResponse.from(subscription);
```

> 创建流程中若 `syncBalanceInternal` 抛错，整个事务回滚（需确认 `create()` 所在类/方法是否已有 `@Transactional`；若没有，给 `create()` 加 `@Transactional`，因为现在涉及多表写入：`subscriptions` + `subscription_balance_snapshots`）。

### 7.3 新增 `syncBalance(id)`（手动刷新调用入口）

```java
    /**
     * 手动刷新指定订阅的 API 余额。仅 apiFetchEnabled=true 的订阅可调用。
     */
    @Transactional
    public SubscriptionResponse syncBalance(String id) {
        Subscription subscription = getOrThrow(id);
        if (!subscription.isApiFetchEnabled()) {
            throw new IllegalStateException("该账户未开启自动余额监控");
        }
        syncBalanceInternal(subscription);
        return SubscriptionResponse.from(subscription);
    }

    /**
     * 实际执行余额同步：解密 Key → 调用 Provider → 覆盖 remainingBalance/apiBalanceJson/apiLastFetchedAt → 写入快照。
     * apiFetchEnabled 账户的 remainingBalance 以 Provider 返回值为唯一真值，不与流水累加结果叠加。
     */
    private void syncBalanceInternal(Subscription subscription) {
        String apiKey = llmConfigService.decrypt(subscription.getApiKeyMasked());
        ProviderBalanceResult result = switch (subscription.getApiProvider()) {
            case "deepseek" -> deepSeekBalanceClient.fetchBalance(apiKey);
            default -> throw new IllegalStateException("未知的余额监控 Provider: " + subscription.getApiProvider());
        };

        subscription.setRemainingBalance(result.balance());
        subscription.setApiBalanceJson(result.raw());
        subscription.setApiLastFetchedAt(LocalDateTime.now());
        subscriptionMapper.updateById(subscription);

        SubscriptionBalanceSnapshot snapshot = new SubscriptionBalanceSnapshot();
        snapshot.setSubscriptionId(subscription.getId());
        snapshot.setBalance(result.balance());
        snapshot.setCurrency(result.currency());
        snapshot.setRawJson(result.raw());
        snapshot.setSnapshottedAt(LocalDateTime.now());
        balanceSnapshotMapper.insert(snapshot);
    }
```

需要 `import java.time.LocalDateTime;`、`import org.springframework.transaction.annotation.Transactional;`、`import com.nexus.integration.balance.DeepSeekBalanceClient;`、`import com.nexus.integration.balance.ProviderBalanceResult;`、`import com.nexus.mapper.SubscriptionBalanceSnapshotMapper;`、`import com.nexus.service.LlmConfigService;`、`import com.nexus.entity.SubscriptionBalanceSnapshot;`。

### 7.4 新增 `getBalanceHistory(id, days)`

```java
    /**
     * 返回最近 N 天的余额快照（升序），用于卡片内迷你趋势图。
     */
    public List<BalanceSnapshotResponse> getBalanceHistory(String id, int days) {
        return balanceSnapshotMapper.selectRecent(id, days)
                .stream()
                .map(BalanceSnapshotResponse::from)
                .collect(Collectors.toList());
    }
```

### 7.5 新增批量同步入口（供定时任务调用）

```java
    /**
     * 每日定时同步所有开启了自动余额监控的订阅；单个账户失败不影响其余账户。
     */
    public int syncAllEnabledBalances() {
        List<Subscription> targets = subscriptionMapper.selectList(new LambdaQueryWrapper<Subscription>()
                .eq(Subscription::isApiFetchEnabled, true)
                .eq(Subscription::isArchived, false));
        int success = 0;
        for (Subscription s : targets) {
            try {
                syncBalanceInternal(s);
                success++;
            } catch (Exception e) {
                log.warn("订阅 [{}] 余额同步失败: {}", s.getName(), e.getMessage());
            }
        }
        return success;
    }
```

> 需要给 `SubscriptionService` 加 `@Slf4j`（当前类未引入，注意 import `lombok.extern.slf4j.Slf4j`）。

### 7.6 `boolean isXxx` 命名提示

`Subscription.apiFetchEnabled` 已存在（来自旧迁移），MyBatis-Plus lambda 写法 `Subscription::isApiFetchEnabled` 已在现有代码中可用（参考 `findLowBalance()`/`rollAutoRenewals()` 中对 `archived`/`autoRenew` 的用法），无需新增列映射。

---

## 8. 后端：Controller 新增端点

```java
    /** 手动刷新 API 余额（仅 apiFetchEnabled=true 的账户）。 */
    @PostMapping("/{id}/sync-balance")
    public ApiResponse<SubscriptionResponse> syncBalance(@PathVariable String id) {
        return ApiResponse.ok(subscriptionService.syncBalance(id));
    }

    /** 余额历史快照，默认最近 30 天，用于卡片内迷你趋势图。 */
    @GetMapping("/{id}/balance-history")
    public ApiResponse<List<BalanceSnapshotResponse>> balanceHistory(@PathVariable String id,
                                                                       @RequestParam(defaultValue = "30") int days) {
        return ApiResponse.ok(subscriptionService.getBalanceHistory(id, days));
    }
```

异常处理：`syncBalanceInternal` 中 `DeepSeekBalanceClient` 抛出的 `IllegalStateException`/`WebClientResponseException` 需要能被全局异常处理器转换为 4xx + 友好 message（检查现有 `GlobalExceptionHandler` 是否已覆盖 `IllegalStateException` → 400/422；若已覆盖则无需改动）。

---

## 9. 后端：定时任务

`SubscriptionNotifyScheduler.java` 新增方法：

```java
    /**
     * 每天 00:30 同步所有开启自动余额监控的账户（DeepSeek 等），晚于 00:05 的状态重算任务。
     */
    @Scheduled(cron = "0 30 0 * * *")
    public void syncApiBalances() {
        int success = subscriptionService.syncAllEnabledBalances();
        log.info("Subscription API 余额同步完成，成功 {} 条", success);
    }
```

---

## 10. 后端测试更新（`SubscriptionServiceTest.java`)

新增（参考现有 `recharge_balanceAndLedgerEntry` 等测试的 mock 风格）：
- `create_withDeepSeekProvider_encryptsKeyAndSyncsBalance`：mock `DeepSeekBalanceClient.fetchBalance` 返回固定余额，断言 `remainingBalance` 被覆盖、`apiKeyMasked` 不等于明文、写入了一条 `subscription_balance_snapshots`。
- `create_withDeepSeekProvider_syncFailure_throws`：mock 抛异常，断言 `create()` 整体失败（事务回滚，需 mock `subscriptionMapper.insert` 后验证未提交，或在集成测试层面验证）。
- `syncBalance_notEnabled_throws`：非 `apiFetchEnabled` 账户调用 `syncBalance` 抛 `IllegalStateException`。
- `getBalanceHistory_returnsSnapshotsInRange`。

mock 注入新增：`@Mock private DeepSeekBalanceClient deepSeekBalanceClient;`、`@Mock private SubscriptionBalanceSnapshotMapper balanceSnapshotMapper;`、`@Mock private LlmConfigService llmConfigService;`（`encrypt`/`decrypt` 用 `when(...).thenAnswer(inv -> inv.getArgument(0))` 简化为恒等函数即可）。

---

## 11. 前端：依赖与类型

### 11.1 安装依赖

```bash
cd frontend && pnpm add recharts
```

（`recharts` 无 postinstall 脚本，无需 `pnpm approve-builds`。）

### 11.2 `frontend/src/types/domain.types.ts`

`Subscription` 接口新增：

```ts
  apiProvider?: string
  apiFetchEnabled: boolean
  apiLastFetchedAt?: string
  apiBalanceJson?: { is_available?: boolean; balance_infos?: Array<{ currency: string; total_balance: string; granted_balance: string; topped_up_balance: string }> } | null
```

新增类型：

```ts
/** API 余额监控历史快照点 */
export interface BalanceSnapshot {
  balance: number
  currency: string
  snapshottedAt: string
}

/** 各币种兑 CNY 的实时汇率，CNY 自身固定为 1 */
export type ExchangeRates = Record<string, number>
```

### 11.3 `frontend/src/api/subscription.api.ts`

```ts
  syncBalance: (id: string) =>
    apiClient.post<ApiResponse<Subscription>>(`/subscriptions/${id}/sync-balance`),

  balanceHistory: (id: string, days = 30) =>
    apiClient.get<ApiResponse<BalanceSnapshot[]>>(`/subscriptions/${id}/balance-history`, { params: { days } }),

  createUsageAccount: (data: {
    name: string
    category?: string
    apiProvider: string
    apiKey: string
    lowBalanceNotify?: boolean
    lowBalanceThreshold?: number
    notes?: string
  }) =>
    apiClient.post<ApiResponse<Subscription>>('/subscriptions', { ...data, billingType: 'per_token' }),

  /** 各币种兑 CNY 实时汇率，后端每日缓存刷新一次 */
  exchangeRates: () =>
    apiClient.get<ApiResponse<ExchangeRates>>('/subscriptions/exchange-rates'),
```

（记得在文件顶部 `import type { ... } from '../types/domain.types'` 中加入 `ExchangeRates`。）

（`BalanceSnapshot` 类型记得加入文件顶部的 import。`createUsageAccount` 复用现有 `POST /subscriptions`，只是显式约束 payload 形状，与手动添加用量账户走同一 `create` mutation 也可——见 13.2。）

---

## 12. 前端：`Select` 组件（Provider 下拉框）

`frontend/src/components/ui/Select.tsx`，基于已安装的 `@radix-ui/react-select`，风格与 `nexus-input` 一致（参考其他 `ui/` 组件的 className 命名习惯，如 `nexus-button-utility`）：

```tsx
import * as SelectPrimitive from '@radix-ui/react-select'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '../../lib/utils'

export const Select = SelectPrimitive.Root

export function SelectTrigger({ className, children, ...props }: SelectPrimitive.SelectTriggerProps) {
  return (
    <SelectPrimitive.Trigger className={cn('nexus-input flex h-10 w-full items-center justify-between px-3 text-sm', className)} {...props}>
      {children}
      <SelectPrimitive.Icon><ChevronDown className="h-4 w-4 opacity-50" /></SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

export const SelectValue = SelectPrimitive.Value

export function SelectContent({ className, children, ...props }: SelectPrimitive.SelectContentProps) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content className={cn('z-[90] overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-lg', className)} {...props}>
        <SelectPrimitive.Viewport className="p-1">{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
}

export function SelectItem({ className, children, ...props }: SelectPrimitive.SelectItemProps) {
  return (
    <SelectPrimitive.Item className={cn('relative flex cursor-pointer select-none items-center rounded-md px-3 py-2 text-sm outline-none data-[highlighted]:bg-muted', className)} {...props}>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="absolute right-2"><Check className="h-3.5 w-3.5" /></SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  )
}
```

> 实现时请先 `grep` 一下项目里 `@radix-ui/react-select` 的实际类型导出（不同版本 `SelectTriggerProps` 等命名可能不同），按实际类型签名调整 props 类型。

---

## 13. 前端：用量面板（Usage Tab）完全独立

### 13.1 `frontend/src/pages/Subscriptions/usage/useUsageAccounts.ts`

把 `index.tsx` 里与 `per_token` 相关的 query/mutation 全部迁移到这个 hook，**不再共享** `subscriptions` 主查询的派生状态（即使底层 API 仍是同一张表/同一接口）：

```ts
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { subscriptionApi } from '../../../api/subscription.api'
import { subscriptionCategoryApi } from '../../../api/subscriptionCategory.api'
import type { Subscription } from '../../../types/domain.types'

// useUsageAccounts 集中管理"用量面板"Tab 的全部数据与操作：列表、统计、充值/消费、余额同步、流水、分类
export function useUsageAccounts() {
  const queryClient = useQueryClient()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: () => subscriptionApi.list(),
  })

  const { data: categoriesData } = useQuery({
    queryKey: ['subscription-categories'],
    queryFn: () => subscriptionCategoryApi.list(),
  })

  const items: Subscription[] = useMemo(() => data?.data?.data ?? [], [data])
  const usageItems = useMemo(() => items.filter((i) => i.billingType === 'per_token' && !i.archived), [items])
  const archivedUsageItems = useMemo(() => items.filter((i) => i.billingType === 'per_token' && i.archived), [items])
  const categories = useMemo(() => (categoriesData?.data?.data ?? []).map((c) => c.name), [categoriesData])

  const invalidate = (id?: string) => {
    queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
    queryClient.invalidateQueries({ queryKey: ['subscription-stats'] })
    if (id) {
      queryClient.invalidateQueries({ queryKey: ['subscription-ledger', id] })
      queryClient.invalidateQueries({ queryKey: ['subscription-balance-history', id] })
    }
  }

  const createMutation = useMutation({
    mutationFn: subscriptionApi.createUsageAccount,
    onSuccess: () => invalidate(),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Subscription> }) => subscriptionApi.update(id, payload),
    onSuccess: () => invalidate(),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => subscriptionApi.delete(id),
    onMutate: (id) => setDeletingId(id),
    onSettled: () => setDeletingId(null),
    onSuccess: () => invalidate(),
  })

  const rechargeMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { amount: number; date?: string; note?: string } }) =>
      subscriptionApi.recharge(id, data),
    onSuccess: (_d, v) => invalidate(v.id),
  })

  const consumeMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { amount: number; note?: string } }) =>
      subscriptionApi.consume(id, data),
    onSuccess: (_d, v) => invalidate(v.id),
  })

  const syncBalanceMutation = useMutation({
    mutationFn: (id: string) => subscriptionApi.syncBalance(id),
    onSuccess: (_d, id) => invalidate(id),
  })

  return {
    isLoading,
    usageItems,
    archivedUsageItems,
    categories,
    deletingId,
    createUsageAccount: createMutation.mutate,
    creating: createMutation.isPending,
    createError: createMutation.error as Error | null,
    updateAccount: updateMutation.mutate,
    deleteAccount: deleteMutation.mutate,
    recharge: (id: string, data: { amount: number; date?: string; note?: string }) => rechargeMutation.mutate({ id, data }),
    consume: (id: string, data: { amount: number; note?: string }) => consumeMutation.mutate({ id, data }),
    syncBalance: syncBalanceMutation.mutate,
    syncingId: syncBalanceMutation.isPending ? (syncBalanceMutation.variables as string | undefined) : undefined,
  }
}
```

### 13.2 `frontend/src/pages/Subscriptions/usage/UsageAccountCreateDialog.tsx`

新建/编辑用量账户的独立 Dialog（不复用 `SubscriptionFormDialog`）：

- Provider 下拉框（`Select`）：当前仅一个选项 `DeepSeek`，结构上预留 `value: 'deepseek' | string`，未来新增 Provider 只需扩展这个数组。
- 选中 DeepSeek 后展开：
  - 账户名称（`name`，必填，例如"个人 DeepSeek"）
  - 分类（复用 `CategoryInput`）
  - API Key 输入框（`type="password"`，必填；提示文案"仅用于调用余额接口，加密存储"）
  - 低余额预警阈值（`lowBalanceThreshold`，可选）
- 提交时调用 `createUsageAccount({ name, category, apiProvider: 'deepseek', apiKey, lowBalanceNotify: !!lowBalanceThreshold, lowBalanceThreshold, billingType: 'per_token' })`
- 提交中状态：禁用表单 + "正在连接 DeepSeek 并获取余额…"
- 失败态：展示 `createError.message`（后端 `IllegalStateException`/`IllegalArgumentException` 的 message，例如"DeepSeek 账户当前不可用或 API Key 无效"），不关闭弹窗，允许重试

```tsx
import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/Select'
import { CategoryInput } from '../components/CategoryInput'

type UsageAccountCreateDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: string[]
  creating: boolean
  createError: Error | null
  onSubmit: (payload: { name: string; category?: string; apiProvider: string; apiKey: string; lowBalanceNotify: boolean; lowBalanceThreshold?: number }) => void
  onAiSuggestCategory: (name: string, notes?: string) => Promise<string | undefined>
}

const PROVIDERS = [
  { value: 'deepseek', label: 'DeepSeek（余额自动监控）' },
  // 未来新增 Provider 在此追加
]

// UsageAccountCreateDialog 新建用量账户：选择监控 Provider → 输入 API Key → 提交时后端立即拉取余额
export function UsageAccountCreateDialog({ open, onOpenChange, categories, creating, createError, onSubmit, onAiSuggestCategory }: UsageAccountCreateDialogProps) {
  const [provider, setProvider] = useState('deepseek')
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [threshold, setThreshold] = useState('')

  const reset = () => { setName(''); setCategory(''); setApiKey(''); setThreshold('') }

  const handleSubmit = () => {
    if (!name || !apiKey) return
    onSubmit({
      name,
      category: category || undefined,
      apiProvider: provider,
      apiKey,
      lowBalanceNotify: !!threshold,
      lowBalanceThreshold: threshold ? Number(threshold) : undefined,
    })
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[80] w-[min(calc(100vw-2rem),26rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-card p-5 shadow-lg">
          <Dialog.Title className="text-base font-bold">添加用量账户</Dialog.Title>
          <Dialog.Description className="mt-1 text-xs text-muted-foreground">
            选择要监控的服务并提供 API Key，创建后会立即拉取一次余额。
          </Dialog.Description>

          <div className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">监控类型</label>
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">账户名称</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="nexus-input h-10 w-full px-3 text-sm" placeholder="例如：个人 DeepSeek" />
            </div>

            <CategoryInput value={category} onChange={setCategory} categories={categories} onAiSuggest={() => onAiSuggestCategory(name)} />

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">DeepSeek API Key</label>
              <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="nexus-input h-10 w-full px-3 text-sm" placeholder="sk-..." />
              <p className="text-[11px] text-muted-foreground">仅用于调用余额查询接口，加密存储，不会展示明文。</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">低余额预警阈值（可选）</label>
              <input type="number" min="0" step="0.01" value={threshold} onChange={(e) => setThreshold(e.target.value)} className="nexus-input h-10 w-full px-3 text-sm" placeholder="例如：10" />
            </div>

            {createError && (
              <p className="rounded-md border border-[hsl(var(--destructive)/0.3)] bg-[hsl(var(--destructive-soft))] p-2 text-xs text-[hsl(var(--destructive))]">
                {createError.message || '创建失败，请检查 API Key 是否正确'}
              </p>
            )}
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <Dialog.Close className="nexus-button-utility h-9 px-4 text-sm">取消</Dialog.Close>
            <button type="button" disabled={!name || !apiKey || creating} onClick={handleSubmit} className="nexus-button-primary h-9 px-4 text-sm">
              {creating ? '连接中...' : '创建并同步余额'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
```

> `CategoryInput` 的实际 props 名称（`value`/`onChange`/`categories`/`onAiSuggest` 等）需要先读 `frontend/src/pages/Subscriptions/components/CategoryInput.tsx` 确认，按实际签名调整。
> 创建成功后（`createMutation.isSuccess`）需要关闭弹窗——可在 `UsageTabView` 里用 `useEffect` 监听 `creating` 从 `true → false` 且无 `createError` 时调用 `onOpenChange(false)`，或者把 `onSuccess` 回调从 `useUsageAccounts` 传出来直接控制 Dialog 状态。

### 13.3 `frontend/src/pages/Subscriptions/usage/LedgerHistory.tsx`

从 `UsagePopover.tsx` 中抽出的流水列表部分，改为可折叠组件：

```tsx
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown } from 'lucide-react'
import { subscriptionApi } from '../../../api/subscription.api'
import { cn, formatDate } from '../../../lib/utils'

type LedgerHistoryProps = { subscriptionId: string }

// LedgerHistory 卡片内可展开的流水折叠区域，展开时才发起 /ledger 请求
export function LedgerHistory({ subscriptionId }: LedgerHistoryProps) {
  const [open, setOpen] = useState(false)

  const { data } = useQuery({
    queryKey: ['subscription-ledger', subscriptionId],
    queryFn: () => subscriptionApi.ledger(subscriptionId, 10),
    enabled: open,
  })
  const records = data?.data?.data ?? []

  return (
    <div className="border-t pt-2">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between text-[11px] font-bold text-muted-foreground">
        查看流水
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="mt-2 space-y-1.5">
          {records.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">暂无流水记录</p>
          ) : records.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
              <span>{formatDate(r.occurredOn)}</span>
              <span className={cn('font-semibold', r.type === 'recharge' ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--destructive))]')}>
                {r.type === 'recharge' ? '+' : '-'}{r.amount.toFixed(2)}
              </span>
              <span className="truncate">{r.note}</span>
              <span className="shrink-0">余额 {r.balanceAfter.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

> 检查 `LedgerEntry` 类型里字段名是否是 `type`（`UsagePopover.tsx` 现状用的是 `r.type`），与 `LedgerEntryResponse` 后端字段对齐确认一致。

### 13.4 `frontend/src/pages/Subscriptions/usage/BalanceTrendChart.tsx`

```tsx
import { useQuery } from '@tanstack/react-query'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { subscriptionApi } from '../../../api/subscription.api'
import { formatDate } from '../../../lib/utils'

type BalanceTrendChartProps = { subscriptionId: string }

// BalanceTrendChart 用量账户卡片内的近30天余额迷你趋势图，数据来自 /balance-history
export function BalanceTrendChart({ subscriptionId }: BalanceTrendChartProps) {
  const { data } = useQuery({
    queryKey: ['subscription-balance-history', subscriptionId],
    queryFn: () => subscriptionApi.balanceHistory(subscriptionId, 30),
  })
  const points = data?.data?.data ?? []

  if (points.length < 2) {
    return <p className="text-[11px] text-muted-foreground">同步数据不足，暂无趋势图</p>
  }

  return (
    <div className="h-16 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
          <defs>
            <linearGradient id={`balance-${subscriptionId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="snapshottedAt" hide />
          <YAxis hide domain={['auto', 'auto']} />
          <Tooltip
            formatter={(value: number) => value.toFixed(2)}
            labelFormatter={(label: string) => formatDate(label)}
            contentStyle={{ fontSize: 11, borderRadius: 8 }}
          />
          <Area type="monotone" dataKey="balance" stroke="hsl(var(--primary))" fill={`url(#balance-${subscriptionId})`} strokeWidth={1.5} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
```

### 13.5 重写 `UsageAccountCard.tsx`

新增 props：`onSyncBalance: (id: string) => void`、`syncing: boolean`。布局调整：

1. 头部不变（环形图 + 名称 + 分类 + Provider 徽标 + 编辑/归档/删除）。新增 Provider 徽标：当 `item.apiFetchEnabled` 为真，显示 `DeepSeek` 小徽标（`rounded-full border px-2 py-0.5 text-[11px]`）。
2. 余额行追加"上次同步"信息和"刷新余额"按钮（仅 `apiFetchEnabled` 时显示）：

```tsx
{item.apiFetchEnabled && (
  <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
    <span>余额由 DeepSeek 自动同步{item.apiLastFetchedAt ? `（${formatRelativeTime(item.apiLastFetchedAt)}）` : ''}</span>
    <button type="button" onClick={() => onSyncBalance(item.id)} disabled={syncing} className="nexus-button-utility h-7 gap-1 px-2 text-[11px]">
      <RefreshCw className={cn('h-3 w-3', syncing && 'animate-spin')} /> 刷新余额
    </button>
  </div>
)}
{!item.apiFetchEnabled && (
  <p className="mt-2 text-[11px] text-muted-foreground">余额由充值/消费记录计算</p>
)}
```

3. 趋势图：`apiFetchEnabled` 时渲染 `<BalanceTrendChart subscriptionId={item.id} />`。
4. **内联充值/消费**（替代 `UsagePopover` 的弹出表单）：两组并排的"金额输入框 + 按钮"：

```tsx
<div className="mt-3 grid grid-cols-2 gap-2">
  <InlineAmountAction label="充值" actionLabel="充值" tone="success" onSubmit={(amount) => onRecharge(item.id, { amount })} />
  <InlineAmountAction label="消费" actionLabel="记录" tone="destructive" onSubmit={(amount) => onConsume(item.id, { amount })} />
</div>
```

`InlineAmountAction` 是本文件内的小型私有组件（受控 `amount` state + `<input type="number">` + 提交按钮，提交后清空），不必单独建文件，因为只在 `UsageAccountCard` 内使用。

5. 底部新增 `<LedgerHistory subscriptionId={item.id} />`。

`formatRelativeTime` 若 `lib/utils.ts` 没有，新增一个简单实现（"X 分钟前 / X 小时前 / X 天前"）。

### 13.6 `frontend/src/pages/Subscriptions/usage/UsageTabView.tsx`

```tsx
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useUsageAccounts } from './useUsageAccounts'
import { UsageAccountCreateDialog } from './UsageAccountCreateDialog'
import { UsageAccountCard } from '../components/UsageAccountCard'

type UsageTabViewProps = {
  onAiSuggestCategory: (name: string, notes?: string) => Promise<string | undefined>
  onEdit: (item: import('../../../types/domain.types').Subscription) => void
}

// UsageTabView "用量面板"Tab 的完整自包含视图：自身的数据查询、统计条、卡片网格、新增入口
export function UsageTabView({ onAiSuggestCategory, onEdit }: UsageTabViewProps) {
  const account = useUsageAccounts()
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold text-muted-foreground">
          共 {account.usageItems.length} 个用量账户
        </div>
        <button type="button" onClick={() => setCreateOpen(true)} className="nexus-button-primary gap-1.5 px-4 text-sm">
          <Plus className="h-4 w-4" /> 添加用量账户
        </button>
      </div>

      {account.isLoading ? (
        <section className="nexus-surface p-4 text-sm text-muted-foreground">加载中...</section>
      ) : account.usageItems.length === 0 ? (
        <section className="nexus-surface p-8 text-center text-sm text-muted-foreground">暂无用量账户，点击右上角添加</section>
      ) : (
        <section className="grid gap-3 lg:grid-cols-2">
          {account.usageItems.map((item) => (
            <UsageAccountCard
              key={item.id}
              item={item}
              deleting={account.deletingId === item.id}
              syncing={account.syncingId === item.id}
              onEdit={onEdit}
              onDelete={account.deleteAccount}
              onRecharge={account.recharge}
              onConsume={account.consume}
              onSyncBalance={account.syncBalance}
            />
          ))}
        </section>
      )}

      <UsageAccountCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        categories={account.categories}
        creating={account.creating}
        createError={account.createError}
        onSubmit={(payload) => account.createUsageAccount(payload)}
        onAiSuggestCategory={onAiSuggestCategory}
      />
    </div>
  )
}
```

> "添加按钮放在 Tab 内容区右上角、Primary 样式"对应用户反馈第 2 点（不再是页面级左上角的孤立按钮）。"已归档"Tab 中用量账户部分（`account.archivedUsageItems`）继续走原 `UsageAccountCard` + `onUnarchive`，可在 `UsageTabView` 内按 `props.showArchived` 分支，或在"已归档"Tab 单独引入 `useUsageAccounts()`（hook 内部走 React Query 缓存，重复调用不会重复请求）。本计划默认后者，保持"已归档"Tab 自身逻辑不变（仍由 `index.tsx` 提供的 `archivedItems` 渲染，`UsageAccountCard` 继续接收 `onUnarchive`）。

---

## 14. 前端：订阅 Tab / index.tsx 调整

### 14.1 `index.tsx`

- 移除 `usageItems`、`usageLowBalanceCount`、`onRecharge`、`onConsume` 等用量相关派生状态和 mutation（迁移到 `useUsageAccounts`）。
- `sharedProps` 中只保留订阅 Tab、概览 Tab（订阅向）、已归档 Tab 需要的数据。
- `view === 'usage'` 时，桌面/移动视图直接渲染 `<UsageTabView onAiSuggestCategory={...} onEdit={handleEdit} />`，不再传 `usageItems`/`onRecharge`/`onConsume` 等。
- "已归档"Tab 仍展示订阅类 + 用量类归档项：保留 `archivedItems`（全量）用于该 Tab 渲染，但用量类卡片所需的 `onRecharge`/`onConsume`/`onSyncBalance` 改为从一个独立的 `useUsageAccounts()` 实例获取（已归档 Tab 内部调用，与 `UsageTabView` 各自独立调用 hook，依赖 React Query 缓存共享数据，不会重复请求或状态冲突）。
- `handleCreateClick`：当 `view === 'usage'` 时不再打开 `SubscriptionFormDialog`——"添加用量账户"按钮已经下沉到 `UsageTabView` 内部，`index.tsx` 顶层不再需要为 `usage` 视图渲染添加按钮（详见 15）。

### 14.2 `SubscriptionFormFields.tsx`（编辑态 per_token 账户）

`per_token` 编辑表单仍用于：修改名称/分类/低余额阈值/备注、以及非 DeepSeek（手动维护）账户的余额调整。新增逻辑：

```tsx
{item?.apiFetchEnabled ? (
  <div className="space-y-1.5">
    <label className="text-xs font-bold text-muted-foreground">当前余额</label>
    <p className="nexus-input flex h-10 items-center px-3 text-sm text-muted-foreground">
      {item.remainingBalance?.toFixed(2) ?? '—'}（由 DeepSeek 自动同步，不可手动编辑）
    </p>
  </div>
) : (
  /* 现有 remainingBalance 输入框逻辑保留 */
)}
```

---

## 15. 前端：Desktop/Mobile View 改造

### 15.1 `SubscriptionsDesktopView.tsx`

- `view === 'usage'` 分支整体替换为：

```tsx
{view === 'usage' && (
  <UsageTabView onAiSuggestCategory={props.onAiSuggestCategory} onEdit={props.onEdit} />
)}
```

- 顶部"添加"按钮逻辑：`showAddButton = view === 'subscriptions'`（去掉 `usage`，因为 `UsageTabView` 自带右上角添加按钮）。`ADD_BUTTON_LABEL` 只保留 `subscriptions: '添加订阅'`。
- `view === 'dashboard'` 分支：`<SubscriptionsDashboard>` 不再传 `usageItems`（见第 16 节）。
- `view === 'archived'` 分支中 `UsageAccountCard` 渲染需要补充 `onSyncBalance`/`syncing` props——从一个局部 `useUsageAccounts()` 实例获取（如 14.1 所述）。

### 15.2 `SubscriptionsMobileView.tsx`

同步做相同改造（结构应与桌面版一致，只是布局类名不同）。

---

## 16. 前端：Dashboard Tab 三块图表

### 16.1 `subscriptions.shared.ts` 新增计算函数

```ts
export type ForecastPoint = { month: string; [currency: string]: number | string }

/**
 * 未来 N 个月的预计支出：monthly 每月计入；yearly 仅在续费月份计入；
 * one_time/lifetime 不计入（已发生或一次性，非"周期性预测"）。
 */
export function forecastMonthlySpend(items: Subscription[], monthsAhead = 6): ForecastPoint[] {
  const today = new Date()
  today.setDate(1)
  today.setHours(0, 0, 0, 0)

  const points: ForecastPoint[] = []
  for (let i = 0; i < monthsAhead; i++) {
    const d = new Date(today)
    d.setMonth(d.getMonth() + i)
    const label = `${d.getMonth() + 1}月`
    const point: ForecastPoint = { month: label }

    items.forEach((item) => {
      if (item.archived || item.status !== 'active') return
      const currency = item.currency || 'CNY'
      const price = item.price ?? 0
      if (item.billingType === 'monthly') {
        point[currency] = ((point[currency] as number) ?? 0) + price
      } else if (item.billingType === 'yearly' && item.nextBillingDate) {
        const next = new Date(`${item.nextBillingDate}T00:00:00`)
        if (next.getMonth() === d.getMonth() && next.getFullYear() <= d.getFullYear()) {
          point[currency] = ((point[currency] as number) ?? 0) + price
        }
      }
    })

    points.push(point)
  }
  return points
}

export type CategorySpend = { category: string; amount: number }

/**
 * 分类支出占比（全币种汇总为 CNY）：monthly 按月价计入，yearly 按 price/12 折算为月度等效，
 * 非 CNY 金额按 `rates`（currency -> 兑 CNY 汇率）折算。`rates` 中缺失的币种会被跳过并计入 excludedCount，
 * 仅作为汇率接口暂未覆盖该币种时的兜底，正常情况下 excludedCount 应为 0。
 */
export function categorySpendConverted(items: Subscription[], rates: Record<string, number>): { data: CategorySpend[]; excludedCount: number } {
  let excludedCount = 0
  const totals = new Map<string, number>()

  items.forEach((item) => {
    if (item.archived || item.status !== 'active') return
    if (item.billingType !== 'monthly' && item.billingType !== 'yearly') return

    const currency = item.currency || 'CNY'
    const rate = currency === 'CNY' ? 1 : rates[currency]
    if (rate == null) {
      excludedCount++
      return
    }

    const monthlyEquivalent = (item.billingType === 'monthly' ? (item.price ?? 0) : (item.price ?? 0) / 12) * rate
    const category = item.category || '未分类'
    totals.set(category, (totals.get(category) ?? 0) + monthlyEquivalent)
  })

  return {
    data: Array.from(totals.entries()).map(([category, amount]) => ({ category, amount })),
    excludedCount,
  }
}

export type UpcomingDue = { id: string; name: string; date: string; daysLeft: number; amount: number; currency: string }

/** 未来 N 天内到期/续费的订阅，按日期升序，用于到期时间线 */
export function upcomingDueItems(items: Subscription[], daysAhead = 90): UpcomingDue[] {
  return items
    .filter((item) => !item.archived && item.status === 'active' && (item.billingType === 'monthly' || item.billingType === 'yearly' || item.billingType === 'one_time'))
    .map((item) => {
      const dateStr = item.nextBillingDate ?? item.expireDate
      if (!dateStr) return null
      const daysLeft = daysUntil(dateStr)
      if (daysLeft === null || daysLeft < 0 || daysLeft > daysAhead) return null
      return { id: item.id, name: item.name, date: dateStr, daysLeft, amount: item.price ?? 0, currency: item.currency || 'CNY' }
    })
    .filter((x): x is UpcomingDue => x !== null)
    .sort((a, b) => a.daysLeft - b.daysLeft)
}
```

### 16.2 `frontend/src/pages/Subscriptions/components/dashboard/ForecastChart.tsx`

```tsx
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Subscription } from '../../../../types/domain.types'
import { forecastMonthlySpend } from '../../subscriptions.shared'

type ForecastChartProps = { items: Subscription[] }

const CURRENCY_COLORS: Record<string, string> = {
  CNY: 'hsl(var(--primary))',
  USD: 'hsl(var(--warning))',
}

// ForecastChart 概览图表：未来 6 个月按币种分组的预计周期性支出
export function ForecastChart({ items }: ForecastChartProps) {
  const data = forecastMonthlySpend(items, 6)
  const currencies = Array.from(new Set(items.map((i) => i.currency || 'CNY')))

  return (
    <div className="nexus-surface p-4">
      <h3 className="text-sm font-bold">未来 6 个月预计支出</h3>
      <div className="mt-2 h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {currencies.map((c) => (
              <Bar key={c} dataKey={c} name={c} fill={CURRENCY_COLORS[c] ?? 'hsl(var(--muted-foreground))'} radius={[4, 4, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
```

### 16.3 `frontend/src/pages/Subscriptions/components/dashboard/CategoryPieChart.tsx`

```tsx
import { useQuery } from '@tanstack/react-query'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { Subscription } from '../../../../types/domain.types'
import { subscriptionApi } from '../../../../api/subscription.api'
import { categorySpendConverted } from '../../subscriptions.shared'

type CategoryPieChartProps = { items: Subscription[] }

const COLORS = ['hsl(var(--primary))', 'hsl(var(--warning))', 'hsl(var(--success))', 'hsl(var(--destructive))', 'hsl(var(--muted-foreground))']

// CategoryPieChart 概览图表：按分类的月度等效支出占比，全币种按实时汇率折算为 CNY 汇总
export function CategoryPieChart({ items }: CategoryPieChartProps) {
  const { data: ratesData, isLoading: ratesLoading } = useQuery({
    queryKey: ['subscription-exchange-rates'],
    queryFn: () => subscriptionApi.exchangeRates(),
    staleTime: 1000 * 60 * 60, // 1小时内不重复请求，汇率每日才更新一次
  })
  const rates = ratesData?.data?.data ?? {}

  if (ratesLoading) {
    return (
      <div className="nexus-surface p-4">
        <h3 className="text-sm font-bold">分类支出占比</h3>
        <p className="mt-2 text-xs text-muted-foreground">汇率加载中...</p>
      </div>
    )
  }

  const { data, excludedCount } = categorySpendConverted(items, rates)

  if (data.length === 0) {
    return (
      <div className="nexus-surface p-4">
        <h3 className="text-sm font-bold">分类支出占比</h3>
        <p className="mt-2 text-xs text-muted-foreground">暂无周期性订阅数据</p>
      </div>
    )
  }

  return (
    <div className="nexus-surface p-4">
      <h3 className="text-sm font-bold">分类支出占比（已折算为 CNY，月度等效）</h3>
      <div className="mt-2 h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="amount" nameKey="category" cx="50%" cy="50%" outerRadius={80} label={({ category, percent }) => `${category} ${(percent * 100).toFixed(0)}%`}>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(value: number) => value.toFixed(2)} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      {excludedCount > 0 && (
        <p className="mt-1 text-[11px] text-muted-foreground">另有 {excludedCount} 笔订阅因汇率数据暂未覆盖其币种未计入</p>
      )}
    </div>
  )
}
```

### 16.4 `frontend/src/pages/Subscriptions/components/dashboard/ExpiryTimeline.tsx`

非 recharts，自定义横向滚动列表：

```tsx
import type { Subscription } from '../../../../types/domain.types'
import { formatMoney, upcomingDueItems } from '../../subscriptions.shared'
import { formatDate } from '../../../../lib/utils'

type ExpiryTimelineProps = { items: Subscription[] }

// ExpiryTimeline 概览：未来 90 天内到期/续费订阅的横向时间线列表
export function ExpiryTimeline({ items }: ExpiryTimelineProps) {
  const due = upcomingDueItems(items, 90)

  return (
    <div className="nexus-surface p-4">
      <h3 className="text-sm font-bold">未来 90 天到期</h3>
      {due.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">未来 90 天内没有到期/续费的订阅</p>
      ) : (
        <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
          {due.map((d) => (
            <div key={d.id} className="flex w-36 shrink-0 flex-col gap-1 rounded-lg border p-3">
              <span className="text-[11px] font-bold text-muted-foreground">{formatDate(d.date)}</span>
              <span className="truncate text-sm font-bold">{d.name}</span>
              <span className="text-xs text-muted-foreground">{formatMoney(d.currency, d.amount)}</span>
              <span className={d.daysLeft <= 7 ? 'text-[11px] font-bold text-[hsl(var(--warning))]' : 'text-[11px] text-muted-foreground'}>
                {d.daysLeft === 0 ? '今天' : `${d.daysLeft} 天后`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

### 16.5 `SubscriptionsDashboard.tsx` 重写

```tsx
import type { Subscription, SubscriptionStats } from '../../../types/domain.types'
import type { SubscriptionFilter } from '../subscriptions.shared'
import { SubscriptionsStatsBar } from './SubscriptionsStatsBar'
import { SummaryBar } from './SummaryBar'
import { ForecastChart } from './dashboard/ForecastChart'
import { CategoryPieChart } from './dashboard/CategoryPieChart'
import { ExpiryTimeline } from './dashboard/ExpiryTimeline'

type SubscriptionsDashboardProps = {
  stats: SubscriptionStats | null
  statsLoading: boolean
  monthlyTotals: Record<string, number>
  expiringCount: number
  expiredCount: number
  filter: SubscriptionFilter
  subscriptionItems: Subscription[]
  onFilterChange: (filter: SubscriptionFilter) => void
}

// SubscriptionsDashboard 概览 Tab：仅服务"订阅"语义——统计卡 + 三块趋势图 + 到期筛选入口
export function SubscriptionsDashboard(props: SubscriptionsDashboardProps) {
  return (
    <div className="space-y-5">
      <SubscriptionsStatsBar stats={props.stats} isLoading={props.statsLoading} />
      <SummaryBar
        monthlyTotals={props.monthlyTotals}
        expiringCount={props.expiringCount}
        expiredCount={props.expiredCount}
        filter={props.filter}
        onFilterChange={props.onFilterChange}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <ForecastChart items={props.subscriptionItems} />
        <CategoryPieChart items={props.subscriptionItems} />
      </div>
      <ExpiryTimeline items={props.subscriptionItems} />
    </div>
  )
}
```

> `subscriptionItems` 这里应传入"全部未归档、非 per_token"的订阅（即 `index.tsx` 中现有的 `subscriptionItems`，不是经过 `filter` 筛选的 `filteredSubscriptionItems`），因为图表需要全量数据而不是"即将到期/已到期"筛选后的子集。`index.tsx` 中 `sharedProps.subscriptionItems` 目前传的是 `filteredSubscriptionItems`——需要为 Dashboard 单独传一份未筛选的 `subscriptionItems`（新增一个 prop，例如 `allSubscriptionItems`）。

---

## 17. 删除文件

- `frontend/src/pages/Subscriptions/components/UsagePopover.tsx`（逻辑已拆分到 `usage/LedgerHistory.tsx` + `UsageAccountCard.tsx` 内联表单）
- `frontend/src/pages/Subscriptions/components/UsageAccountsSummary.tsx`（概览 Tab 不再展示用量信息）

删除前先全局搜索引用，确认无残留 import。

---

## 18. 手动验证清单

1. **概览 Tab**：三块图表均渲染；无订阅数据时图表显示空状态文案而非报错；点击"即将到期/已到期"汇总按钮仍能跳转到"订阅"Tab 并应用筛选。分类支出占比饼图：若存在非 CNY 订阅（如 USD），验证其按 `/exchange-rates` 返回的汇率正确折算进对应分类；可临时改一笔订阅的 `currency` 为 `USD` 验证。
2. **订阅 Tab**：添加按钮位于 Tab 内容区右上角，仅在"订阅"Tab 显示；CRUD 流程不受影响。
3. **用量面板 Tab**：
   - 点击"添加用量账户" → 选择 DeepSeek → 输入真实/无效 API Key：
     - 真实 Key：创建成功，卡片立即显示余额、Provider 徽标、"刚刚同步"
     - 无效 Key：弹窗内展示错误信息，未创建账户（数据库无脏数据，需确认 `@Transactional` 生效）
   - 卡片"刷新余额"按钮：点击后余额更新，`apiLastFetchedAt` 变化，趋势图新增一个点
   - 卡片内联充值/消费：输入金额提交后，`apiFetchEnabled` 账户的 `remainingBalance` **不**因充值/消费立即变化（保持 DeepSeek 同步值），但"查看流水"展开后能看到刚提交的记录
   - 非 DeepSeek（手动）账户：充值/消费直接改变 `remainingBalance`，行为与改造前一致
   - "查看流水"折叠区域：展开才发请求，收起不重复请求（React Query 缓存）
4. **已归档 Tab**：用量类归档卡片仍可"取消归档"，且具备刷新余额/趋势图（如适用）。
5. **定时任务**（可临时改 cron 为近期时间验证，验证完恢复）：`syncApiBalances` 执行后所有 `apiFetchEnabled=true` 账户写入新快照，单个账户失败不影响其他账户（可临时把某个账户的 `apiKeyMasked` 改成垃圾值验证容错）。
6. 回归：`mvn -q test`（或 `mise exec java@21 -- mvn -q test`）通过；前端 `pnpm build` 无类型错误。

---

## 19. 风险与回滚

- `create()` 改为 `@Transactional` 后，若项目里 `SubscriptionService` 其他方法已有不同的事务边界假设，需确认不会引入嵌套事务问题（当前其他写方法均为单表单语句，风险低）。
- DeepSeek API 不稳定/限流时，创建用量账户会失败——属预期行为（同步是创建的前置条件），但需确保错误信息对用户友好，不暴露原始异常堆栈。
- 若用户后续希望"创建时即使同步失败也允许账户存在（标记为待同步）"，可在 7.2 改为捕获异常、`apiLastFetchedAt=null`、前端展示"待同步"状态——本计划默认更严格的"同步成功才算创建成功"，如需更改请在开工前调整本节。

---

## 21. 汇率转换支持（分类支出占比饼图全币种汇总）

### 21.1 数据库：V1_14 汇率缓存表

```sql
-- V1_14: 各币种兑 CNY 的实时汇率缓存，避免每次请求都调用外部汇率 API

CREATE TABLE IF NOT EXISTS exchange_rates (
    currency VARCHAR(8) PRIMARY KEY,
    rate_to_cny NUMERIC(14,6) NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);
```

### 21.2 `backend/src/main/java/com/nexus/entity/ExchangeRate.java`

```java
package com.nexus.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** 各币种兑 CNY 实时汇率缓存，currency 为 ISO 4217 代码（如 USD），由外部汇率 API 每日刷新。 */
@Data
@TableName("exchange_rates")
public class ExchangeRate {
    @TableId(type = IdType.INPUT)
    private String currency;
    private BigDecimal rateToCny;
    private LocalDateTime updatedAt;
}
```

### 21.3 `backend/src/main/java/com/nexus/mapper/ExchangeRateMapper.java`

```java
package com.nexus.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.nexus.entity.ExchangeRate;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface ExchangeRateMapper extends BaseMapper<ExchangeRate> {
}
```

### 21.4 `backend/src/main/java/com/nexus/integration/exchange/ExchangeRateClient.java`

```java
package com.nexus.integration.exchange;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;

/**
 * 调用 Frankfurter 汇率 API（https://api.frankfurter.dev，免费、无需 API Key，基于欧洲央行数据，每个工作日更新）。
 * 接口返回"1 CNY = X <currency>"，需取倒数得到"1 <currency> = Y CNY"。
 */
@Slf4j
@Component
public class ExchangeRateClient {

    private static final String BASE_URL = "https://api.frankfurter.dev";

    @SuppressWarnings("unchecked")
    public Map<String, BigDecimal> fetchRatesToCny(Set<String> currencies) {
        if (currencies.isEmpty()) return Map.of();
        String symbols = String.join(",", currencies);

        Map<String, Object> body = WebClient.create(BASE_URL).get()
                .uri("/v1/latest?base=CNY&symbols=" + symbols)
                .retrieve()
                .bodyToMono(Map.class)
                .timeout(Duration.ofSeconds(10))
                .block();

        if (body == null || body.get("rates") == null) {
            throw new IllegalStateException("汇率接口未返回数据");
        }

        Map<String, Object> rates = (Map<String, Object>) body.get("rates");
        Map<String, BigDecimal> result = new HashMap<>();
        rates.forEach((currency, value) -> {
            BigDecimal rateFromCny = new BigDecimal(String.valueOf(value));
            if (rateFromCny.signum() > 0) {
                // 1 CNY = rateFromCny <currency>  =>  1 <currency> = 1/rateFromCny CNY
                result.put(currency, BigDecimal.ONE.divide(rateFromCny, 6, RoundingMode.HALF_UP));
            }
        });
        return result;
    }
}
```

> Frankfurter 不支持所有币种（仅 ECB 公布的主要货币，覆盖 USD/EUR/JPY/GBP 等常见币种，足够个人订阅场景）。若传入 Frankfurter 不支持的币种代码，该币种不会出现在返回的 `rates` 中——`ExchangeRateService` 据此判断为"该币种暂无汇率数据"。

### 21.5 `backend/src/main/java/com/nexus/service/ExchangeRateService.java`

```java
package com.nexus.service;

import com.nexus.entity.ExchangeRate;
import com.nexus.integration.exchange.ExchangeRateClient;
import com.nexus.mapper.ExchangeRateMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/** 维护 exchange_rates 缓存表：按需刷新过期汇率，供分类支出占比饼图折算多币种使用。 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ExchangeRateService {

    private static final BigDecimal CNY = BigDecimal.ONE;

    private final ExchangeRateMapper exchangeRateMapper;
    private final ExchangeRateClient exchangeRateClient;

    /**
     * 返回 currencies 中每个币种兑 CNY 的汇率（CNY 固定为 1）。
     * 缓存超过 24 小时或缺失的币种会触发一次实时刷新；刷新失败时回退到已有缓存值（若有），
     * 完全没有缓存且刷新失败的币种不会出现在返回结果中（由调用方在前端标记为"未计入"）。
     */
    public Map<String, BigDecimal> getRatesToCny(Set<String> currencies) {
        Map<String, BigDecimal> result = new HashMap<>();
        result.put("CNY", CNY);

        Set<String> foreign = currencies.stream().filter(c -> c != null && !"CNY".equals(c)).collect(Collectors.toSet());
        if (foreign.isEmpty()) return result;

        Map<String, ExchangeRate> cached = exchangeRateMapper.selectBatchIds(foreign).stream()
                .collect(Collectors.toMap(ExchangeRate::getCurrency, e -> e));

        LocalDateTime staleThreshold = LocalDateTime.now().minusHours(24);
        Set<String> stale = foreign.stream()
                .filter(c -> !cached.containsKey(c) || cached.get(c).getUpdatedAt().isBefore(staleThreshold))
                .collect(Collectors.toSet());

        if (!stale.isEmpty()) {
            try {
                Map<String, BigDecimal> fresh = exchangeRateClient.fetchRatesToCny(stale);
                fresh.forEach((currency, rate) -> upsert(currency, rate, cached));
            } catch (Exception e) {
                log.warn("汇率刷新失败，使用缓存值（如有）: {}", e.getMessage());
            }
        }

        cached.forEach((currency, entity) -> result.put(currency, entity.getRateToCny()));
        return result;
    }

    /** 定时任务调用：强制刷新所有当前使用中的币种汇率，不判断是否过期。 */
    public void refreshAll(Set<String> currencies) {
        Set<String> foreign = currencies.stream().filter(c -> c != null && !"CNY".equals(c)).collect(Collectors.toSet());
        if (foreign.isEmpty()) return;
        Map<String, ExchangeRate> cached = exchangeRateMapper.selectBatchIds(foreign).stream()
                .collect(Collectors.toMap(ExchangeRate::getCurrency, e -> e));
        Map<String, BigDecimal> fresh = exchangeRateClient.fetchRatesToCny(foreign);
        fresh.forEach((currency, rate) -> upsert(currency, rate, cached));
    }

    private void upsert(String currency, BigDecimal rate, Map<String, ExchangeRate> cached) {
        ExchangeRate entity = cached.get(currency);
        if (entity == null) {
            entity = new ExchangeRate();
            entity.setCurrency(currency);
        }
        entity.setRateToCny(rate);
        entity.setUpdatedAt(LocalDateTime.now());
        if (cached.containsKey(currency)) {
            exchangeRateMapper.updateById(entity);
        } else {
            exchangeRateMapper.insert(entity);
            cached.put(currency, entity);
        }
    }
}
```

### 21.6 `SubscriptionService` 新增辅助方法

```java
    /** 当前未归档订阅涉及的所有币种（用于汇率刷新范围），CNY 一定包含在内。 */
    public Set<String> distinctActiveCurrencies() {
        Set<String> currencies = subscriptionMapper.selectList(new LambdaQueryWrapper<Subscription>()
                .eq(Subscription::isArchived, false))
                .stream()
                .map(s -> s.getCurrency() == null ? "CNY" : s.getCurrency())
                .collect(Collectors.toSet());
        currencies.add("CNY");
        return currencies;
    }
```

### 21.7 Controller 新增端点

```java
    private final ExchangeRateService exchangeRateService; // 构造注入

    /** 当前订阅涉及的各币种兑 CNY 实时汇率，供分类支出占比饼图折算使用。 */
    @GetMapping("/exchange-rates")
    public ApiResponse<Map<String, BigDecimal>> exchangeRates() {
        return ApiResponse.ok(exchangeRateService.getRatesToCny(subscriptionService.distinctActiveCurrencies()));
    }
```

### 21.8 定时任务

`SubscriptionNotifyScheduler.java` 新增方法（在余额同步之前执行，让当天的余额快照能用到当天的汇率）：

```java
    /**
     * 每天 00:20 强制刷新当前所有币种的汇率缓存，早于 00:30 的余额同步。
     */
    @Scheduled(cron = "0 20 0 * * *")
    public void syncExchangeRates() {
        exchangeRateService.refreshAll(subscriptionService.distinctActiveCurrencies());
        log.info("Subscription 汇率刷新完成");
    }
```

需要在 `SubscriptionNotifyScheduler` 构造注入 `ExchangeRateService`。

---

## 22. 实施顺序建议

1. 数据库迁移 V1_13/V1_14 + 后端实体/Mapper/DTO（第 3-6、21.1-21.3 节）
2. `DeepSeekBalanceClient` + `ExchangeRateClient`/`ExchangeRateService` + `SubscriptionService` 余额与汇率逻辑 + Controller 端点 + 定时任务（第 4、7-9、21.4-21.8 节）+ 后端测试（第 10 节）
3. 前端依赖安装 + 类型/API client（第 11 节）+ `Select` 组件（第 12 节）
4. `useUsageAccounts` + `UsageAccountCreateDialog` + `LedgerHistory` + `BalanceTrendChart` + 重写 `UsageAccountCard`（第 13 节）
5. `index.tsx` / Desktop/Mobile View 改造、删除旧文件（第 14、15、17 节）
6. Dashboard 三块图表，含汇率折算的分类支出占比（第 16 节）
7. 全量手动验证（第 18 节）
