# Subscriptions 用量面板隔离 + DeepSeek 余额监控 + 概览图表 — 执行提示词

执行计划：`docs/superpowers/plans/2026-06-16-subscriptions-usage-redesign.md`

请按以下顺序实现该计划，每完成一个阶段就运行一次相应的验证：

1. **数据库与后端余额能力**：新增 V1_13 迁移（`subscription_balance_snapshots` 表）和 V1_14 迁移（`exchange_rates` 表）；新增 `SubscriptionBalanceSnapshot`/`ExchangeRate` 实体/Mapper/`BalanceSnapshotResponse`；新增 `DeepSeekBalanceClient`（调用 DeepSeek `GET /user/balance`）和 `ExchangeRateClient`（调用 Frankfurter `GET /v1/latest?base=CNY&symbols=...`，返回值需取倒数转换为"1 外币 = X CNY"）+ `ExchangeRateService`（按需刷新 + 24h 缓存）。完成后用 `mise exec java@21 -- mvn -q -pl backend compile` 确认编译通过。

2. **`SubscriptionService` 改造**：注入 `LlmConfigService`（复用其 `encrypt/decrypt`）、`DeepSeekBalanceClient`、`SubscriptionBalanceSnapshotMapper`。`create()` 在 `apiProvider` 非空时加密 Key、`@Transactional` 包裹、创建后立即调用余额同步，失败则整体回滚并抛出友好异常。新增 `syncBalance(id)` / `getBalanceHistory(id, days)` / `syncAllEnabledBalances()` / `distinctActiveCurrencies()`。`SubscriptionCreateRequest` 新增 `apiProvider`/`apiKey`，`SubscriptionResponse` 新增 `apiProvider`/`apiFetchEnabled`/`apiLastFetchedAt`/`apiBalanceJson`（**不**暴露 `apiKeyMasked`）。Controller 新增 `/{id}/sync-balance`、`/{id}/balance-history`、`/exchange-rates`（注入 `ExchangeRateService`）。`SubscriptionNotifyScheduler` 新增每日 00:20 的 `syncExchangeRates` 和每日 00:30 的 `syncApiBalances` 任务（顺序：汇率先于余额同步）。补充 `SubscriptionServiceTest`（mock `DeepSeekBalanceClient`）。完成后跑 `mise exec java@21 -- mvn -q -pl backend test -Dtest=SubscriptionServiceTest`。

3. **前端基础设施**：`pnpm add recharts`；扩展 `domain.types.ts`（Subscription 的 api* 字段 + `BalanceSnapshot`/`ExchangeRates` 类型）；`subscription.api.ts` 新增 `syncBalance`/`balanceHistory`/`createUsageAccount`/`exchangeRates`；新建 `components/ui/Select.tsx`（Radix Select 封装，先确认已安装版本的类型导出）。

4. **用量面板完全独立**：新建 `pages/Subscriptions/usage/` 目录——`useUsageAccounts.ts`（独立的 query/mutation，不复用订阅 Tab 的派生状态）、`UsageAccountCreateDialog.tsx`（Provider 下拉，目前只有 DeepSeek；选中后要求填 API Key，提交即创建+同步余额，失败态展示后端错误信息）、`LedgerHistory.tsx`（从现有 `UsagePopover` 拆出的可折叠流水列表）、`BalanceTrendChart.tsx`（recharts AreaChart 读 `/balance-history`）、`UsageTabView.tsx`（自带"添加用量账户"按钮，右上角，Primary 样式）。重写 `UsageAccountCard.tsx`：加 Provider 徽标、"上次同步+刷新余额"按钮（仅 `apiFetchEnabled`）、趋势图、内联充值/消费输入框（替代弹窗）、底部 `LedgerHistory`。删除 `UsagePopover.tsx` 和 `UsageAccountsSummary.tsx`，全局搜索确认无残留引用。

5. **接线**：`index.tsx` 移除用量相关状态，"用量面板"Tab 改渲染 `<UsageTabView>`；Desktop/Mobile View 的顶部添加按钮只在"订阅"Tab 显示；`SubscriptionFormFields.tsx` 中 `apiFetchEnabled=true` 的 per_token 账户余额字段改为只读展示。

6. **概览三图表**：`subscriptions.shared.ts` 新增 `forecastMonthlySpend` / `categorySpendCNY` / `upcomingDueItems`；新建 `components/dashboard/ForecastChart.tsx`（柱状图，未来6个月）、`CategoryPieChart.tsx`（饼图，CNY 月度等效占比）、`ExpiryTimeline.tsx`（自定义横向列表，未来90天）；重写 `SubscriptionsDashboard.tsx` 接入三者，移除 `UsageAccountsSummary` 引用。`index.tsx` 需要为 Dashboard 单独传一份**未经 filter 筛选**的 `subscriptionItems`。

7. **收尾验证**：跑 `pnpm build`（类型检查）；按计划第 18 节"手动验证清单"逐项在浏览器走一遍，特别关注：① DeepSeek 真实/无效 Key 两种创建路径 ②`apiFetchEnabled` 账户的余额是否仅由"刷新余额"/定时任务更新，充值/消费不影响其 `remainingBalance` ③ 概览三图表在空数据状态下不报错。

实现中遇到计划里"开放性问题/假设"章节提到的歧义（尤其是第 1 节中 `apiFetchEnabled` 账户余额来源的处理方式），按计划默认方案实现即可；如发现默认方案与现有代码结构冲突，先停下来说明冲突点，不要擅自改变数据语义。
