# API Key 分类重构 — 执行提示词

> 将此提示词交给 Claude Code 执行，它会按照方案文档 `docs/api-key-refactor-plan.md` 逐步实施重构。

---

## 提示词

```
请按照 docs/api-key-refactor-plan.md 中的执行方案，完成 API Key 分类重构。

## 背景
将现有 API Key 从"一刀切"改为两种计费类型：
- pay_as_you_go（按量计费）：如 DeepSeek，有余额同步、趋势图、充值记录、当月消费自动计算
- plan_based（套餐型）：如 OpenCode GO、百炼、方舟，纯信息记录（key、平台、到期日等）

核心业务变更：
- 按量计费：去掉手动消费，只保留充值。当月消费 = 月初余额 + 当月充值总额 - 当前余额
- 套餐型：不需要余额/流水/快照，纯信息卡片
- UI 布局：按量计费卡片占满一行置顶展示，套餐型卡片两列网格排在下方

## 执行要求

### Phase 1: 后端

1. **Flyway 迁移** — 创建 `V1_10__api_key_billing_type.sql`：
   - ALTER TABLE api_keys ADD COLUMN billing_type VARCHAR(20) NOT NULL DEFAULT 'plan_based'
   - ALTER TABLE api_keys ADD COLUMN month_start_balance NUMERIC(12,2)
   - 将 api_fetch_enabled=true 的记录 UPDATE 为 pay_as_you_go
   - 初始化 month_start_balance = COALESCE(remaining_balance, 0) + COALESCE(monthly_spend, 0) WHERE billing_type = 'pay_as_you_go'
   - 清理 plan_based 记录的余额相关字段

2. **Entity** — `ApiKey.java` 新增 `billingType`(String) 和 `monthStartBalance`(BigDecimal) 两个字段

3. **DTO**：
   - `ApiKeyCreateRequest` 新增 `billingType` 字段
   - `ApiKeyUpdateRequest` 新增 `billingType` 字段
   - `ApiKeyResponse` 新增 `billingType` 和 `monthStartBalance` 字段，更新 `from()` 映射

4. **Service** — `ApiKeyService.java`，这是核心改造：
   - `create()`: 根据 billingType 设置 apiFetchEnabled、monthStartBalance，套餐型清空余额字段
   - `consume()`: 开头加校验，pay_as_you_go 类型抛 IllegalStateException
   - 新增 `computeMonthlySpend(ApiKey)`: 实时计算月消费 = monthStartBalance + 当月recharge SUM - remainingBalance，负值兜底为 0
   - 新增 `getMonthlyRechargeSum(String apiKeyId, LocalDate since)`: 查询 ledger 中本月 recharge 总额
   - `toResponse()`: pay_as_you_go 类型用 computeMonthlySpend 覆盖 monthlySpend
   - `resetMonthlySpend()` 重命名为 `snapshotMonthStartBalance()`: 只处理 pay_as_you_go 的 key，将 remainingBalance 写入 monthStartBalance
   - `getLedger()`: pay_as_you_go 类型额外加 entryType='recharge' 过滤条件

5. **Scheduler** — `SubscriptionNotifyScheduler.java`:
   - 将 `resetMonthlySpend()` 调用改为 `snapshotMonthStartBalance()`，更新日志文案

### Phase 2: 前端

6. **类型** — `domain.types.ts` 的 `ApiKey` 接口新增：
   - `billingType: 'pay_as_you_go' | 'plan_based'`
   - `monthStartBalance?: number`

7. **API** — `apiKey.api.ts` 的 `create` 方法参数新增 `billingType`

8. **表单** — `ApiKeyFormDialog.tsx` 重构：
   - 表单数据新增 `billingType` 字段，默认 'plan_based'
   - 顶部新增计费类型切换（两个按钮/Tab 样式）
   - 按量计费：provider 用下拉选择（deepseek 等），显示低余额预警相关字段，隐藏套餐名称/到期日
   - 套餐型：provider 改为文本输入（自由输入平台名），显示套餐名称/到期日，隐藏余额预警字段
   - 提交时带上 billingType
   - 按钮文案：按量新建 "创建并同步余额"，套餐新建 "创建"

9. **卡片拆分**：
   - 将 `ApiKeyCard.tsx` 拆分为 `PayAsYouGoCard.tsx` 和 `PlanBasedCard.tsx`
   - `PayAsYouGoCard`: 保留余额、趋势图、刷新按钮、充值入口、充值流水。删除消费入口。流水标题改为"查看充值记录"
   - `PlanBasedCard`: 精简卡片，只展示 provider badge、label、status、masked key+复制、base url、套餐到期日、备注。无余额/图表/流水

10. **列表视图** — `ApiKeyTabView.tsx`：
    - 按 billingType 分组：payAsYouGo 和 planBased
    - payAsYouGo 用 `<div className="space-y-3">` 每个占满一行，在上方
    - planBased 用 `<div className="grid gap-3 lg:grid-cols-2">` 两列网格，在下方
    - Props 中 onConsume 可以保留但不再传递给卡片组件

11. **工具函数** — `apikeys.shared.ts`：
    - `balanceHealth()` 开头加守卫：plan_based 类型直接返回 'normal'

## 注意事项
- 保持项目的注释规范：Java 的类和公共方法加 Javadoc，前端组件加一行用途注释，注释说明 WHY 不是 WHAT，中文优先
- Flyway 迁移文件一旦写好不可修改，注意 SQL 正确性
- 不要删除 consume 相关的后端代码（Controller endpoint、Service method、DTO），只在 Service 层加类型校验拦截
- 前端可以删除 ApiKeyCard.tsx（因为被两个新组件替代），但 useApiKeys.ts 中的 consume mutation 保留
- boolean 字段注意 MyBatis-Plus 的 @TableField 注解（项目已知约束）
- 每完成一个 Phase 后验证编译通过再继续
```
