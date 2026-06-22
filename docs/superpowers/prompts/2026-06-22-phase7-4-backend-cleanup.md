# Phase 7.4 — 后端重构（移除 per_token 逻辑）提示词

执行计划：`docs/superpowers/plans/2026-06-22-panel-hub-phase7.md`（Phase 7.4 节）  
前置：Phase 7.3 已完成（ApiKeyService / CredentialService / 两个 Controller 已到位）

---

你正在开发 Nexus 项目（路径：`/Users/manuelm/Workspace/Projects/Nexus/nexus`），Spring Boot 3.x + MyBatis-Plus 3.5.7。请先阅读 `CLAUDE.md`，再阅读计划文档 Phase 7.4 节。

本阶段目标：从 Subscription 相关代码中清理 per_token 逻辑，将 Scheduler 中的 API Key 监控切换到新的 ApiKeyService。**不涉及前端代码。**

> **核心原则**：现有订阅功能（monthly/yearly/one_time/lifetime）必须完全不受影响。只移除 per_token 相关的逻辑和端点。

---

## 第一步：阅读现有代码

请完整阅读以下文件，标记所有与 per_token 相关的代码位置：

- `backend/src/main/java/com/nexus/service/SubscriptionService.java`
- `backend/src/main/java/com/nexus/controller/SubscriptionController.java`
- `backend/src/main/java/com/nexus/scheduler/SubscriptionNotifyScheduler.java`
- `backend/src/main/java/com/nexus/dto/request/SubscriptionCreateRequest.java`
- `backend/src/main/java/com/nexus/dto/response/SubscriptionResponse.java`
- `backend/src/main/java/com/nexus/dto/request/SubscriptionRechargeRequest.java`
- `backend/src/main/java/com/nexus/dto/request/SubscriptionConsumeRequest.java`

同时阅读新创建的 Service 了解迁移后的调用入口：
- `backend/src/main/java/com/nexus/service/ApiKeyService.java`
- `backend/src/main/java/com/nexus/service/CredentialService.java`

## 第二步：修改 SubscriptionService.java

**移除方法（这些功能已迁移到 ApiKeyService）：**
- `recharge()`
- `consume()`
- `syncBalance()`
- `syncBalanceInternal()`
- `syncAllEnabledBalances()`
- `getBalanceHistory()`
- `findLowBalance()`
- `resetMonthlySpend()`
- `writeLedgerEntry()`
- `getLedger()`

**移除不再需要的依赖注入：**
- `SubscriptionLedgerEntryMapper`
- `SubscriptionBalanceSnapshotMapper`
- `DeepSeekBalanceClient`
- 如果 `LlmConfigService` 在移除上述方法后不再被其他方法使用，也移除

**修改 `create()` 方法：**
- 移除 `if (StringUtils.hasText(req.getApiProvider()))` 整个代码块（包括加密 apiKey、设置 apiFetchEnabled、调用 syncBalanceInternal 的逻辑）

**修改 `stats()` 方法（如果有 per_token 的 skip 逻辑）：**
- 移除 `"per_token".equals(s.getBillingType())` 的条件判断

**保留所有与订阅（monthly/yearly/one_time/lifetime）相关的方法**，确保它们不受影响。

## 第三步：修改 SubscriptionController.java

**移除端点：**
- `POST /{id}/recharge`
- `POST /{id}/consume`
- `GET /{id}/ledger`
- `POST /{id}/sync-balance`
- `GET /{id}/balance-history`

**保留端点：**
- `GET /` — 列表
- `POST /` — 创建
- `PATCH /{id}` — 更新
- `DELETE /{id}` — 删除
- `GET /stats` — 统计
- `POST /{id}/usage` — 更新用量（如果存在且不是 per_token 专属）
- `GET /exchange-rates` — 汇率
- `POST /category-suggest` — AI 分类建议

## 第四步：修改 SubscriptionNotifyScheduler.java

**新增依赖注入：** `ApiKeyService`、`CredentialService`

**修改现有方法：**
- `syncApiBalances()` — 原来调用 `subscriptionService.syncAllEnabledBalances()`，改为调用 `apiKeyService.syncAllEnabledBalances()`
- `resetMonthlySpend()` — 改为调用 `apiKeyService.resetMonthlySpend()`
- `checkLowBalance()` — 改为调用 `apiKeyService.findLowBalance()`，保持通知逻辑不变

**新增定时方法：**
- `checkCredentialExpiry()` — `@Scheduled(cron = "0 0 9 * * *")`
  ```java
  List<Credential> expiring = credentialService.findExpiringPasswords(7);
  // 遍历 expiring，为每条发送通知（复用现有通知机制）
  ```
- `checkApiKeyPlanExpiry()` — `@Scheduled(cron = "0 0 9 * * *")`
  ```java
  // 查询 api_keys 中 plan_expire_date 在 7 天内到期的记录
  // 发送通知
  ```

## 第五步：修改 DTO

**修改 `SubscriptionCreateRequest.java`：**
- 移除 `apiProvider` 字段
- 移除 `apiKey` 字段

**修改 `SubscriptionResponse.java`：**
- 移除以下字段：`apiProvider`、`apiFetchEnabled`、`apiLastFetchedAt`、`apiBalanceJson`、`remainingBalance`、`monthlySpend`、`lowBalanceNotify`、`lowBalanceThreshold`
- 更新 `from()` 方法，不再映射这些字段

**删除文件：**
- `backend/src/main/java/com/nexus/dto/request/SubscriptionRechargeRequest.java`
- `backend/src/main/java/com/nexus/dto/request/SubscriptionConsumeRequest.java`

## 第六步：验证

```bash
# 1. 编译——确保没有遗留引用导致编译错误
mise exec java@21 -- mvn -q -pl backend compile

# 2. 启动
mise exec java@21 -- mvn spring-boot:run -Dspring-boot.run.profiles=local

# 3. 验证订阅功能不受影响
curl http://localhost:8080/api/v1/subscriptions -H "Authorization: Bearer TOKEN"
curl http://localhost:8080/api/v1/subscriptions/stats -H "Authorization: Bearer TOKEN"

# 4. 验证已移除的端点返回 404
curl -X POST http://localhost:8080/api/v1/subscriptions/xxx/recharge \
  -H "Authorization: Bearer TOKEN" -H "Content-Type: application/json" \
  -d '{"amount": 100}'
# 应返回 404

# 5. 验证新端点仍然正常
curl http://localhost:8080/api/v1/api-keys -H "Authorization: Bearer TOKEN"
```

**注意事项：**
- 修改 Service 时特别小心不要误删订阅相关逻辑——`recomputeDateBasedStatuses()`、`rollAutoRenewals()` 等方法必须保留
- Scheduler 中 `syncExchangeRates()` 和 `checkSubscriptionExpiry()` 保持不变（它们与 per_token 无关）
- 删除方法前先全局搜索确认没有其他地方引用
- 如果 `SubscriptionService` 中有 `import` 对已删除 DTO 的引用，记得一并清理
