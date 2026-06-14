# Subscriptions UI 重构 DeepSeek/Codex Prompt

你是资深全栈工程师，请在 Nexus 项目中实施 Subscriptions 页面 UI 重构（在 Phase 4 基础 CRUD 之上的扩展）。

项目路径：

```text
/Users/manuelm/Workspace/Projects/Nexus/nexus
```

开始前必须阅读：

```text
AGENTS.md
.design/DESIGN.md
docs/superpowers/plans/2026-06-14-subscriptions-phase-4.md
docs/superpowers/plans/2026-06-14-subscriptions-ui-redesign.md
.planning/2026-06-09-product-roadmap/task_plan.md
backend/src/main/java/com/nexus/entity/Subscription.java
backend/src/main/java/com/nexus/controller/SubscriptionController.java
backend/src/main/java/com/nexus/service/SubscriptionService.java
backend/src/main/java/com/nexus/service/BookmarkAiService.java
backend/src/main/java/com/nexus/service/LlmConfigService.java
frontend/src/pages/Subscriptions/
frontend/src/pages/Settings/components/InboxSettingsPanel.tsx
```

`docs/superpowers/plans/2026-06-14-subscriptions-ui-redesign.md` 是本次实施的唯一详细计划，包含所有已与用户确认的决策（Background Decisions）、按类型字段矩阵、统计口径、Non-Goals 和验收标准。本提示词只是该计划的执行摘要，**如有冲突以计划文件为准**。

## 目标

把 `/subscriptions` 页面从"单一表单 + 单一卡片样式"改造为按订阅类型（月度 monthly / 年度 yearly / 一次性 one_time / 买断 lifetime / 按量 per_token）展示不同表单字段和不同卡片信息的产品形态，并新增：

```text
- 订阅分类管理（Settings 页面新增面板，增删分类）+ AI 分类识别/复用/生成
- 按量类型的余额、当月消费、充值记录（充值/记录消费两个独立动作）、欠费通知
- 月度/年度的"自动续费"开关，开启后每日任务自动滚动到期日期到下一周期（不标记 expired）
- 归档（archived）独立开关，归档项默认从列表和统计中排除
- 4 项统计面板：订阅中数量、月度订阅费、年度订阅费、本月待支付订阅费（按币种分组）
```

## 强制原则（来自计划文件 Background Decisions / Non-Goals，完整版见计划文件）

```text
1. billingType 沿用现有 5 个值（monthly/yearly/one_time/lifetime/per_token），不改名、不新增值。
2. 自动续费滚动：仅 autoRenew=true 的 monthly/yearly 在到期时按周期前移日期，保持 active，
   不标记 expired；autoRenew=false 和 one_time 继续走现有 autoExpireOverdue。
   lifetime/per_token 不参与到期扫描；lifetime 的 status 白名单去掉 expired。
3. archived 是独立布尔字段（不是 status），所有类型都有；归档项默认从列表/统计排除，
   筛选 chip 新增 archived 选项查看。
4. per_token 新增 remainingBalance/monthlySpend/rechargeRecords/lowBalanceNotify/lowBalanceThreshold：
   - 充值（recharge）：余额 += amount，rechargeRecords 头部插入一条记录（含 balanceAfter）
   - 记录消费（consume）：余额 -= amount（可为负），monthlySpend += amount，不写入 rechargeRecords
   - monthlySpend 每月 1 日 00:10 自动清零
5. 订阅分类：新增 subscription_categories 表（Settings 增删管理）；新增 AI 识别端点：
   - 分类表为空 -> AI 生成新分类并持久化
   - 分类表非空 -> AI 在现有分类中选最匹配的，都不合适则生成新分类并持久化
   - LLM 调用失败要降级返回，不抛异常（参照 BookmarkAiService 的降级原则）
6. 统计端点 GET /api/v1/subscriptions/stats，按 currency 分组：activeCount/monthlyTotal/yearlyTotal/dueThisMonth，
   口径见计划文件"统计口径"章节。
7. 前端表单按 billingType 动态渲染字段（严格按计划文件"按类型字段矩阵"），
   切换类型时不清空已填字段，提交时只发送当前类型适用字段。
8. 所有非平凡 public 方法 / 导出组件按 AGENTS.md 写注释。
9. 不要修改已应用的 V1_2~V1_9 迁移脚本，新迁移命名为 V1_10__subscriptions_redesign.sql。
```

## 后端实现顺序

### 1. 迁移 V1_10

新增 `backend/src/main/resources/db/migration/V1_10__subscriptions_redesign.sql`：

```sql
ALTER TABLE subscriptions
    ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS remaining_balance NUMERIC(12,2),
    ADD COLUMN IF NOT EXISTS monthly_spend NUMERIC(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS recharge_records JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS low_balance_notify BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS low_balance_threshold NUMERIC(12,2);

CREATE TABLE IF NOT EXISTS subscription_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(64) NOT NULL UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);
```

> 先检查项目中其他表的 UUID 主键生成方式（应用层 vs `gen_random_uuid()`），`subscription_categories.id` 与现有惯例保持一致；若惯例是应用层生成，调整迁移和实体写法。

### 2. 实体 / DTO

```text
- Subscription.java 新增字段：autoRenew, archived, remainingBalance, monthlySpend,
  rechargeRecords(List<RechargeRecordItem>, @TableField(typeHandler = JacksonTypeHandler.class)，
  参照现有 apiBalanceJson 写法), lowBalanceNotify, lowBalanceThreshold
- 新增 RechargeRecordItem { id, amount, date, note, balanceAfter, createdAt }
- 新增 SubscriptionCategory entity + SubscriptionCategoryMapper
- SubscriptionCreateRequest/UpdateRequest 新增上述字段（monthlySpend/rechargeRecords 不走通用 update）
- SubscriptionResponse 补充新字段
- 新增 SubscriptionRechargeRequest{amount>0必填, date可空默认今天, note可空}
- 新增 SubscriptionConsumeRequest{amount>0必填, note可空}
- 新增 SubscriptionStatsResponse{activeCount, monthlyTotal, yearlyTotal, dueThisMonth: Map<String,BigDecimal>}
- 新增 SubscriptionCategorySuggestRequest{name必填, notes可空} / SubscriptionCategorySuggestResponse{category, isNew}
- 新增 SubscriptionCategoryResponse{id,name,createdAt} / SubscriptionCategoryCreateRequest{name必填}
```

### 3. Service

```text
SubscriptionService 新增：
- update() 中 lifetime 类型禁止 status=expired
- recharge(id, req): 仅 per_token；余额累加，rechargeRecords 头插新记录（含 balanceAfter）
- consume(id, req): 仅 per_token；余额扣减（可负），monthlySpend 累加
- stats(): 按 Background Decisions/统计口径计算（内存聚合即可，数据量小）
- rollAutoRenewals(): active && autoRenew=true && billingType in (monthly,yearly) 且已过期的，
  按周期（monthly+1月/yearly+1年）循环前移 expireDate 和 nextBillingDate 直到 >= today，保持 active
- resetMonthlySpend(): 所有 per_token 的 monthlySpend 置 0
- findLowBalance(): per_token && lowBalanceNotify && remainingBalance < lowBalanceThreshold && !archived

新增 SubscriptionCategoryService: list()(按name排序) / create(name)(已存在则返回已有，不抛异常) / delete(id)

新增 SubscriptionCategoryAiService.suggest(req):
  参照 BookmarkAiService 的 LlmConfigService.resolveModel(workflowType) 用法
  1. 读取所有现有分类名
  2. 空 -> LLM 生成新分类名，持久化，返回 {category, isNew:true}
  3. 非空 -> LLM 从现有列表中选最匹配的，或生成新分类名（持久化），返回 {category, isNew}
  4. LLM 异常 -> 降级返回 {category:"未分类"或简单规则, isNew:false}，不抛异常
```

### 4. Controller

```text
SubscriptionController 新增：
  POST /api/v1/subscriptions/{id}/recharge
  POST /api/v1/subscriptions/{id}/consume
  GET  /api/v1/subscriptions/stats
  POST /api/v1/subscriptions/category-suggest

新增 SubscriptionCategoryController：
  GET    /api/v1/subscription-categories
  POST   /api/v1/subscription-categories
  DELETE /api/v1/subscription-categories/{id}

注意 /stats 和 /category-suggest 是静态路径，写完后 curl 验证不会被 /{id} 路由误捕获。
```

### 5. Scheduler — SubscriptionNotifyScheduler.java

```text
- rollAutoRenewals() 与 markExpiredSubscriptions() 同 @Scheduled(cron = "0 5 0 * * *")，
  顺序调用：先 rollAutoRenewals() 再 markExpiredSubscriptions()（顺序很重要）
- resetMonthlySpend(): 新增 @Scheduled(cron = "0 10 0 1 * *")（每月1日00:10）
- checkLowBalance(): 可与 checkSubscriptionExpiry()(09:00) 同时段，
  对 findLowBalance() 结果发送新增的 NotificationEvent.SUBSCRIPTION_LOW_BALANCE
  （payload: {name, remainingBalance, threshold}）
```

### 6. 后端测试

```text
SubscriptionServiceTest 新增：
- recharge: 余额累加正确，rechargeRecords头插含balanceAfter；非per_token抛异常
- consume: 余额扣减可为负，monthlySpend累加；非per_token抛异常
- rollAutoRenewals: autoRenew=true过期记录前移到>=today且仍active；autoRenew=false不受影响
- resetMonthlySpend: 所有per_token的monthlySpend清零
- stats(): 按currency分组的monthly/yearly/dueThisMonth计算正确，archived/非active不计入
- lifetime类型 update status=expired 抛异常

新增 SubscriptionCategoryServiceTest: create去重、list排序
新增 SubscriptionCategoryAiServiceTest: 空列表生成并持久化；非空列表复用；LLM异常降级不抛异常
新增 V1_10 迁移列/表存在性测试
```

## 前端实现顺序

### 1. 类型与 API

```text
- domain.types.ts: Subscription 补充 autoRenew/archived/remainingBalance?/monthlySpend/
  rechargeRecords: RechargeRecord[]/lowBalanceNotify/lowBalanceThreshold?
  新增 RechargeRecord{id,amount,date,note?,balanceAfter,createdAt}
  新增 SubscriptionCategory{id,name,createdAt}
  新增 SubscriptionStats{activeCount, monthlyTotal, yearlyTotal, dueThisMonth: Record<string,number>}
- subscription.api.ts 新增 recharge/consume/stats/suggestCategory
- 新增 subscriptionCategory.api.ts: list/create/delete
```

### 2. 共享逻辑 subscriptions.shared.ts

```text
- 按类型字段可见性映射（FIELD_VISIBILITY，驱动表单/卡片渲染，按计划文件"按类型字段矩阵"编码）
- dueDateLabel(item)/相关日期取值：monthly/yearly取nextBillingDate或expireDate，
  one_time取expireDate，lifetime展示购买日期(startDate)，per_token不展示
- formatRechargeRecord 等展示辅助函数
```

### 3. Settings 分类管理

```text
新增 frontend/src/pages/Settings/components/SubscriptionCategoriesPanel.tsx
  参照 InboxSettingsPanel 的列表+增删 mutation 写法：chip列表+删除按钮+新增输入框
接入 SettingsDesktopView.tsx / SettingsMobileView.tsx
```

### 4. Subscriptions 页面

```text
新增/改造：
frontend/src/pages/Subscriptions/index.tsx                          # 编排 + stats/categories query
frontend/src/pages/Subscriptions/SubscriptionsDesktopView.tsx
frontend/src/pages/Subscriptions/SubscriptionsMobileView.tsx
frontend/src/pages/Subscriptions/components/SubscriptionsStatsBar.tsx   # 新增：4个统计卡
frontend/src/pages/Subscriptions/components/SubscriptionCard.tsx        # 按类型展示
frontend/src/pages/Subscriptions/components/SubscriptionFormFields.tsx  # 按类型动态字段
frontend/src/pages/Subscriptions/components/CategoryInput.tsx           # 新增：输入框+AI识别按钮+现有分类建议
frontend/src/pages/Subscriptions/components/UsagePopover.tsx            # 改造：充值/记录消费/充值记录列表
frontend/src/pages/Subscriptions/components/SummaryBar.tsx              # 即将到期/已到期筛选保留
```

要求：

```text
- StatsBar: 订阅中数量(单数字) + 月度/年度/本月待支付(按币种分行展示，多币种堆叠)，
  数据来自 GET /subscriptions/stats，loading用skeleton，沿用 .nexus-surface

- CategoryInput: 文本输入 + "AI识别"按钮（name为空时禁用，loading用spinner），
  点击调用 suggestCategory({name, notes})，结果回填分类字段；isNew=true时invalidate分类列表query；
  另外提供现有分类的快捷选择（简单datalist或Radix Popover列表）

- SubscriptionFormFields 按billingType动态渲染（严格按计划文件字段矩阵）：
  通用: name*, category(CategoryInput), billingType(Select 5选项), archived(编辑时显示的Switch)
  monthly/yearly: price+currency, startDate, expireDate, nextBillingDate(DatePicker),
    autoRenew(Switch), notifyEnabled+notifyDaysBefore, url, notes, status(编辑时)
  one_time: price+currency, startDate, expireDate(label="结束日期"),
    notifyEnabled+notifyDaysBefore(label="结束提醒"), url, notes, status(编辑时)
  lifetime: price+currency, startDate(label="购买日期"), notes, status(编辑时,去掉expired选项)
  per_token: category, status(编辑时), remainingBalance(新建可填初始值,编辑时只读),
    monthlySpend(只读), lowBalanceNotify+lowBalanceThreshold, notes
  切换billingType不清空已填字段；提交只发送当前类型适用字段

- SubscriptionCard 按类型展示（见计划文件），归档项显示"已归档"灰色chip

- UsagePopover(per_token专用): 展示余额/当月消费/欠费阈值；
  "充值"区: 金额+日期(默认今天)+备注 -> recharge()；
  "记录消费"区: 金额+备注 -> consume()；
  充值记录倒序列表(日期/金额/备注/充值后余额)

- 筛选chip扩展为 all|expiring|expired|archived，默认all排除archived=true

- 所有导出组件顶部加一行中文注释说明用途
```

## 设计要求

```text
- 遵守 .design/DESIGN.md：warm canvas + 白色 surface + 单一主色，
  卡片 rounded-lg + hairline + Level-1 shadow，按钮 rounded-md，输入框 rounded-xs
- 状态/到期/欠费颜色用 hsl(var(--success|warning|destructive)) token，对齐 Phase 4 既有写法
- 统计卡和表单保持工作台密度，不做营销页风格
```

## 测试和验证

```bash
cd frontend && pnpm build
cd backend && JAVA_HOME=/Users/manuelm/.local/share/mise/installs/java/21.0.2 \
  PATH=/Users/manuelm/.local/share/mise/installs/java/21.0.2/bin:/Users/manuelm/.local/share/mise/installs/maven/3.9.2/apache-maven-3.9.2/bin:/usr/bin:/bin:/usr/sbin:/sbin \
  mvn test
```

启动一次本地后端，确认 V1_10 迁移成功应用；手动验证：
- 创建 per_token 订阅 -> recharge -> consume -> GET 确认余额/月消费/充值记录正确
- GET /subscriptions/stats 返回结构正确
- category-suggest：空分类表场景（生成并持久化）+ 非空场景（复用现有分类）

前端：在 `/subscriptions` 分别创建 5 种类型，确认表单字段集合符合矩阵；Settings 增删分类后表单建议同步；统计卡随数据变化正确刷新。

## 禁止事项

```text
- 不要修改已应用的 V1_2~V1_9 迁移脚本
- 不要改变 billingType 的 5 个枚举值或其前端 label
- 不要让 lifetime/per_token 参与到期自动扫描
- 不要把 archived 实现成 status 的第5个值
- 不要在 consume 时写入 rechargeRecords，不要在 recharge 时修改 monthlySpend
- 不要引入新的 UI 库或汇率换算逻辑
- 不要绕过 AGENTS.md 注释规范
```

## 完成标准

```text
- /subscriptions 页面按 billingType 渲染 5 套不同表单字段，符合字段矩阵
- 卡片按类型展示对应信息，归档项可通过筛选chip单独查看且默认隐藏
- per_token 订阅可充值/记录消费，余额和当月消费正确更新，充值记录倒序展示
- monthly/yearly 开启autoRenew后，到期自动滚动周期且不变为expired
- Settings 可增删订阅分类；表单分类输入框AI识别可用（含空分类表首次生成场景）
- GET /subscriptions/stats 返回的4项统计在页面StatsBar正确展示
- frontend build 通过；backend test 通过（含新增测试和V1_10迁移断言）
```

## 实现过程中如遇到以下问题，暂停并询问用户（不要自行决定）

```text
- subscription_categories.id 的UUID生成方式与现有表惯例是否一致
- SubscriptionCategoryAiService 的 workflowType 是否有现成可复用的，还是需要新增
- recharge_records 数量较多时是否需要分页（默认全部渲染）
- archived 与 status=paused 的UI文案如何区分（默认两者独立，视觉上需可区分）
```
