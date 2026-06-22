# Phase 7.2 — 后端实体 + Mapper + DTO 提示词

执行计划：`docs/superpowers/plans/2026-06-22-panel-hub-phase7.md`（Phase 7.2 节）  
前置：Phase 7.1 已完成（V1_20 迁移已应用，4 张新表已创建）

---

你正在开发 Nexus 项目（路径：`/Users/manuelm/Workspace/Projects/Nexus/nexus`），Spring Boot 3.x + MyBatis-Plus 3.5.7。请先阅读 `CLAUDE.md` 了解项目规范，再阅读计划文档 Phase 7.2 节。

本阶段目标：创建 ApiKey、Credential 及其关联的 Java 实体类、MyBatis-Plus Mapper 接口、请求/响应 DTO。共 16 个文件，不涉及 Service / Controller / 前端。

---

## 第一步：阅读参考文件

请先阅读以下文件，理解项目的实体、Mapper、DTO 编码模式：

- `backend/src/main/java/com/nexus/entity/Subscription.java`（实体写法、注解、boolean 字段命名）
- `backend/src/main/java/com/nexus/entity/SubscriptionLedgerEntry.java`（子表实体）
- `backend/src/main/java/com/nexus/entity/SubscriptionBalanceSnapshot.java`（JSONB 字段写法）
- `backend/src/main/java/com/nexus/mapper/SubscriptionMapper.java`（Mapper 写法）
- `backend/src/main/java/com/nexus/mapper/SubscriptionLedgerEntryMapper.java`
- `backend/src/main/java/com/nexus/dto/request/SubscriptionCreateRequest.java`（Request DTO）
- `backend/src/main/java/com/nexus/dto/request/SubscriptionUpdateRequest.java`（PATCH 语义 DTO）
- `backend/src/main/java/com/nexus/dto/request/SubscriptionRechargeRequest.java`（简单 Request）
- `backend/src/main/java/com/nexus/dto/response/SubscriptionResponse.java`（Response DTO + static from() 方法）

## 第二步：创建实体（4 个文件）

1. **`backend/src/main/java/com/nexus/entity/ApiKey.java`**
   - `@TableName(value = "api_keys", autoResultMap = true)`（autoResultMap 因为有 JSONB 字段）
   - `@TableId(type = IdType.ASSIGN_UUID)` String id
   - 字段对应 api_keys 表所有列
   - boolean 字段命名规范（**关键**）：
     ```java
     @TableField("low_balance_notify")
     private boolean lowBalanceNotify;
     
     @TableField("archived")
     private boolean archived;
     
     @TableField("api_fetch_enabled")
     private boolean apiFetchEnabled;
     ```
   - JSONB 字段：`@TableField(typeHandler = JsonbTypeHandler.class)` private Object apiBalanceJson
   - 自动填充：`@TableField(fill = FieldFill.INSERT)` createdAt，`@TableField(fill = FieldFill.INSERT_UPDATE)` updatedAt
   - 类顶部 Javadoc：一句话说明"API Key 实体，对应 api_keys 表，管理各平台 API 密钥的加密存储与状态"

2. **`backend/src/main/java/com/nexus/entity/Credential.java`**
   - `@TableName("credentials")`（无 JSONB 字段，不需要 autoResultMap）
   - 字段对应 credentials 表所有列
   - boolean `archived` 同上写法
   - 类顶部 Javadoc："账号凭证实体，管理各平台登录账号、密码和 TOTP 密钥的加密存储"

3. **`backend/src/main/java/com/nexus/entity/ApiKeyLedgerEntry.java`**
   - `@TableName("api_key_ledger_entries")`
   - 镜像 `SubscriptionLedgerEntry`，将 `subscriptionId` 改为 `apiKeyId`
   - 类顶部 Javadoc："API Key 流水记录，记录充值和消费明细"

4. **`backend/src/main/java/com/nexus/entity/ApiKeyBalanceSnapshot.java`**
   - `@TableName(value = "api_key_balance_snapshots", autoResultMap = true)`
   - 镜像 `SubscriptionBalanceSnapshot`，将 `subscriptionId` 改为 `apiKeyId`
   - JSONB 字段 rawJson 同 SubscriptionBalanceSnapshot 写法

## 第三步：创建 Mapper（4 个文件）

5-8. 每个实体对应一个 Mapper，放在 `backend/src/main/java/com/nexus/mapper/` 下：
   - `ApiKeyMapper extends BaseMapper<ApiKey>`
   - `CredentialMapper extends BaseMapper<Credential>`
   - `ApiKeyLedgerEntryMapper extends BaseMapper<ApiKeyLedgerEntry>`
   - `ApiKeyBalanceSnapshotMapper extends BaseMapper<ApiKeyBalanceSnapshot>`
   - 无需自定义 SQL 方法，MyBatis-Plus 的 lambda 查询已经够用

## 第四步：创建 Request DTO（6 个文件）

放在 `backend/src/main/java/com/nexus/dto/request/` 下：

9. **`ApiKeyCreateRequest.java`**
   - `@NotBlank` String label — 人可读标签
   - `@NotBlank` String provider — 平台名
   - `@NotBlank` String apiKey — 明文 API Key（传入后由 Service 加密，不存储明文）
   - 可选：String baseUrl, String planName, LocalDate planExpireDate, String subscriptionId, Boolean lowBalanceNotify, BigDecimal lowBalanceThreshold, String notes

10. **`ApiKeyUpdateRequest.java`**
    - 全部字段 nullable（PATCH 语义，null 表示不更新）
    - String label, provider, apiKey（若提供则 Service 重新加密）, baseUrl, status, planName, subscriptionId, notes
    - LocalDate planExpireDate
    - Boolean lowBalanceNotify, archived
    - BigDecimal lowBalanceThreshold

11. **`ApiKeyRechargeRequest.java`**
    - `@NotNull @DecimalMin("0.01")` BigDecimal amount
    - LocalDate date（可选，默认 today）
    - String note（可选）

12. **`ApiKeyConsumeRequest.java`**
    - `@NotNull @DecimalMin("0.01")` BigDecimal amount
    - String note（可选）

13. **`CredentialCreateRequest.java`**
    - `@NotBlank` String platform
    - 可选：String label, category, username, password（明文）, totpSecret（明文）, url, notes, subscriptionId
    - LocalDate expireDate

14. **`CredentialUpdateRequest.java`**
    - 全部字段 nullable
    - String platform, label, category, username, password, totpSecret, url, notes, subscriptionId
    - LocalDate expireDate
    - Boolean archived

## 第五步：创建 Response DTO（2 个文件）

放在 `backend/src/main/java/com/nexus/dto/response/` 下：

15. **`ApiKeyResponse.java`**
    - 包含 ApiKey 实体的所有字段，**但**用 `maskedKey` 替代 `encryptedKey`
    - maskedKey 示例：对于 `sk-abcdefghijklmnop`，显示为 `sk-ab...mnop`（前5位 + "..." + 后4位）
    - 提供 `static ApiKeyResponse from(ApiKey entity, String maskedKey)` 方法
    - **不要**暴露 encryptedKey 原文

16. **`CredentialResponse.java`**
    - 包含 Credential 实体除加密字段外的所有字段
    - 新增 `boolean passwordSet`（= encryptedPassword != null）和 `boolean totpSet`（= encryptedTotpSecret != null）
    - **不要**暴露 encryptedPassword 和 encryptedTotpSecret
    - 提供 `static CredentialResponse from(Credential entity)` 方法

## 第六步：编译验证

```bash
mise exec java@21 -- mvn -q -pl backend compile
# 确认所有 16 个文件编译通过，无错误
```

**注意事项：**
- 所有实体类使用 `@Data @Builder @NoArgsConstructor @AllArgsConstructor` 注解（参照 Subscription.java）
- 所有 DTO 使用 `@Data`，Request DTO 带 Jakarta Validation 注解
- **boolean 字段绝对不用 `isXxx` 命名**，否则 MyBatis-Plus lambda cache 会解析错误
- 中文注释优先，类顶部必须有一句话 Javadoc 说明职责
- DTO 中的日期类型统一用 `java.time.LocalDate`，时间戳用 `java.time.LocalDateTime`
