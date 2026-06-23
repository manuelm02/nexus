# Phase 7.3 — 后端 Service + Controller 提示词

执行计划：`docs/superpowers/plans/2026-06-22-panel-hub-phase7.md`（Phase 7.3 节）  
前置：Phase 7.2 已完成（实体、Mapper、DTO 全部到位）

---

你正在开发 Nexus 项目（路径：`/Users/manuelm/Workspace/Projects/Nexus/nexus`），Spring Boot 3.x + MyBatis-Plus 3.5.7。请先阅读 `CLAUDE.md`，再阅读计划文档 Phase 7.3 节。

本阶段目标：实现 ApiKeyService、CredentialService、ApiKeyController、CredentialController。共 4 个文件。

---

## 第一步：阅读参考文件

请仔细阅读以下文件，理解业务逻辑模式、事务管理、错误处理、API 响应结构：

- `backend/src/main/java/com/nexus/service/SubscriptionService.java`（**重点**看 create、syncBalanceInternal、recharge、consume、writeLedgerEntry 方法——这些逻辑将在 ApiKeyService 中重新实现）
- `backend/src/main/java/com/nexus/controller/SubscriptionController.java`（Controller 写法、ApiResponse 包装）
- `backend/src/main/java/com/nexus/integration/balance/DeepSeekBalanceClient.java`（余额查询客户端）
- `backend/src/main/java/com/nexus/service/LlmConfigService.java`（encrypt / decrypt 方法——ApiKeyService 和 CredentialService 都要注入并调用）
- `backend/src/main/java/com/nexus/dto/response/ApiResponse.java`（统一响应结构）

## 第二步：创建 ApiKeyService

创建 `backend/src/main/java/com/nexus/service/ApiKeyService.java`：

**依赖注入（构造器注入）：**
- `ApiKeyMapper`
- `ApiKeyLedgerEntryMapper`
- `ApiKeyBalanceSnapshotMapper`
- `LlmConfigService`（复用 encrypt / decrypt）
- `DeepSeekBalanceClient`

**方法实现清单：**

1. `List<ApiKeyResponse> list()` — 查询 `archived=false`，按 `createdAt DESC`，每条调用 `toResponse()` 转换
2. `List<ApiKeyResponse> listArchived()` — 查询 `archived=true`
3. `ApiKeyResponse create(ApiKeyCreateRequest req)` — **@Transactional**
   - 加密 apiKey：`llmConfigService.encrypt(req.getApiKey())`
   - 构建 ApiKey 实体，status=active
   - 判断 provider 是否支持余额查询（当前只有 "deepseek"），若支持则 `apiFetchEnabled=true`
   - `apiKeyMapper.insert(entity)`
   - 若 apiFetchEnabled，立即调用 `syncBalanceInternal(entity)`（失败时整个事务回滚）
   - 返回 `toResponse(entity)`
4. `ApiKeyResponse update(String id, ApiKeyUpdateRequest req)` — PATCH 语义
   - 查询现有记录，字段非 null 才更新
   - 若 `req.getApiKey() != null`，重新加密
   - `apiKeyMapper.updateById(entity)`
5. `void delete(String id)` — `apiKeyMapper.deleteById(id)`
6. `ApiKeyResponse recharge(String id, ApiKeyRechargeRequest req)` — **@Transactional**
   - 查询 ApiKey
   - 若 `apiFetchEnabled=false`：更新 `remainingBalance += amount`
   - 若 `apiFetchEnabled=true`：不修改余额（Provider 是 source of truth）
   - 写 ledger entry（entryType=recharge, balanceAfter=当前余额）
   - 返回更新后的 response
7. `ApiKeyResponse consume(String id, ApiKeyConsumeRequest req)` — **@Transactional**
   - 类似 recharge，但 `remainingBalance -= amount`，`monthlySpend += amount`
   - entryType=consume
8. `ApiKeyResponse syncBalance(String id)` — **@Transactional**
   - 查询 ApiKey，检查 apiFetchEnabled=true
   - 调用 `syncBalanceInternal(entity)`
   - 返回更新后的 response
9. `void syncAllEnabledBalances()` — 查询所有 `apiFetchEnabled=true && archived=false`，逐个 sync，单条失败不影响其他
10. `private void syncBalanceInternal(ApiKey entity)` — **核心方法**
    - `String plainKey = llmConfigService.decrypt(entity.getEncryptedKey())`
    - switch(provider) 调用对应 Client：
      - "deepseek" → `deepSeekBalanceClient.fetchBalance(plainKey)` 获取 `ProviderBalanceResult`
      - 其他 provider → 抛异常或跳过（预留扩展）
    - 覆写 entity.remainingBalance = result.balance()
    - entity.apiBalanceJson = result.raw()
    - entity.apiLastFetchedAt = now()
    - 若余额 ≤ 0 → entity.status = "exhausted"
    - `apiKeyMapper.updateById(entity)`
    - 插入 ApiKeyBalanceSnapshot（balance, currency, rawJson, snapshottedAt=now）
11. `List<ApiKeyLedgerEntry> getLedger(String id, int limit)` — 按 `createdAt DESC` 查询最近 N 条
12. `List<ApiKeyBalanceSnapshot> getBalanceHistory(String id, int days)` — 查询最近 N 天的快照
13. `List<ApiKey> findLowBalance()` — 查询 `lowBalanceNotify=true && archived=false && remainingBalance < lowBalanceThreshold`
14. `void resetMonthlySpend()` — 将所有 api_keys 的 monthlySpend 重置为 0
15. `String revealKey(String id)` — 查询 ApiKey，`return llmConfigService.decrypt(entity.getEncryptedKey())`

**辅助方法：**
- `private ApiKeyResponse toResponse(ApiKey entity)` — 解密 Key 取前5+后4位生成 maskedKey，调用 `ApiKeyResponse.from(entity, maskedKey)`
- `private void writeLedgerEntry(String apiKeyId, String type, BigDecimal amount, BigDecimal balanceAfter, String note, LocalDate date)` — 构建并插入 ledger entry

## 第三步：创建 CredentialService

创建 `backend/src/main/java/com/nexus/service/CredentialService.java`：

**依赖注入：** `CredentialMapper`、`LlmConfigService`

**方法实现：**

1. `List<CredentialResponse> list()` — `archived=false`，`createdAt DESC`
2. `List<CredentialResponse> listArchived()` — `archived=true`
3. `CredentialResponse create(CredentialCreateRequest req)`
   - 若 `req.getPassword() != null`：`entity.encryptedPassword = llmConfigService.encrypt(req.getPassword())`
   - 若 `req.getTotpSecret() != null`：`entity.encryptedTotpSecret = llmConfigService.encrypt(req.getTotpSecret())`
   - insert 并返回
4. `CredentialResponse update(String id, CredentialUpdateRequest req)` — PATCH 语义
   - password / totpSecret 非 null 时重新加密
5. `void delete(String id)`
6. `String revealPassword(String id)` — `return llmConfigService.decrypt(entity.getEncryptedPassword())`
7. `String revealTotpSecret(String id)` — `return llmConfigService.decrypt(entity.getEncryptedTotpSecret())`
8. `List<Credential> findExpiringPasswords(int daysAhead)` — 查询 `expireDate BETWEEN today AND today+daysAhead`

## 第四步：创建 ApiKeyController

创建 `backend/src/main/java/com/nexus/controller/ApiKeyController.java`：

```java
@RestController
@RequestMapping("/api/v1/api-keys")
@RequiredArgsConstructor
```

端点：

| 方法 | 路径 | Service 调用 | 返回 |
|------|------|-------------|------|
| GET | `/` | `list()` | `ApiResponse<List<ApiKeyResponse>>` |
| POST | `/` | `create(req)` | `ApiResponse<ApiKeyResponse>` |
| PATCH | `/{id}` | `update(id, req)` | `ApiResponse<ApiKeyResponse>` |
| DELETE | `/{id}` | `delete(id)` | `ApiResponse<Void>` |
| POST | `/{id}/recharge` | `recharge(id, req)` | `ApiResponse<ApiKeyResponse>` |
| POST | `/{id}/consume` | `consume(id, req)` | `ApiResponse<ApiKeyResponse>` |
| POST | `/{id}/sync-balance` | `syncBalance(id)` | `ApiResponse<ApiKeyResponse>` |
| GET | `/{id}/ledger` | `getLedger(id, limit)` | `ApiResponse<List<...>>` |
| GET | `/{id}/balance-history` | `getBalanceHistory(id, days)` | `ApiResponse<List<...>>` |
| POST | `/{id}/reveal-key` | `revealKey(id)` | `ApiResponse<String>` |

- ledger 接口：`@RequestParam(defaultValue = "20") int limit`
- balance-history 接口：`@RequestParam(defaultValue = "30") int days`
- reveal-key 用 POST（不是 GET），防止浏览器缓存和 URL 历史记录泄露

## 第五步：创建 CredentialController

创建 `backend/src/main/java/com/nexus/controller/CredentialController.java`：

```java
@RestController
@RequestMapping("/api/v1/credentials")
@RequiredArgsConstructor
```

端点：

| 方法 | 路径 | Service 调用 | 返回 |
|------|------|-------------|------|
| GET | `/` | `list()` | `ApiResponse<List<CredentialResponse>>` |
| POST | `/` | `create(req)` | `ApiResponse<CredentialResponse>` |
| PATCH | `/{id}` | `update(id, req)` | `ApiResponse<CredentialResponse>` |
| DELETE | `/{id}` | `delete(id)` | `ApiResponse<Void>` |
| POST | `/{id}/reveal-password` | `revealPassword(id)` | `ApiResponse<String>` |
| POST | `/{id}/reveal-totp` | `revealTotpSecret(id)` | `ApiResponse<String>` |

## 第六步：验证

```bash
# 编译
mise exec java@21 -- mvn -q -pl backend compile

# 启动
mise exec java@21 -- mvn spring-boot:run -Dspring-boot.run.profiles=local

# API 测试（需替换 TOKEN 为有效 JWT）
# 创建 API Key
curl -X POST http://localhost:8080/api/v1/api-keys \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"label":"测试 DeepSeek","provider":"deepseek","apiKey":"sk-test-key-12345"}'

# 列表
curl http://localhost:8080/api/v1/api-keys -H "Authorization: Bearer TOKEN"

# 解密
curl -X POST http://localhost:8080/api/v1/api-keys/{id}/reveal-key -H "Authorization: Bearer TOKEN"

# 创建凭证
curl -X POST http://localhost:8080/api/v1/credentials \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"platform":"GitHub","label":"工作账号","username":"manuelm","password":"secret123"}'

# 解密密码
curl -X POST http://localhost:8080/api/v1/credentials/{id}/reveal-password -H "Authorization: Bearer TOKEN"
```

**注意事项：**
- 所有 Service/Controller 使用 `@RequiredArgsConstructor` 构造器注入，不用 `@Autowired` 字段注入
- `@Transactional` 放在涉及多表写操作的方法上（create with sync、recharge、consume）
- 类顶部 Javadoc 说明职责，公共方法必须有 Javadoc
- syncBalanceInternal 失败（API Key 无效等）时应抛异常让 @Transactional 回滚，create() 中捕获并返回友好错误信息
- revealKey/revealPassword 返回的是纯字符串，包在 `ApiResponse<String>` 中
