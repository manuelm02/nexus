# Subscriptions 用量面板 & 流水重构 — 执行计划

> 创建日期：2026-06-15
> 视觉规范：`docs/superpowers/plans/2026-06-15-subscriptions-dashboard-DESIGN.md`（先读，本计划的组件样式均以该文档为准）
> 前置依赖：`docs/superpowers/plans/2026-06-14-subscriptions-ui-polish.md`（已实施）
> 提示词：`docs/superpowers/prompts/2026-06-15-subscriptions-dashboard-deepseek.md`

---

## 0. 背景与现状

当前 Subscriptions 页面是单一列表 + 2 个 Tab（订阅/已归档），所有计费类型共用 `SubscriptionCard` + `FIELD_VISIBILITY` 条件渲染。按量类型（`per_token`，对应 DeepSeek/OpenAI 等 AI API 充值-消耗-余额场景）的充值记录存在 `subscriptions.recharge_records` JSONB 列里（`RechargeRecordItem`），**消费记录完全不落库**——`consume()` 只改 `remainingBalance`/`monthlySpend`，没有任何流水。

本轮目标（已与用户确认，无需再问）：

1. 新建独立的"充值/消费流水"表，`consume()` 也要落流水。
2. 按量类型（`per_token`）不再与其他类型混合展示，拆成独立 Tab。
3. Tab 结构由 2 个（订阅/已归档）扩展为 4 个：**概览 / 订阅 / 用量面板 / 已归档**。
4. "订阅"Tab 卡片新增计费周期进度条。
5. "用量面板"Tab 卡片用环形图展示余额健康度。
6. "添加"按钮按当前 Tab 切换文案和默认 `billingType`，概览/已归档 Tab 不显示。

**当前代码现状（已核实）**：
- `Subscription` 实体（`backend/src/main/java/com/nexus/entity/Subscription.java`）已有 `apiProvider`/`apiKeyMasked`/`apiFetchEnabled`/`apiLastFetchedAt`/`apiBalanceJson` 字段（DeepSeek 自动同步的预留字段，**本计划不涉及，不要动**），以及 `rechargeRecords`（`List<RechargeRecordItem>`，JSONB）。
- `V1_11__subscriptions_status_and_model.sql` 是最新已应用迁移 → 本计划新增迁移为 **`V1_12`**。
- `SubscriptionFormFields.tsx` / `SubscriptionFormDialog.tsx` 已是统一响应式 Dialog（上一轮已完成），本计划只新增 `initialBillingType` 透传，不重写表单结构。
- `SubscriptionCard.tsx` 内部有未导出的 `PerTokenInfo` 函数和 `DeleteConfirm` 函数；`DeleteConfirm` 需要提取为独立文件供新的 `UsageAccountCard` 复用。
- `SubscriptionViewTabs.tsx` 当前是 2 Tab（`active`/`archived`），`SubscriptionView` 类型为 `'active' | 'archived'`，本计划改为 4 态。
- `UsagePopover.tsx` 当前从 `item.rechargeRecords` 读取数据，本计划改为调用新的 `/subscriptions/{id}/ledger` 接口。

---

## 1. 数据库迁移：统一流水表

### 新建 `backend/src/main/resources/db/migration/V1_12__subscription_ledger_entries.sql`

```sql
-- V1_12: 按量订阅充值/消费统一流水表，替代 recharge_records JSONB

CREATE TABLE IF NOT EXISTS subscription_ledger_entries (
    id VARCHAR(36) PRIMARY KEY,
    subscription_id VARCHAR(36) NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    entry_type VARCHAR(16) NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    balance_after NUMERIC(12,2) NOT NULL,
    note VARCHAR(255),
    occurred_on DATE NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscription_ledger_entries_sub
    ON subscription_ledger_entries (subscription_id, created_at DESC);

-- 迁移历史充值记录：recharge_records JSONB 数组的每一项变成一条 entry_type='recharge' 的流水
INSERT INTO subscription_ledger_entries (id, subscription_id, entry_type, amount, balance_after, note, occurred_on, created_at)
SELECT
    r->>'id',
    s.id,
    'recharge',
    (r->>'amount')::numeric,
    (r->>'balanceAfter')::numeric,
    r->>'note',
    (r->>'date')::date,
    COALESCE((r->>'createdAt')::timestamp, now())
FROM subscriptions s, jsonb_array_elements(s.recharge_records) r
WHERE s.recharge_records IS NOT NULL AND jsonb_array_length(s.recharge_records) > 0;

ALTER TABLE subscriptions DROP COLUMN IF EXISTS recharge_records;
```

> 按 CLAUDE.md 约定：迁移脚本一旦应用不可修改，本文件为新建文件，命名遵循 `V{major}_{minor}__{desc}.sql`。

---

## 2. 后端：流水实体 + Mapper + DTO

### 2.1 新建 `backend/src/main/java/com/nexus/entity/SubscriptionLedgerEntry.java`

```java
package com.nexus.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/** 按量订阅充值/消费流水，按 subscription_id 关联 subscriptions 表，替代旧的 recharge_records JSONB。 */
@Data
@TableName("subscription_ledger_entries")
public class SubscriptionLedgerEntry {
    @TableId(type = IdType.ASSIGN_UUID)
    private String id;
    private String subscriptionId;
    /** recharge | consume */
    private String entryType;
    private BigDecimal amount;
    private BigDecimal balanceAfter;
    private String note;
    private LocalDate occurredOn;
    private LocalDateTime createdAt;
}
```

`created_at` 列有 `DEFAULT now()`，插入时不设置该字段即可由数据库填充（与项目内其它表的现状一致，无需 `@TableField(fill=...)` 或 MetaObjectHandler）。

### 2.2 新建 `backend/src/main/java/com/nexus/mapper/SubscriptionLedgerEntryMapper.java`

```java
package com.nexus.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.nexus.entity.SubscriptionLedgerEntry;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface SubscriptionLedgerEntryMapper extends BaseMapper<SubscriptionLedgerEntry> {

    @Select("SELECT * FROM subscription_ledger_entries WHERE subscription_id = #{subscriptionId} ORDER BY created_at DESC, id DESC LIMIT #{limit}")
    List<SubscriptionLedgerEntry> selectRecent(@Param("subscriptionId") String subscriptionId, @Param("limit") int limit);
}
```

### 2.3 新建 `backend/src/main/java/com/nexus/dto/response/LedgerEntryResponse.java`

```java
package com.nexus.dto.response;

import com.nexus.entity.SubscriptionLedgerEntry;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/** 充值/消费流水对外响应。 */
@Data
public class LedgerEntryResponse {
    private String id;
    private String type;
    private BigDecimal amount;
    private BigDecimal balanceAfter;
    private String note;
    private LocalDate occurredOn;
    private LocalDateTime createdAt;

    public static LedgerEntryResponse from(SubscriptionLedgerEntry entity) {
        LedgerEntryResponse response = new LedgerEntryResponse();
        response.setId(entity.getId());
        response.setType(entity.getEntryType());
        response.setAmount(entity.getAmount());
        response.setBalanceAfter(entity.getBalanceAfter());
        response.setNote(entity.getNote());
        response.setOccurredOn(entity.getOccurredOn());
        response.setCreatedAt(entity.getCreatedAt());
        return response;
    }
}
```

---

## 3. 后端：`Subscription` 实体与 `SubscriptionResponse` 移除 `rechargeRecords`

### 3.1 `backend/src/main/java/com/nexus/entity/Subscription.java`

- 删除 `import com.nexus.dto.RechargeRecordItem;`
- 删除字段：
  ```java
  @TableField(typeHandler = JsonbTypeHandler.class)
  private List<RechargeRecordItem> rechargeRecords;
  ```
- `JsonbTypeHandler` 和 `List` 的 import 仍被 `apiBalanceJson` 使用，**保留**。

### 3.2 `backend/src/main/java/com/nexus/dto/response/SubscriptionResponse.java`

- 删除 `import com.nexus.dto.RechargeRecordItem;`
- 删除字段 `private List<RechargeRecordItem> rechargeRecords;`
- `from()` 中删除 `response.setRechargeRecords(entity.getRechargeRecords());`
- 若删除后 `import java.util.List;` 不再被其他字段使用，一并删除该 import（检查文件内其余字段无 `List` 用法）。

### 3.3 删除 `backend/src/main/java/com/nexus/dto/RechargeRecordItem.java`

整个文件删除（已无引用）。

---

## 4. 后端：`SubscriptionService` 改造

文件：`backend/src/main/java/com/nexus/service/SubscriptionService.java`

### 4.1 构造注入新 Mapper

`@RequiredArgsConstructor` 已存在，新增一个 `final` 字段即可自动注入：

```java
    private final SubscriptionMapper subscriptionMapper;
    private final SubscriptionLedgerEntryMapper ledgerMapper;
```

新增 import：
```java
import com.nexus.dto.response.LedgerEntryResponse;
import com.nexus.entity.SubscriptionLedgerEntry;
import com.nexus.mapper.SubscriptionLedgerEntryMapper;
```

删除不再使用的 `import com.nexus.dto.RechargeRecordItem;`。

### 4.2 重写 `recharge()`（原第 162-188 行）

```java
    /**
     * 按量订阅充值：余额累加，并写入一条 recharge 流水。仅适用于 per_token 类型。
     */
    public SubscriptionResponse recharge(String id, SubscriptionRechargeRequest req) {
        Subscription subscription = getOrThrow(id);
        if (!"per_token".equals(subscription.getBillingType())) {
            throw new IllegalArgumentException("仅按量类型订阅支持充值");
        }
        BigDecimal currentBalance = subscription.getRemainingBalance() != null ? subscription.getRemainingBalance() : BigDecimal.ZERO;
        BigDecimal newBalance = currentBalance.add(req.getAmount());
        subscription.setRemainingBalance(newBalance);
        subscriptionMapper.updateById(subscription);

        SubscriptionLedgerEntry entry = new SubscriptionLedgerEntry();
        entry.setSubscriptionId(id);
        entry.setEntryType("recharge");
        entry.setAmount(req.getAmount());
        entry.setBalanceAfter(newBalance);
        entry.setNote(req.getNote());
        entry.setOccurredOn(req.getDate() != null ? req.getDate() : LocalDate.now());
        ledgerMapper.insert(entry);

        return SubscriptionResponse.from(subscription);
    }
```

### 4.3 重写 `consume()`（原第 193-206 行）

```java
    /**
     * 按量订阅消费记录：余额扣减（可为负），月消费累加，并写入一条 consume 流水。仅适用于 per_token 类型。
     */
    public SubscriptionResponse consume(String id, SubscriptionConsumeRequest req) {
        Subscription subscription = getOrThrow(id);
        if (!"per_token".equals(subscription.getBillingType())) {
            throw new IllegalArgumentException("仅按量类型订阅支持消费记录");
        }
        BigDecimal currentBalance = subscription.getRemainingBalance() != null ? subscription.getRemainingBalance() : BigDecimal.ZERO;
        BigDecimal newBalance = currentBalance.subtract(req.getAmount());
        subscription.setRemainingBalance(newBalance);

        BigDecimal currentSpend = subscription.getMonthlySpend() != null ? subscription.getMonthlySpend() : BigDecimal.ZERO;
        subscription.setMonthlySpend(currentSpend.add(req.getAmount()));

        subscriptionMapper.updateById(subscription);

        SubscriptionLedgerEntry entry = new SubscriptionLedgerEntry();
        entry.setSubscriptionId(id);
        entry.setEntryType("consume");
        entry.setAmount(req.getAmount());
        entry.setBalanceAfter(newBalance);
        entry.setNote(req.getNote());
        entry.setOccurredOn(LocalDate.now());
        ledgerMapper.insert(entry);

        return SubscriptionResponse.from(subscription);
    }
```

### 4.4 新增 `getLedger()`

紧跟在 `consume()` 之后新增：

```java
    /**
     * 获取按量订阅最近的充值/消费流水，按时间倒序。
     */
    public List<LedgerEntryResponse> getLedger(String id, int limit) {
        getOrThrow(id);
        return ledgerMapper.selectRecent(id, limit).stream()
                .map(LedgerEntryResponse::from)
                .collect(Collectors.toList());
    }
```

（`Collectors` 已被文件其他方法使用，无需新增 import。）

---

## 5. 后端：Controller 新增 `/ledger` 端点

文件：`backend/src/main/java/com/nexus/controller/SubscriptionController.java`

新增 import：
```java
import com.nexus.dto.response.LedgerEntryResponse;
import org.springframework.web.bind.annotation.RequestParam;
```
（`@RequestMapping` 等已通过 `org.springframework.web.bind.annotation.*` 导入，`RequestParam` 同样包含在 `.*` 里，**无需单独 import**——确认现有文件头部 `import org.springframework.web.bind.annotation.*;` 已覆盖，跳过此 import 行。）

在 `consume()` 方法之后新增：

```java
    /** 按量订阅流水：最近 N 条充值/消费记录，按时间倒序。 */
    @GetMapping("/{id}/ledger")
    public ApiResponse<List<LedgerEntryResponse>> ledger(@PathVariable String id,
                                                          @RequestParam(defaultValue = "20") int limit) {
        return ApiResponse.ok(subscriptionService.getLedger(id, limit));
    }
```

---

## 6. 后端测试更新

文件：`backend/src/test/java/com/nexus/service/SubscriptionServiceTest.java`

### 6.1 新增 mock 字段

在 `@Mock private SubscriptionMapper subscriptionMapper;` 之后新增：

```java
    @Mock
    private SubscriptionLedgerEntryMapper ledgerMapper;
```

新增 import：
```java
import com.nexus.entity.SubscriptionLedgerEntry;
import com.nexus.mapper.SubscriptionLedgerEntryMapper;
```

### 6.2 重写 `recharge_balanceAndRecords`（第 159-181 行）→ `recharge_balanceAndLedgerEntry`

```java
    /** 按量充值：验证余额累加、写入 recharge 流水。 */
    @Test
    void recharge_balanceAndLedgerEntry() {
        Subscription sub = buildSubscription("s1", "GPT-API", "per_token");
        sub.setRemainingBalance(BigDecimal.ZERO);
        when(subscriptionMapper.selectById("s1")).thenReturn(sub);

        SubscriptionRechargeRequest req1 = new SubscriptionRechargeRequest();
        req1.setAmount(new BigDecimal("50"));
        SubscriptionResponse r1 = subscriptionService.recharge("s1", req1);
        assertThat(r1.getRemainingBalance()).isEqualByComparingTo("50");

        SubscriptionRechargeRequest req2 = new SubscriptionRechargeRequest();
        req2.setAmount(new BigDecimal("30"));
        SubscriptionResponse r2 = subscriptionService.recharge("s1", req2);
        assertThat(r2.getRemainingBalance()).isEqualByComparingTo("80");

        ArgumentCaptor<SubscriptionLedgerEntry> captor = ArgumentCaptor.forClass(SubscriptionLedgerEntry.class);
        verify(ledgerMapper, org.mockito.Mockito.times(2)).insert(captor.capture());

        SubscriptionLedgerEntry first = captor.getAllValues().get(0);
        assertThat(first.getSubscriptionId()).isEqualTo("s1");
        assertThat(first.getEntryType()).isEqualTo("recharge");
        assertThat(first.getAmount()).isEqualByComparingTo("50");
        assertThat(first.getBalanceAfter()).isEqualByComparingTo("50");

        SubscriptionLedgerEntry second = captor.getAllValues().get(1);
        assertThat(second.getAmount()).isEqualByComparingTo("30");
        assertThat(second.getBalanceAfter()).isEqualByComparingTo("80");
    }
```

### 6.3 重写 `consume_balanceAndSpend`（第 197-216 行）→ 追加流水断言

在原有断言之后（`assertThat(r2.getRemainingBalance()).isEqualByComparingTo("-10");`）追加：

```java
        ArgumentCaptor<SubscriptionLedgerEntry> captor = ArgumentCaptor.forClass(SubscriptionLedgerEntry.class);
        verify(ledgerMapper, org.mockito.Mockito.times(2)).insert(captor.capture());

        SubscriptionLedgerEntry first = captor.getAllValues().get(0);
        assertThat(first.getEntryType()).isEqualTo("consume");
        assertThat(first.getAmount()).isEqualByComparingTo("30");
        assertThat(first.getBalanceAfter()).isEqualByComparingTo("70");

        SubscriptionLedgerEntry second = captor.getAllValues().get(1);
        assertThat(second.getBalanceAfter()).isEqualByComparingTo("-10");
```

方法名保持 `consume_balanceAndSpend` 不变，只追加内容；Javadoc 注释改为"验证余额扣减（可为负）、月消费累加、写入 consume 流水"。

### 6.4 新增 `getLedger` 测试

在 `consume_nonPerToken_throws` 测试之后新增：

```java
    /** 获取流水：按 selectRecent 返回顺序映射为响应列表。 */
    @Test
    void getLedger_returnsMappedEntries() {
        Subscription sub = buildSubscription("s1", "GPT-API", "per_token");
        when(subscriptionMapper.selectById("s1")).thenReturn(sub);

        SubscriptionLedgerEntry entry = new SubscriptionLedgerEntry();
        entry.setId("e1");
        entry.setSubscriptionId("s1");
        entry.setEntryType("consume");
        entry.setAmount(new BigDecimal("12.50"));
        entry.setBalanceAfter(new BigDecimal("87.50"));
        entry.setOccurredOn(LocalDate.now());
        when(ledgerMapper.selectRecent("s1", 20)).thenReturn(List.of(entry));

        List<LedgerEntryResponse> result = subscriptionService.getLedger("s1", 20);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getId()).isEqualTo("e1");
        assertThat(result.get(0).getType()).isEqualTo("consume");
        assertThat(result.get(0).getAmount()).isEqualByComparingTo("12.50");
        assertThat(result.get(0).getBalanceAfter()).isEqualByComparingTo("87.50");
    }
```

新增 import：
```java
import com.nexus.dto.response.LedgerEntryResponse;
```

### 6.5 检查 `buildSubscription` 测试夹具

`buildSubscription(...)` 辅助方法如果设置了 `sub.setRechargeRecords(...)`，需要删除该行（字段已不存在会编译失败）。先 `grep -n "setRechargeRecords" backend/src/test/java/com/nexus/service/SubscriptionServiceTest.java` 确认所有出现位置并删除。

---

## 7. 前端：类型与 API client

### 7.1 `frontend/src/types/domain.types.ts`

- 删除 `RechargeRecord` interface（第 136-144 行）及其注释 `/** 按量订阅充值记录 */`。
- `Subscription` interface 中删除字段 `rechargeRecords: RechargeRecord[]`（第 129 行）。
- 在删除处新增：

```ts
/** 按量订阅充值/消费流水条目 */
export interface LedgerEntry {
  id: string
  type: 'recharge' | 'consume'
  amount: number
  balanceAfter: number
  note?: string
  occurredOn: string
  createdAt: string
}
```

### 7.2 `frontend/src/api/subscription.api.ts`

新增方法：

```ts
  ledger: (id: string, limit = 10) =>
    apiClient.get<ApiResponse<LedgerEntry[]>>(`/subscriptions/${id}/ledger`, { params: { limit } }),
```

新增 import（顶部 type 导入处）：
```ts
import type { LedgerEntry, Subscription, SubscriptionStats } from '../types/domain.types'
```
（原有 `import type { Subscription, SubscriptionStats } from '../types/domain.types'` 改为上面这行，新增 `LedgerEntry`。）

---

## 8. 前端：`subscriptions.shared.ts` 扩展

文件：`frontend/src/pages/Subscriptions/subscriptions.shared.ts`

### 8.1 `SubscriptionView` 类型改为 4 态

```ts
export type SubscriptionView = 'dashboard' | 'subscriptions' | 'usage' | 'archived'
```

### 8.2 `FieldKey` / `FIELD_VISIBILITY` 移除 `rechargeRecords`

- `FieldKey` 类型中删除 `| 'rechargeRecords'`
- `FIELD_VISIBILITY.per_token` 的 `Set` 中删除 `'rechargeRecords'`

### 8.3 新增健康度与周期进度计算函数

在 `usagePercent()` 函数之后新增：

```ts
export type BalanceHealth = 'normal' | 'low' | 'empty'

/** 按量账户余额健康度：归档项强制视为 normal（不强调色）。 */
export function balanceHealth(item: Subscription): BalanceHealth {
  if (item.archived) return 'normal'
  const balance = item.remainingBalance ?? 0
  if (balance <= 0) return 'empty'
  if (item.lowBalanceThreshold != null && balance <= item.lowBalanceThreshold) return 'low'
  return 'normal'
}

/** 环形图填充比例：以预警阈值的 3 倍为"满"刻度；未设阈值时仅区分有/无余额。 */
export function balanceRatio(item: Subscription): number {
  const balance = item.remainingBalance ?? 0
  if (item.lowBalanceThreshold != null && item.lowBalanceThreshold > 0) {
    return balance / (item.lowBalanceThreshold * 3)
  }
  return balance > 0 ? 1 : 0
}

export type CycleHealth = 'normal' | 'soon' | 'overdue'

/** 计费周期健康度：归档项强制视为 normal（不强调色）。 */
export function cycleHealth(item: Subscription): CycleHealth {
  if (item.archived) return 'normal'
  if (isExpired(item)) return 'overdue'
  if (isExpiringSoon(item)) return 'soon'
  return 'normal'
}

export type CycleProgress = { percent: number; elapsedDays: number; totalDays: number }

function daysBetween(startStr: string, endStr: string): number {
  const start = new Date(`${startStr}T00:00:00`)
  const end = new Date(`${endStr}T00:00:00`)
  return Math.round((end.getTime() - start.getTime()) / 86400000)
}

function addPeriod(dateStr: string, unit: 'month' | 'year', delta: number): string {
  const d = new Date(`${dateStr}T00:00:00`)
  if (unit === 'month') d.setMonth(d.getMonth() + delta)
  else d.setFullYear(d.getFullYear() + delta)
  return d.toISOString().slice(0, 10)
}

/**
 * 计费周期进度：monthly/yearly 以 nextBillingDate（或 expireDate）往前推一个周期作为周期起点；
 * one_time 用 startDate~expireDate；lifetime 无周期，返回 null。
 */
export function cycleProgress(item: Subscription): CycleProgress | null {
  const bt = item.billingType
  let startStr: string | undefined
  let endStr: string | undefined

  if (bt === 'one_time') {
    startStr = item.startDate
    endStr = item.expireDate
  } else if (bt === 'monthly' || bt === 'yearly') {
    endStr = item.nextBillingDate ?? item.expireDate
    if (endStr) startStr = addPeriod(endStr, bt === 'monthly' ? 'month' : 'year', -1)
  }

  if (!startStr || !endStr) return null
  const totalDays = daysBetween(startStr, endStr)
  if (totalDays <= 0) return null

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const elapsedRaw = Math.round((today.getTime() - new Date(`${startStr}T00:00:00`).getTime()) / 86400000)
  const elapsedDays = Math.min(Math.max(elapsedRaw, 0), totalDays)
  return { percent: (elapsedDays / totalDays) * 100, elapsedDays, totalDays }
}
```

---

## 9. 前端：`RadialProgress` 组件

新建 `frontend/src/components/ui/RadialProgress.tsx`：

```tsx
import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

type RadialProgressProps = {
  /** 0-1，超出范围会被裁剪 */
  ratio: number
  size?: number
  strokeWidth?: number
  /** 进度弧颜色，传入 text-* 类名，弧线用 stroke="currentColor" 取色 */
  colorClassName?: string
  children?: ReactNode
}

const RADIUS = 24
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

// RadialProgress 纯 SVG 环形进度条，用于按量账户余额可视化，不引入图表库
export function RadialProgress({ ratio, size = 56, strokeWidth = 6, colorClassName, children }: RadialProgressProps) {
  const clamped = Math.min(1, Math.max(0, ratio))
  const offset = CIRCUMFERENCE * (1 - clamped)

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 56 56" className="-rotate-90">
        <circle cx="28" cy="28" r={RADIUS} fill="none" stroke="hsl(var(--muted))" strokeWidth={strokeWidth} />
        <circle
          cx="28"
          cy="28"
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          className={cn('transition-[stroke-dashoffset] duration-500 ease-out', colorClassName)}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  )
}
```

`viewBox="0 0 56 56"` 固定，`size` 通过 `width`/`height` 属性缩放（移动端传 48）。

---

## 10. 前端：`CycleProgressBar` 组件

新建 `frontend/src/pages/Subscriptions/components/CycleProgressBar.tsx`：

```tsx
import type { Subscription } from '../../../types/domain.types'
import { cn, formatDate } from '../../../lib/utils'
import { cycleHealth, cycleProgress, dueDateLabel, type CycleHealth } from '../subscriptions.shared'

const FILL_BY_HEALTH: Record<CycleHealth, string> = {
  normal: 'bg-[hsl(var(--primary))]',
  soon: 'bg-[hsl(var(--warning))]',
  overdue: 'bg-[hsl(var(--destructive))]',
}

const TRACK_BY_HEALTH: Record<CycleHealth, string> = {
  normal: 'bg-muted',
  soon: 'bg-[hsl(var(--warning-soft))]',
  overdue: 'bg-[hsl(var(--destructive-soft))]',
}

// CycleProgressBar 展示 monthly/yearly/one_time 订阅当前计费周期的时间进度，lifetime 不渲染
export function CycleProgressBar({ item }: { item: Subscription }) {
  const progress = cycleProgress(item)
  if (!progress) return null

  const health = cycleHealth(item)
  const percent = health === 'overdue' ? 100 : progress.percent
  const due = dueDateLabel(item)
  const label = item.billingType === 'one_time'
    ? `已进行 ${progress.elapsedDays} / ${progress.totalDays} 天`
    : `本周期已过 ${progress.elapsedDays} / ${progress.totalDays} 天`

  return (
    <div className="mt-3 space-y-1">
      <div className={cn('h-1.5 w-full overflow-hidden rounded-full', TRACK_BY_HEALTH[health])}>
        <div
          className={cn('h-full rounded-full transition-[width] duration-300 ease-out', FILL_BY_HEALTH[health])}
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground">
        <span>{label}</span>
        {due && <span>{due.label}：{formatDate(due.date)}</span>}
      </div>
    </div>
  )
}
```

---

## 11. 前端：提取 `DeleteConfirm` 为独立组件

新建 `frontend/src/pages/Subscriptions/components/DeleteConfirm.tsx`，内容为 `SubscriptionCard.tsx` 中现有的 `DeleteConfirm` 函数（第 133-158 行）原样迁移，补充独立的 import：

```tsx
import * as Popover from '@radix-ui/react-popover'
import { Trash2 } from 'lucide-react'

type DeleteConfirmProps = {
  deleting: boolean
  onConfirm: () => void
}

// DeleteConfirm 删除前的二次确认 Popover，供订阅卡片和用量账户卡片复用
export function DeleteConfirm({ deleting, onConfirm }: DeleteConfirmProps) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button type="button" className="nexus-button-utility h-9 w-9 text-muted-foreground hover:text-destructive" aria-label="删除">
          <Trash2 className="h-4 w-4" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content side="top" align="end" sideOffset={8} className="z-[80] w-[min(calc(100vw-2rem),18rem)] rounded-lg border bg-popover p-3 text-popover-foreground shadow-lg">
          <p className="text-sm font-bold">确认删除这个订阅？</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">此操作无法撤销。</p>
          <div className="mt-4 flex justify-end gap-2">
            <Popover.Close asChild>
              <button type="button" className="nexus-button-utility h-9 px-3 text-xs">取消</button>
            </Popover.Close>
            <button type="button" disabled={deleting} onClick={onConfirm} className="inline-flex h-9 items-center justify-center rounded-md border border-destructive bg-destructive px-3 text-xs font-semibold text-destructive-foreground disabled:opacity-50">
              确认删除
            </button>
          </div>
          <Popover.Arrow className="fill-popover" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
```

在 `SubscriptionCard.tsx` 中：删除原 `DeleteConfirm` 函数定义，新增 `import { DeleteConfirm } from './DeleteConfirm'`。

---

## 12. 前端：`UsagePopover` 改为读取流水接口

文件：`frontend/src/pages/Subscriptions/components/UsagePopover.tsx`

### 12.1 新增依赖与状态

```tsx
import { useQuery } from '@tanstack/react-query'
import { subscriptionApi } from '../../../api/subscription.api'
```

`Popover.Root` 需要受控以驱动查询的 `enabled`：

```tsx
const [open, setOpen] = useState(false)

const { data: ledgerData } = useQuery({
  queryKey: ['subscription-ledger', item.id],
  queryFn: () => subscriptionApi.ledger(item.id, 10),
  enabled: open,
})
const records = ledgerData?.data?.data ?? []
```

`Popover.Root` 标签改为 `<Popover.Root open={open} onOpenChange={setOpen}>`。

### 12.2 替换记录渲染（原第 96-108 行 `records.length > 0 && (...)`）

原代码读取 `item.rechargeRecords`（第 40 行 `const records = (item.rechargeRecords ?? [])...`），删除该行；记录列表改为：

```tsx
            {records.length > 0 && (
              <div className="space-y-1.5 border-t pt-2">
                <p className="text-[11px] font-bold text-muted-foreground">最近流水</p>
                {records.map((r) => (
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
```

标题"最近充值记录"改为"最近流水"。`cn` 已从 `../../../lib/utils` 导入（文件第 5 行已有），无需新增。

### 12.3 充值/消费成功后刷新流水

`onRecharge`/`onConsume` 的失效逻辑在 `index.tsx` 的 mutation 中处理（见第 18 节），`UsagePopover` 本身不需要手动 `invalidateQueries`。

---

## 13. 前端：`SubscriptionCard` 改造（"订阅"Tab 专用）

文件：`frontend/src/pages/Subscriptions/components/SubscriptionCard.tsx`

1. 删除 `import { UsagePopover } from './UsagePopover'`（per_token 不再走这个组件）。
2. 删除函数 `PerTokenInfo`（第 121-131 行）。
3. 删除函数 `DeleteConfirm`（第 133-158 行），新增 `import { DeleteConfirm } from './DeleteConfirm'`。
4. 第 56-79 行的三元表达式：

   ```tsx
   {bt === 'per_token' ? (
     <PerTokenInfo item={item} />
   ) : (
     <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-muted-foreground">
       ...
     </div>
   )}
   ```

   改为去掉三元，只保留 `<div className="flex flex-wrap ...">...</div>` 分支本身（`SubscriptionCard` 现在只会收到非 per_token 的 item）。

5. 第 107-116 行的底部操作区：

   ```tsx
   <div className="mt-4 flex flex-wrap items-center gap-2">
     {bt === 'per_token' && (
       <UsagePopover item={item} onRecharge={onRecharge} onConsume={onConsume} />
     )}
     {item.url && (
       <a href={item.url} target="_blank" rel="noreferrer" className="nexus-button-utility h-9 px-2.5 text-xs">
         打开
       </a>
     )}
   </div>
   ```

   改为：

   ```tsx
   {item.url && (
     <div className="mt-4 flex flex-wrap items-center gap-2">
       <a href={item.url} target="_blank" rel="noreferrer" className="nexus-button-utility h-9 px-2.5 text-xs">
         打开
       </a>
     </div>
   )}
   ```

6. 在到期/已过期提示 banner（第 95-105 行）之后、第 5 步的操作区之前，新增：

   ```tsx
   <CycleProgressBar item={item} />
   ```

   新增 import：`import { CycleProgressBar } from './CycleProgressBar'`。

7. `SubscriptionCardProps` 中 `onRecharge`/`onConsume` 不再被本组件使用，删除这两个 prop 及类型定义（第 22-23 行）。组件签名第 28 行同步删除对应参数。

---

## 14. 前端：新建 `UsageAccountCard`（"用量面板"Tab 专用）

新建 `frontend/src/pages/Subscriptions/components/UsageAccountCard.tsx`：

```tsx
import { ArchiveRestore, Pencil } from 'lucide-react'
import type { Subscription } from '../../../types/domain.types'
import { cn } from '../../../lib/utils'
import { RadialProgress } from '../../../components/ui/RadialProgress'
import { balanceHealth, balanceRatio, type BalanceHealth } from '../subscriptions.shared'
import { DeleteConfirm } from './DeleteConfirm'
import { UsagePopover } from './UsagePopover'

type UsageAccountCardProps = {
  item: Subscription
  deleting: boolean
  onEdit: (item: Subscription) => void
  onDelete: (id: string) => void
  onRecharge: (id: string, data: { amount: number; date?: string; note?: string }) => void
  onConsume: (id: string, data: { amount: number; note?: string }) => void
  onUnarchive?: (id: string) => void
}

const RING_COLOR_BY_HEALTH: Record<BalanceHealth, string> = {
  normal: 'text-[hsl(var(--primary))]',
  low: 'text-[hsl(var(--warning))]',
  empty: 'text-[hsl(var(--destructive))]',
}

const TEXT_COLOR_BY_HEALTH: Record<BalanceHealth, string> = {
  normal: 'text-foreground',
  low: 'text-[hsl(var(--warning))]',
  empty: 'text-[hsl(var(--destructive))]',
}

const BORDER_BY_HEALTH: Record<BalanceHealth, string> = {
  normal: '',
  low: 'border-l-2 border-l-[hsl(var(--warning))]',
  empty: 'border-l-2 border-l-[hsl(var(--destructive))]',
}

// UsageAccountCard 展示按量账户（per_token）的余额环形图、月消费和充值/消费入口
export function UsageAccountCard({ item, deleting, onEdit, onDelete, onRecharge, onConsume, onUnarchive }: UsageAccountCardProps) {
  const health = balanceHealth(item)

  return (
    <article className={cn('rounded-lg border bg-card p-4 shadow-[var(--shadow-xs)]', BORDER_BY_HEALTH[health])}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <RadialProgress ratio={balanceRatio(item)} colorClassName={RING_COLOR_BY_HEALTH[health]}>
            <span className={cn('text-sm font-black', TEXT_COLOR_BY_HEALTH[health])}>
              {item.remainingBalance != null ? item.remainingBalance.toFixed(0) : '—'}
            </span>
          </RadialProgress>

          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-base font-bold text-foreground">{item.name}</h3>
              {item.category && (
                <span className="rounded-full border bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
                  {item.category}
                </span>
              )}
              {item.archived && (
                <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
                  已归档
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-muted-foreground">
              <span className={cn(health !== 'normal' && TEXT_COLOR_BY_HEALTH[health])}>
                余额：{item.remainingBalance?.toFixed(2) ?? '—'}
              </span>
              <span>月消费：{item.monthlySpend?.toFixed(2) ?? '0.00'}</span>
              {item.lowBalanceThreshold != null && (
                <span>预警阈值：{item.lowBalanceThreshold.toFixed(2)}</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={() => onEdit(item)} className="nexus-button-utility h-9 w-9 text-muted-foreground" aria-label="编辑">
            <Pencil className="h-4 w-4" />
          </button>
          {onUnarchive && (
            <button type="button" onClick={() => onUnarchive(item.id)} className="nexus-button-utility h-9 w-9 text-muted-foreground" aria-label="取消归档">
              <ArchiveRestore className="h-4 w-4" />
            </button>
          )}
          <DeleteConfirm deleting={deleting} onConfirm={() => onDelete(item.id)} />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <UsagePopover item={item} onRecharge={onRecharge} onConsume={onConsume} />
      </div>
    </article>
  )
}
```

移动端环形图尺寸：`RadialProgress` 默认 `size=56`；按 DESIGN.md 移动端应为 48。由于 `UsageAccountCard` 在桌面/移动两个 View 中复用同一组件，简化处理：**统一使用 48px**（`<RadialProgress ratio={...} size={48} strokeWidth={5} ...>`），桌面端 56px 与 48px 的视觉差异可忽略，避免为响应式引入额外的尺寸 prop 透传逻辑。修改上面代码片段中的 `<RadialProgress ratio={balanceRatio(item)} colorClassName={RING_COLOR_BY_HEALTH[health]}>` 为 `<RadialProgress ratio={balanceRatio(item)} size={48} strokeWidth={5} colorClassName={RING_COLOR_BY_HEALTH[health]}>`。

---

## 15. 前端：Dashboard Tab 组件

### 15.1 新建 `frontend/src/pages/Subscriptions/components/UsageAccountsSummary.tsx`

```tsx
import type { Subscription } from '../../../types/domain.types'
import { formatMoney } from '../subscriptions.shared'

type CurrencyTotals = { balance: number; spend: number; lowCount: number }

// UsageAccountsSummary 按币种汇总所有按量账户的余额、本月消费和低余额账户数，用于概览 Tab
export function UsageAccountsSummary({ items }: { items: Subscription[] }) {
  if (items.length === 0) return null

  const totals = items.reduce<Record<string, CurrencyTotals>>((acc, item) => {
    const currency = item.currency || 'CNY'
    const entry = acc[currency] ?? { balance: 0, spend: 0, lowCount: 0 }
    entry.balance += item.remainingBalance ?? 0
    entry.spend += item.monthlySpend ?? 0
    if (item.lowBalanceThreshold != null && (item.remainingBalance ?? 0) <= item.lowBalanceThreshold) {
      entry.lowCount += 1
    }
    acc[currency] = entry
    return acc
  }, {})

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Object.entries(totals).map(([currency, t]) => (
        <div key={currency} className="rounded-lg border bg-card p-4 shadow-[var(--shadow-xs)]">
          <p className="text-xs font-semibold text-muted-foreground">按量账户余额（{currency}）</p>
          <p className="mt-1 text-2xl font-black text-foreground">{formatMoney(currency, t.balance)}</p>
          <p className="mt-1 text-[11px] font-bold text-muted-foreground">
            本月已消费 {formatMoney(currency, t.spend)}
            {t.lowCount > 0 && <span className="text-[hsl(var(--warning))]"> · {t.lowCount} 个账户余额偏低</span>}
          </p>
        </div>
      ))}
    </section>
  )
}
```

### 15.2 新建 `frontend/src/pages/Subscriptions/components/SubscriptionsDashboard.tsx`

```tsx
import type { Subscription, SubscriptionStats } from '../../../types/domain.types'
import type { SubscriptionFilter } from '../subscriptions.shared'
import { SubscriptionsStatsBar } from './SubscriptionsStatsBar'
import { SummaryBar } from './SummaryBar'
import { UsageAccountsSummary } from './UsageAccountsSummary'

type SubscriptionsDashboardProps = {
  stats: SubscriptionStats | null
  statsLoading: boolean
  monthlyTotals: Record<string, number>
  expiringCount: number
  expiredCount: number
  filter: SubscriptionFilter
  usageItems: Subscription[]
  onFilterChange: (filter: SubscriptionFilter) => void
}

// SubscriptionsDashboard 概览 Tab：订阅统计、按量账户汇总、到期筛选入口（点击后跳转到"订阅"Tab）
export function SubscriptionsDashboard(props: SubscriptionsDashboardProps) {
  return (
    <div className="space-y-5">
      <SubscriptionsStatsBar stats={props.stats} isLoading={props.statsLoading} />
      <UsageAccountsSummary items={props.usageItems} />
      <SummaryBar
        monthlyTotals={props.monthlyTotals}
        expiringCount={props.expiringCount}
        expiredCount={props.expiredCount}
        filter={props.filter}
        onFilterChange={props.onFilterChange}
      />
    </div>
  )
}
```

---

## 16. 前端：`SubscriptionViewTabs` 改为 4 Tab

文件：`frontend/src/pages/Subscriptions/components/SubscriptionViewTabs.tsx`，整体重写：

```tsx
import { cn } from '../../../lib/utils'
import type { SubscriptionView } from '../subscriptions.shared'

type SubscriptionViewTabsProps = {
  view: SubscriptionView
  archivedCount: number
  usageLowBalanceCount: number
  onViewChange: (view: SubscriptionView) => void
}

const TABS: { key: SubscriptionView; label: string }[] = [
  { key: 'dashboard', label: '概览' },
  { key: 'subscriptions', label: '订阅' },
  { key: 'usage', label: '用量面板' },
  { key: 'archived', label: '已归档' },
]

// SubscriptionViewTabs 顶部 4 个视图切换：概览 / 订阅 / 用量面板 / 已归档
export function SubscriptionViewTabs({ view, archivedCount, usageLowBalanceCount, onViewChange }: SubscriptionViewTabsProps) {
  return (
    <div className="inline-flex max-w-full overflow-x-auto rounded-lg border bg-muted/40 p-1">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onViewChange(tab.key)}
          className={cn(
            'relative h-9 shrink-0 rounded-md px-4 text-xs font-bold transition-colors',
            view === tab.key ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {tab.key === 'archived' ? `已归档 ${archivedCount}` : tab.label}
          {tab.key === 'usage' && usageLowBalanceCount > 0 && (
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[hsl(var(--warning))]" />
          )}
        </button>
      ))}
    </div>
  )
}
```

---

## 17. 前端：表单支持 `initialBillingType`

### 17.1 `frontend/src/pages/Subscriptions/components/SubscriptionFormFields.tsx`

`subscriptionToFormValues` 签名增加第二个可选参数：

```ts
export function subscriptionToFormValues(item?: Subscription | null, initialBillingType?: string): SubscriptionFormValues {
  if (!item) return { ...emptySubscriptionForm, billingType: initialBillingType ?? emptySubscriptionForm.billingType }
  return {
    name: item.name,
    ...
  }
}
```

（仅修改第一行的返回语句，函数其余部分不变。）

### 17.2 `frontend/src/pages/Subscriptions/components/SubscriptionFormDialog.tsx`

新增 prop：

```tsx
type SubscriptionFormDialogProps = {
  open: boolean
  item: Subscription | null
  initialBillingType?: string
  saving: boolean
  ...
}

export function SubscriptionFormDialog({ open, item, initialBillingType, saving, ... }: SubscriptionFormDialogProps) {
  const [values, setValues] = useState<SubscriptionFormValues>(() => subscriptionToFormValues(item, initialBillingType))

  useEffect(() => {
    if (open) setValues(subscriptionToFormValues(item, initialBillingType))
  }, [item, open, initialBillingType])
  ...
```

---

## 18. 前端：`index.tsx` 状态与路由调整

文件：`frontend/src/pages/Subscriptions/index.tsx`

### 18.1 `view` 初始值与分类计算

```ts
const [view, setView] = useState<SubscriptionView>('dashboard')
```

替换原有的派生数据计算（原 `expiringSoonItems`/`expiredItems`/`archivedItems`/`archivedCount`/`filteredItems`）：

```ts
const nonArchivedItems = useMemo(() => items.filter((i) => !i.archived), [items])
const subscriptionItems = useMemo(() => nonArchivedItems.filter((i) => i.billingType !== 'per_token'), [nonArchivedItems])
const usageItems = useMemo(() => nonArchivedItems.filter((i) => i.billingType === 'per_token'), [nonArchivedItems])
const archivedItems = useMemo(() => items.filter((i) => i.archived), [items])
const archivedCount = archivedItems.length
const expiringSoonItems = useMemo(() => subscriptionItems.filter(isExpiringSoon), [subscriptionItems])
const expiredItems = useMemo(() => subscriptionItems.filter(isExpired), [subscriptionItems])
const usageLowBalanceCount = useMemo(
  () => usageItems.filter((i) => i.lowBalanceThreshold != null && (i.remainingBalance ?? 0) <= i.lowBalanceThreshold).length,
  [usageItems],
)

const filteredSubscriptionItems = useMemo(() => {
  if (filter === 'expiring') return expiringSoonItems
  if (filter === 'expired') return expiredItems
  return subscriptionItems
}, [expiredItems, expiringSoonItems, filter, subscriptionItems])
```

（`isExpired(item)` 内部依据 `item.status === 'expired'`，不依赖 archived，`subscriptionItems` 已排除 archived，无需在 `isExpired`/`isExpiringSoon` 内额外判断。）

### 18.2 筛选切换时联动跳转到"订阅"Tab

```ts
const handleFilterChange = (next: SubscriptionFilter) => {
  setFilter(next)
  setView('subscriptions')
}
```

`monthlyTotals` 计算保持 `groupMonthlyTotalsByCurrency(items)` 不变（统计口径覆盖全部订阅，与归档无关——`groupMonthlyTotalsByCurrency` 内部已排除 `archived`，见 `subscriptions.shared.ts` 现有实现，不需要改）。

### 18.3 流水查询失效

`rechargeMutation` / `consumeMutation` 的 `onSuccess` 中新增：

```ts
  const rechargeMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { amount: number; date?: string; note?: string } }) =>
      subscriptionApi.recharge(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
      queryClient.invalidateQueries({ queryKey: ['subscription-stats'] })
      queryClient.invalidateQueries({ queryKey: ['subscription-ledger', variables.id] })
    },
  })

  const consumeMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { amount: number; note?: string } }) =>
      subscriptionApi.consume(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
      queryClient.invalidateQueries({ queryKey: ['subscription-stats'] })
      queryClient.invalidateQueries({ queryKey: ['subscription-ledger', variables.id] })
    },
  })
```

### 18.4 新增按钮的默认计费类型

```ts
const handleCreateClick = () => {
  setEditingItem(null)
  setFormOpen(true)
}

const createBillingType = view === 'usage' ? 'per_token' : 'monthly'
```

### 18.5 `sharedProps` 调整

删除 `filter`（仍保留供 Dashboard 使用，但语义上是"概览筛选状态"）、新增/调整字段：

```ts
  const sharedProps = {
    view,
    onViewChange: setView,
    // 概览 Tab
    stats,
    statsLoading,
    monthlyTotals,
    expiringCount: expiringSoonItems.length,
    expiredCount: expiredItems.length,
    filter,
    onFilterChange: handleFilterChange,
    usageItems,
    // 订阅 Tab
    subscriptionItems: filteredSubscriptionItems,
    // 用量面板 Tab
    usageLowBalanceCount,
    // 已归档 Tab
    archivedItems,
    archivedCount,
    // 通用
    deletingId,
    isLoading,
    onCreateClick: handleCreateClick,
    onEdit: handleEdit,
    onUnarchive: handleUnarchive,
    onDelete: (id: string) => deleteMutation.mutate(id),
    onRecharge: (id: string, data: { amount: number; date?: string; note?: string }) =>
      rechargeMutation.mutate({ id, data }),
    onConsume: (id: string, data: { amount: number; note?: string }) =>
      consumeMutation.mutate({ id, data }),
  }
```

`SubscriptionFormDialog` 渲染处新增 `initialBillingType={createBillingType}`：

```tsx
      <SubscriptionFormDialog
        open={formOpen}
        item={editingItem}
        initialBillingType={createBillingType}
        saving={createMutation.isPending || updateMutation.isPending}
        categories={categoryNames}
        onAiSuggestCategory={handleAiSuggestCategory}
        isAiSuggesting={suggestCategoryMutation.isPending}
        onOpenChange={(open: boolean) => {
          if (!open) closeForm()
          else setFormOpen(true)
        }}
        onSubmit={handleSubmit}
      />
```

---

## 19. 前端：`SubscriptionsDesktopView` / `SubscriptionsMobileView` 重写

两个文件结构相同，仅外层容器 class 不同（沿用现状：Desktop `hidden ... md:block`，Mobile `... md:hidden`）。以下以 Desktop 为例给出完整内容，Mobile 按现状的外层容器/标题区写法套用同样的内部结构（标题字号、`Plus` 按钮尺寸、列表 `space-y-3` vs `grid lg:grid-cols-2` 保持各自原有响应式规则，仅替换 Tab/内容渲染逻辑）。

### 19.1 `frontend/src/pages/Subscriptions/SubscriptionsDesktopView.tsx`

```tsx
import { Plus } from 'lucide-react'
import type { Subscription, SubscriptionStats } from '../../types/domain.types'
import type { SubscriptionFilter, SubscriptionView } from './subscriptions.shared'
import { SubscriptionsDashboard } from './components/SubscriptionsDashboard'
import { SubscriptionCard } from './components/SubscriptionCard'
import { UsageAccountCard } from './components/UsageAccountCard'
import { SubscriptionViewTabs } from './components/SubscriptionViewTabs'

type SubscriptionsDesktopViewProps = {
  view: SubscriptionView
  onViewChange: (view: SubscriptionView) => void
  stats: SubscriptionStats | null
  statsLoading: boolean
  monthlyTotals: Record<string, number>
  expiringCount: number
  expiredCount: number
  filter: SubscriptionFilter
  onFilterChange: (filter: SubscriptionFilter) => void
  usageItems: Subscription[]
  subscriptionItems: Subscription[]
  usageLowBalanceCount: number
  archivedItems: Subscription[]
  archivedCount: number
  deletingId: string | null
  isLoading: boolean
  onCreateClick: () => void
  onEdit: (item: Subscription) => void
  onUnarchive: (id: string) => void
  onDelete: (id: string) => void
  onRecharge: (id: string, data: { amount: number; date?: string; note?: string }) => void
  onConsume: (id: string, data: { amount: number; note?: string }) => void
}

const ADD_BUTTON_LABEL: Record<string, string> = {
  subscriptions: '添加订阅',
  usage: '添加用量账户',
}

// SubscriptionsDesktopView 渲染桌面端订阅工作台布局：4 Tab（概览/订阅/用量面板/已归档）；弹层由父组件统一渲染
export function SubscriptionsDesktopView(props: SubscriptionsDesktopViewProps) {
  const { view } = props
  const showAddButton = view === 'subscriptions' || view === 'usage'

  return (
    <div className="mx-auto hidden max-w-5xl space-y-5 p-6 md:block">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Subscriptions</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">你为什么付费，比你付了多少钱更值得记录。</p>
        </div>
        {showAddButton && (
          <button type="button" onClick={props.onCreateClick} className="nexus-button-primary gap-1.5 px-4 text-sm">
            <Plus className="h-4 w-4" /> {ADD_BUTTON_LABEL[view]}
          </button>
        )}
      </div>

      <SubscriptionViewTabs
        view={view}
        archivedCount={props.archivedCount}
        usageLowBalanceCount={props.usageLowBalanceCount}
        onViewChange={props.onViewChange}
      />

      {view === 'dashboard' && (
        <SubscriptionsDashboard
          stats={props.stats}
          statsLoading={props.statsLoading}
          monthlyTotals={props.monthlyTotals}
          expiringCount={props.expiringCount}
          expiredCount={props.expiredCount}
          filter={props.filter}
          usageItems={props.usageItems}
          onFilterChange={props.onFilterChange}
        />
      )}

      {view === 'subscriptions' && (
        props.isLoading ? (
          <section className="nexus-surface p-4 text-sm text-muted-foreground">加载中...</section>
        ) : props.subscriptionItems.length === 0 ? (
          <section className="nexus-surface p-8 text-center text-sm text-muted-foreground">暂无订阅记录</section>
        ) : (
          <section className="grid gap-3 lg:grid-cols-2">
            {props.subscriptionItems.map((item) => (
              <SubscriptionCard
                key={item.id}
                item={item}
                deleting={props.deletingId === item.id}
                onEdit={props.onEdit}
                onDelete={props.onDelete}
              />
            ))}
          </section>
        )
      )}

      {view === 'usage' && (
        props.isLoading ? (
          <section className="nexus-surface p-4 text-sm text-muted-foreground">加载中...</section>
        ) : props.usageItems.length === 0 ? (
          <section className="nexus-surface p-8 text-center text-sm text-muted-foreground">暂无用量账户</section>
        ) : (
          <section className="grid gap-3 lg:grid-cols-2">
            {props.usageItems.map((item) => (
              <UsageAccountCard
                key={item.id}
                item={item}
                deleting={props.deletingId === item.id}
                onEdit={props.onEdit}
                onDelete={props.onDelete}
                onRecharge={props.onRecharge}
                onConsume={props.onConsume}
              />
            ))}
          </section>
        )
      )}

      {view === 'archived' && (
        props.isLoading ? (
          <section className="nexus-surface p-4 text-sm text-muted-foreground">加载中...</section>
        ) : props.archivedItems.length === 0 ? (
          <section className="nexus-surface p-8 text-center text-sm text-muted-foreground">暂无已归档项</section>
        ) : (
          <section className="grid gap-3 lg:grid-cols-2">
            {props.archivedItems.map((item) => (
              item.billingType === 'per_token' ? (
                <UsageAccountCard
                  key={item.id}
                  item={item}
                  deleting={props.deletingId === item.id}
                  onEdit={props.onEdit}
                  onDelete={props.onDelete}
                  onRecharge={props.onRecharge}
                  onConsume={props.onConsume}
                  onUnarchive={props.onUnarchive}
                />
              ) : (
                <SubscriptionCard
                  key={item.id}
                  item={item}
                  deleting={props.deletingId === item.id}
                  onEdit={props.onEdit}
                  onDelete={props.onDelete}
                  onUnarchive={props.onUnarchive}
                />
              )
            ))}
          </section>
        )
      )}
    </div>
  )
}
```

### 19.2 `frontend/src/pages/Subscriptions/SubscriptionsMobileView.tsx`

结构与 19.1 完全一致，仅以下差异（与现状的桌面/移动差异保持一致）：
- 外层容器：`<div className="space-y-4 p-4 md:hidden">`
- 标题：`<h1 className="text-lg font-black">Subscriptions</h1>`，副标题文案保持现状"订阅、到期和用量。"
- 添加按钮：图标按钮 `<button type="button" onClick={props.onCreateClick} className="nexus-button-primary h-10 w-10 p-0" aria-label={ADD_BUTTON_LABEL[view]}><Plus className="h-4 w-4" /></button>`（`showAddButton` 判断逻辑相同）
- "订阅"/"用量面板"/"已归档" 三个分支的列表容器从 `grid gap-3 lg:grid-cols-2` 改为 `space-y-3`（与现状移动端列表一致）

其余 Tab 渲染逻辑、props 类型、import 与 19.1 完全相同。

---

## 20. 文件改动清单

### 后端
- 新建：`backend/src/main/resources/db/migration/V1_12__subscription_ledger_entries.sql`
- 新建：`backend/src/main/java/com/nexus/entity/SubscriptionLedgerEntry.java`
- 新建：`backend/src/main/java/com/nexus/mapper/SubscriptionLedgerEntryMapper.java`
- 新建：`backend/src/main/java/com/nexus/dto/response/LedgerEntryResponse.java`
- 删除：`backend/src/main/java/com/nexus/dto/RechargeRecordItem.java`
- 修改：`backend/src/main/java/com/nexus/entity/Subscription.java`（删除 `rechargeRecords` 字段及相关 import）
- 修改：`backend/src/main/java/com/nexus/dto/response/SubscriptionResponse.java`（删除 `rechargeRecords` 字段及映射）
- 修改：`backend/src/main/java/com/nexus/service/SubscriptionService.java`（注入 `ledgerMapper`，重写 `recharge`/`consume`，新增 `getLedger`）
- 修改：`backend/src/main/java/com/nexus/controller/SubscriptionController.java`（新增 `GET /{id}/ledger`）
- 修改：`backend/src/test/java/com/nexus/service/SubscriptionServiceTest.java`（流水相关测试）

### 前端
- 新建：`frontend/src/components/ui/RadialProgress.tsx`
- 新建：`frontend/src/pages/Subscriptions/components/CycleProgressBar.tsx`
- 新建：`frontend/src/pages/Subscriptions/components/DeleteConfirm.tsx`
- 新建：`frontend/src/pages/Subscriptions/components/UsageAccountCard.tsx`
- 新建：`frontend/src/pages/Subscriptions/components/UsageAccountsSummary.tsx`
- 新建：`frontend/src/pages/Subscriptions/components/SubscriptionsDashboard.tsx`
- 修改：`frontend/src/types/domain.types.ts`（`LedgerEntry` 替换 `RechargeRecord`）
- 修改：`frontend/src/api/subscription.api.ts`（新增 `ledger()`）
- 修改：`frontend/src/pages/Subscriptions/subscriptions.shared.ts`（`SubscriptionView` 4 态、健康度/周期进度函数、移除 `rechargeRecords` 字段可见性）
- 修改：`frontend/src/pages/Subscriptions/components/UsagePopover.tsx`（接入 `/ledger` 接口，受控 Popover）
- 修改：`frontend/src/pages/Subscriptions/components/SubscriptionCard.tsx`（移除 per_token 分支、接入 `CycleProgressBar`、抽出 `DeleteConfirm`）
- 修改：`frontend/src/pages/Subscriptions/components/SubscriptionViewTabs.tsx`（4 Tab 重写）
- 修改：`frontend/src/pages/Subscriptions/components/SubscriptionFormFields.tsx`（`subscriptionToFormValues` 支持 `initialBillingType`）
- 修改：`frontend/src/pages/Subscriptions/components/SubscriptionFormDialog.tsx`（透传 `initialBillingType`）
- 修改：`frontend/src/pages/Subscriptions/index.tsx`（4 态路由、流水缓存失效、`createBillingType`）
- 修改：`frontend/src/pages/Subscriptions/SubscriptionsDesktopView.tsx`（4 Tab 内容渲染）
- 修改：`frontend/src/pages/Subscriptions/SubscriptionsMobileView.tsx`（4 Tab 内容渲染，移动端布局）

---

## 21. 手动验证清单

1. `mvn -f backend/pom.xml compile` 和 `mvn -f backend/pom.xml test -Dtest=SubscriptionServiceTest` 通过。
2. `pnpm -C frontend build`（或 `tsc --noEmit`）无类型错误。
3. 数据库已有 `recharge_records` 数据的订阅，迁移后能在"用量面板"Tab 的流水 Popover 中看到迁移前的充值记录（`type=recharge`）。
4. "概览"Tab：显示统计卡 + 按量账户余额汇总（按币种）+ 即将到期/已到期筛选 chip；点击筛选 chip 跳转到"订阅"Tab 并应用筛选。
5. "订阅"Tab：仅显示非 `per_token` 订阅；monthly/yearly/one_time 卡片下方显示周期进度条，临近到期变黄、超期变红；lifetime 无进度条。
6. "用量面板"Tab：仅显示 `per_token` 账户；环形图中心显示余额数值，余额低于预警阈值时环形和文字变黄，余额 ≤ 0 时变红；左侧色条同步出现。
7. "用量面板"Tab 中"充值/消费"后，流水 Popover 实时显示新记录（含 consume 类型，红色 `-` 前缀）。
8. "已归档"Tab：订阅类和账户类均可显示，账户类不显示强调色（统一中性色），均可"取消归档"。
9. "添加"按钮：在"订阅"Tab 显示"添加订阅"（默认 `monthly`），在"用量面板"Tab 显示"添加用量账户"（默认 `per_token`），"概览"/"已归档"Tab 不显示。
10. 移动端：4 个 Tab 可横向滚动且不溢出；列表单栏展示；环形图/进度条不导致卡片溢出。

---

## 22. 给用户的开放性问题 / 已做出的假设

1. **环形图比例刻度"预警阈值 × 3"**：未设阈值时退化为"有/无余额"二值显示。如果用户对某个账户设置的阈值偏离实际充值规模较大（比如阈值很小但单次充值很大），环形图会长期接近"满"，这是预期内的简化——后续若有需要可在 Settings 里加一个"参考额度"字段，本计划不引入。
2. **"已归档"Tab 中按量账户的归档判定**：`balanceHealth`/`cycleHealth` 在 `item.archived === true` 时强制返回 `normal`，即归档后即使余额耗尽/已过期也不再显示告警色——与 DESIGN.md Don'ts #6 一致。
3. **"订阅"Tab 不再单独渲染 SummaryBar**：到期筛选 chip 移到"概览"Tab，点击后联动切换视图。如果用户希望在"订阅"Tab 内也能直接看到/清除当前筛选状态，可以后续加一个小的"当前筛选：即将到期 ×"提示条——本计划未包含，按 YAGNI 原则先不做，待实际使用后反馈。
4. **DeepSeek 自动同步余额**（`apiProvider`/`apiFetchEnabled` 等字段）不在本计划范围内，本计划只保证不破坏这些字段的现状（`SubscriptionResponse` 仍不暴露它们）。
