请按照 `docs/superpowers/plans/2026-06-16-subscriptions-ui-polish-v2.md` 执行 Subscriptions 页面的二轮 UI 整改，共 9 处问题，分 7 步完成：

1. **统一"新增"按钮**：把 `usage/UsageTabView.tsx` 里自带的"添加用量账户"按钮去掉，改成受控 `createOpen`/`onCreateOpenChange`；`index.tsx` 新增 `usageCreateOpen` state；`SubscriptionsDesktopView.tsx`/`SubscriptionsMobileView.tsx` 在"订阅"和"用量面板"两个 Tab 下都在标题行展示同一个"+ 新增"按钮，分别指向 `onCreateClick` / `onCreateUsageClick`。

2. **用量面板卡片改单列**：`usage/UsageTabView.tsx` 把卡片容器从 `grid lg:grid-cols-2` 改成 `space-y-3`（已归档 Tab 不动）。

3. **移除用量卡片左侧圆环**：`components/UsageAccountCard.tsx` 删掉 `RadialProgress` 渲染、`RING_COLOR_BY_HEALTH` 常量及对应 import（`balanceRatio` 和 `RadialProgress` 本身不删，只删这处引用）。

4. **余额趋势图 Tooltip 中文化**：`usage/BalanceTrendChart.tsx` 给 `<Area dataKey="balance">` 加 `name="余额"`。

5. **新建订阅表单移除"按量"选项**：`SubscriptionFormFields.tsx` 按计划新增 `billingTypeOptions`（编辑已有按量账户时仍保留该选项），下拉 `options` 用这个变量。

6. **概览趋势图改为"近6个月总支出"折线图**：`subscriptions.shared.ts` 删除 `forecastMonthlySpend`/`ForecastPoint`，新增 `monthlySpendTrend`；删除 `components/dashboard/ForecastChart.tsx`，新建 `MonthlySpendTrendChart.tsx`（配色与 `BalanceTrendChart` 一致的 primary 渐变）。

7. **概览整体布局重排**：`subscriptions.shared.ts` 新增 `toCnyAmount`；删除 `SummaryBar.tsx`、`SubscriptionsStatsBar.tsx`，新建 `SubscriptionsStatsRow.tsx`（6 卡一行，金额全部折算 CNY，"即将到期/已到期"做成同尺寸可点击卡片）；`CategoryPieChart.tsx` 改为接收 `rates` prop（去掉自身汇率请求）；`SubscriptionsDashboard.tsx` 重写为"图表（趋势图+分类饼图）在上、统计行在下、到期时间线在最后"，汇率在 Dashboard 层统一获取一次；同时清理 `monthlyTotals` 这条数据链路（`index.tsx`、Desktop/MobileView、Dashboard props）。

完成后跑 `pnpm build` 确认类型检查通过，再启动 `pnpm dev` 走一遍浏览器验证：概览 Tab 布局、统一的"+ 新增"按钮、用量卡片单列无圆环、余额趋势图中文 Tooltip、新建表单无"按量"但编辑已有按量账户正常、非 CNY 订阅在统计行正确折算为 CNY。

如果执行中遇到方案未覆盖的细节（比如某个 className 的具体取值、某个边界情况的处理），按照方案里说明的设计意图自行决定，不需要中途确认。
