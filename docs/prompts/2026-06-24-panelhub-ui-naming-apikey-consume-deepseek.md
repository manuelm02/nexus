# Panel Hub UI 命名与 API Key 消耗修复计划 + DeepSeek 执行提示词

> 日期：2026-06-24  
> 项目：Nexus  
> 目标：修复 Panel Hub 空状态 UI 不统一、凭证命名不准确、Settings 旧命名残留、DeepSeek API Key 消耗记录体验不清晰的问题。

---

## 一、问题背景

当前 Panel Hub 已从原来的 Subscription 页面扩展为统一管理订阅、API Keys、账号信息和归档项的工作台，但仍存在以下问题：

1. Panel Hub 的 API Keys 和凭证页面在没有记录时，空页面展示是裸文本，和订阅页面的 `nexus-surface` 空状态风格不统一。
2. “凭证/凭据”这个名称不准确。该页面实际用于记录平台账号、用户名、密码、TOTP、URL、到期日等账号信息。
3. 原 Subscription 页面已经改名为 Panel Hub，但 Settings 页面里仍保留 `Subscriptions`、`订阅设置` 等旧文案，需要同步。
4. API Keys 中记录 DeepSeek 原生 API Key 消耗后，用户感觉“没有生效”。当前后端设计是 DeepSeek 官方余额为真值，手动消费只记录流水和月消费，不扣减官方余额；前端没有把这个口径讲清楚。

---

## 二、总体目标

完成后需要达到：

- 订阅、API Keys、账号、已归档的空状态视觉统一。
- 空列表不再被误判为“加载中”。
- 用户界面中的“凭证/凭据”统一改为“账号”。
- Settings 中和 Panel Hub 相关的用户可见文案同步为 Panel Hub。
- DeepSeek API Key 消费记录后，`monthlySpend` 和流水明确刷新；前端清楚提示“官方余额由 DeepSeek 同步，手动消费不会改写官方余额”。
- 不做破坏性数据库/API 重命名。内部 `Credential` 类型、`credentials` 表、`subscriptions` workflow key 可以暂时保留。

---

## 三、推荐命名方案

将用户可见的“凭证/凭据”统一改为：

```text
账号
```

原因：

- “账号”更符合该页面实际用途：记录登录平台、用户名、密码、TOTP、URL 和到期日。
- 不和 API Key 的“密钥”概念混淆。
- 不需要立刻迁移数据库、接口和实体命名。

需要修改的用户可见文案：

- Tab：`凭据` -> `账号`
- 弹窗：`添加凭证` / `编辑凭证` -> `添加账号` / `编辑账号`
- 统计：`N 个凭证` -> `N 个账号`
- 空状态：`暂无凭证，点击上方新增` -> `暂无账号记录`
- 已归档分组：`凭据` -> `账号`
- 页面副标题建议统一为：`订阅、密钥和账号，一处掌控。`

---

## 四、实施计划

### 1. 统一 Panel Hub 空状态 UI

涉及文件：

- `frontend/src/pages/PanelHub/index.tsx`
- `frontend/src/pages/PanelHub/PanelHubDesktopView.tsx`
- `frontend/src/pages/PanelHub/PanelHubMobileView.tsx`
- `frontend/src/pages/PanelHub/apikeys/ApiKeyTabView.tsx`
- `frontend/src/pages/PanelHub/credentials/CredentialTabView.tsx`

当前问题：

- 订阅空状态在父视图里使用：

```tsx
<section className="nexus-surface p-8 text-center text-sm text-muted-foreground">暂无订阅记录</section>
```

- API Keys 和 Credentials Tab 内部使用裸文本：

```tsx
<p className="text-sm text-muted-foreground py-12 text-center">暂无 API Key，点击上方新增</p>
```

- `ApiKeyTabView` / `CredentialTabView` 当前有：

```tsx
if (apiKeys.length === 0) {
  return <p className="text-sm text-muted-foreground py-8 text-center">加载中…</p>
}
```

这会导致真实空列表也显示“加载中…”。

修复方案：

1. 从 `useApiKeys()` / `useCredentials()` 暴露的 `isLoading` 下传到 `PanelHubDesktopView` 和 `PanelHubMobileView`。
2. 再从 Desktop/Mobile 下传到 `ApiKeyTabView` / `CredentialTabView`。
3. TabView 使用 `isLoading` 判断加载态，不再用数组长度判断。
4. 为空时统一使用 `nexus-surface p-8 text-center text-sm text-muted-foreground` 风格。
5. 可抽一个轻量组件，例如：

```tsx
type PanelHubEmptyStateProps = {
  title: string
}

/** Panel Hub 空状态：统一订阅、API Keys、账号和归档页的空列表展示。 */
function PanelHubEmptyState({ title }: PanelHubEmptyStateProps) {
  return (
    <section className="nexus-surface p-8 text-center text-sm text-muted-foreground">
      {title}
    </section>
  )
}
```

建议文案：

- 订阅：`暂无订阅记录`
- API Keys：`暂无 API Key 记录`
- 账号：`暂无账号记录`
- 已归档：`暂无已归档项`

验收标准：

- 首次请求中显示“加载中…”。
- 接口返回空数组后显示统一空状态，不再显示“加载中…”。
- 桌面端和移动端一致。
- 不在空状态中额外加创建按钮，继续使用页面顶部“新增”入口。

---

### 2. 将“凭证/凭据”用户可见文案改为“账号”

涉及文件：

- `frontend/src/pages/PanelHub/components/PanelHubViewTabs.tsx`
- `frontend/src/pages/PanelHub/PanelHubDesktopView.tsx`
- `frontend/src/pages/PanelHub/PanelHubMobileView.tsx`
- `frontend/src/pages/PanelHub/credentials/CredentialTabView.tsx`
- `frontend/src/pages/PanelHub/credentials/CredentialFormDialog.tsx`
- `frontend/src/pages/PanelHub/credentials/CredentialCard.tsx`
- 其他通过 `rg -n "凭证|凭据|Credentials|Credential" frontend/src/pages/PanelHub` 找到的用户可见文案

必须修改：

- `PanelHubViewTabs.tsx`
  - `凭据` -> `账号`
  - 组件注释可改为 `概览 / 订阅 / API Keys / 账号 / 已归档`
- `PanelHubDesktopView.tsx`
  - 页面副标题：`所有服务、密钥和凭证，一处掌控。` -> `订阅、密钥和账号，一处掌控。`
  - 已归档分组：`凭据` -> `账号`
  - 注释中的“凭据”改为“账号”
- `PanelHubMobileView.tsx`
  - 页面副标题：`密钥和凭证，一处掌控。` -> `订阅、密钥和账号，一处掌控。`
  - 已归档分组：`凭据` -> `账号`
  - 注释中的“凭据”改为“账号”
- `CredentialTabView.tsx`
  - 组件注释从“凭证管理”改为“账号管理”
  - `N 个凭证` -> `N 个账号`
  - 空状态 -> `暂无账号记录`
- `CredentialFormDialog.tsx`
  - `添加凭证` / `编辑凭证` -> `添加账号` / `编辑账号`
  - 组件注释同步
- `CredentialCard.tsx`
  - 组件注释同步为账号卡片

不建议本次修改：

- 不重命名 `Credential` TypeScript 类型。
- 不重命名 `CredentialController`、`CredentialService`、`credentials` 表。
- 不重命名 API 路径 `/credentials`。

原因：本次目标是修复用户体验和命名展示，不做大范围数据模型迁移。

验收标准：

- Panel Hub 页面用户可见位置不再出现“凭证/凭据”作为该 Tab 名称。
- 账号相关表单、卡片、归档分组文案一致。
- 现有账号数据正常展示、编辑、归档、取消归档。

---

### 3. Settings 中同步 Panel Hub 命名

涉及文件：

- `frontend/src/pages/Settings/SettingsDesktopView.tsx`
- `frontend/src/pages/Settings/SettingsMobileView.tsx`
- `frontend/src/pages/Settings/components/SubscriptionModelPanel.tsx`
- 如有必要，检查 `frontend/src/pages/Settings/components/SubscriptionCategoriesPanel.tsx`

当前问题：

- Settings Tab 中仍显示 `Subscriptions`。
- 面板组件仍叫 `SubscriptionModelPanel`，标题是 `订阅设置`。
- 页面主入口已叫 Panel Hub，Settings 用户可见文案应同步。

修复方案：

1. `SettingsDesktopView.tsx` 和 `SettingsMobileView.tsx` 中：

```tsx
{ key: 'subscriptions', label: 'Subscriptions' }
```

改为：

```tsx
{ key: 'subscriptions', label: 'Panel Hub' }
```

2. `SubscriptionModelPanel.tsx` 中用户可见文案：

```tsx
<h2>订阅设置</h2>
<p>用于新增/编辑订阅时的 AI 自动分类识别</p>
```

建议改为：

```tsx
<h2>Panel Hub 设置</h2>
<p>用于 Panel Hub 中新增/编辑订阅时的 AI 自动分类识别</p>
```

3. `SubscriptionCategoriesPanel` 如果标题是“订阅分类”，可以保留。因为这个设置实际只管理订阅分类，不是 API Key 或账号分类。

不建议本次修改：

- 不修改 `SettingsTab = 'subscriptions'`。
- 不修改 workflow type `subscriptions`。
- 不修改数据库中 `workflow_type='subscriptions'` 的配置。

原因：

- `subscriptions` 是内部稳定 key。
- 改为 `panelHub` 会涉及 Flyway 迁移、已有配置数据、`SubscriptionCategoryAiService.resolveModel("subscriptions")` 等后端逻辑，不属于本次必要范围。

验收标准：

- Settings 桌面端侧栏显示 `Panel Hub`。
- Settings 移动端 Tab 显示 `Panel Hub`。
- Panel Hub 设置的标题和描述不再让用户以为这是旧的独立 Subscription 页面。
- 保存专用模型仍然可用。

---

### 4. 修复 DeepSeek API Key 消耗记录体验

涉及文件：

- `backend/src/main/java/com/nexus/service/ApiKeyService.java`
- `frontend/src/pages/PanelHub/apikeys/ApiKeyCard.tsx`
- `frontend/src/pages/PanelHub/apikeys/useApiKeys.ts`
- `frontend/src/api/apiKey.api.ts`
- 后端测试文件，建议新增或补充 `ApiKeyServiceTest`

当前后端口径：

在 `ApiKeyService.consume()` 中：

- 非自动余额同步 Provider：
  - 扣减 `remainingBalance`
  - 增加 `monthlySpend`
  - 写入 consume ledger
- DeepSeek 这类 `apiFetchEnabled=true` Provider：
  - 不扣减 `remainingBalance`
  - 增加 `monthlySpend`
  - 写入 consume ledger
  - `balanceAfter` 只作为本地流水快照，不作为官方余额真值

这是合理口径，因为 DeepSeek 官方余额下一次同步会覆盖 `remainingBalance`。如果手动扣减官方余额，下一次刷新又跳回官方余额，用户更容易困惑。

推荐修复方案：

保留后端现有口径，但前端明确展示：

- `官方余额：xx`
- `本月记录消费：xx`
- 自动同步 Key 显示提示：`余额由 DeepSeek 官方同步，手动消费只记录流水和月消费，不改写官方余额。`
- 非自动同步 Key 显示提示：`余额由充值/消费记录计算。`

前端需要确保：

1. `consumeMutation.onSuccess` 已经 invalidate：

```tsx
queryClient.invalidateQueries({ queryKey: ['api-keys'] })
queryClient.invalidateQueries({ queryKey: ['api-key-ledger', id] })
queryClient.invalidateQueries({ queryKey: ['api-key-balance-history', id] })
```

2. 如果现有 query key 与 `LedgerHistory` 内部实际 key 不一致，需要对齐，确保消费后 ledger 立即刷新。
3. 消费成功后 `monthlySpend` 必须刷新。
4. 自动同步 Key 不要刷新 balance history 造成误导，或者保留刷新但 UI 文案明确 balance history 是官方同步历史，不是手动消费历史。

建议后端测试：

新增或补充测试覆盖：

1. `apiFetchEnabled=false`：
   - 初始 `remainingBalance=100`
   - consume `20`
   - 断言 `remainingBalance=80`
   - 断言 `monthlySpend` 增加 `20`
   - 断言写入 `entryType=consume` ledger

2. `apiFetchEnabled=true`：
   - 初始 `remainingBalance=100`
   - consume `20`
   - 断言 `remainingBalance` 仍为 `100`
   - 断言 `monthlySpend` 增加 `20`
   - 断言写入 `entryType=consume` ledger

3. 如果测试或运行中出现 MyBatis-Plus boolean lambda cache 问题，重点检查：

```java
ApiKey::isArchived
ApiKey::isApiFetchEnabled
ApiKey::isLowBalanceNotify
```

项目 AGENTS.md 明确要求避免 `boolean isXxx` 命名导致 lambda cache 解析错误。若触发，应按项目规范改为语义化字段并加 `@TableField` 显式列名，但不要在无失败证据时扩大改动。

验收标准：

- DeepSeek API Key 点击“消费/记录”后：
  - 月消费数字刷新。
  - 流水出现消费记录。
  - 官方余额不变，并有明确提示说明原因。
- 非 DeepSeek 或未开启自动同步的 API Key：
  - 消费后余额扣减。
  - 月消费和流水刷新。

---

## 五、验证命令

前端：

```bash
cd frontend && pnpm typecheck
cd frontend && pnpm build
```

后端：

```bash
cd backend && mvn test
```

如本地 Java/Maven 需要固定路径，可使用项目现有环境：

```bash
cd backend && JAVA_HOME=/Users/manuelm/.local/share/mise/installs/java/21.0.2 PATH=/Users/manuelm/.local/share/mise/installs/java/21.0.2/bin:/Users/manuelm/.local/share/mise/installs/maven/3.9.2/apache-maven-3.9.2/bin:$PATH mvn test
```

手动验证：

- 打开 `/panel-hub` 桌面端，分别检查订阅、API Keys、账号、已归档空状态。
- 用移动端宽度检查同样页面。
- 打开 `/settings`，检查 Tab 是否显示 `Panel Hub`，面板标题和描述是否同步。
- 创建或使用 DeepSeek API Key，记录一次消费，检查月消费和流水刷新，官方余额文案清晰。

---

## 六、给 DeepSeek 的执行提示词

将以下内容完整复制给 DeepSeek 执行：

```text
你正在 Nexus 项目中修复 Panel Hub 相关体验问题。请严格遵守 AGENTS.md：
- 前端导出 React 组件顶部要有一行用途注释。
- 复杂 useEffect/useQuery/useMutation 需要说明触发条件和副作用。
- 后端 @Service/@RestController/@Component 类要有职责注释。
- 非平凡 public 方法保留 Javadoc。
- 注释说明 WHY，不写废话注释。
- 前端响应式必须保持同一路由、业务共享、桌面/移动视图按复杂度拆分。

任务范围：

1. 统一 Panel Hub 空状态 UI。
   - 修改 API Keys 和账号 Tab 的空列表展示，和订阅空状态保持一致，使用 nexus-surface 风格。
   - ApiKeyTabView 和 CredentialTabView 不能再用 items.length === 0 判断“加载中”。
   - 从 useApiKeys/useCredentials 获取 isLoading，并通过 PanelHub/index.tsx -> Desktop/Mobile -> TabView 传递。
   - 空状态文案：
     - 订阅：暂无订阅记录
     - API Keys：暂无 API Key 记录
     - 账号：暂无账号记录
     - 已归档：暂无已归档项

2. 将“凭证/凭据”的用户可见名称统一改为“账号”。
   - 修改 PanelHubViewTabs、PanelHubDesktopView、PanelHubMobileView、CredentialTabView、CredentialFormDialog、CredentialCard 等文件中的用户可见文案。
   - Tab 从“凭据”改为“账号”。
   - 弹窗从“添加凭证/编辑凭证”改为“添加账号/编辑账号”。
   - 数量统计从“N 个凭证”改为“N 个账号”。
   - 已归档分组从“凭据”改为“账号”。
   - 页面副标题统一为“订阅、密钥和账号，一处掌控。”
   - 不要重命名 Credential 类型、CredentialService、CredentialController、credentials 表或 /credentials API。

3. Settings 中同步 Panel Hub 命名。
   - SettingsDesktopView 和 SettingsMobileView 中，tab label 从 “Subscriptions” 改为 “Panel Hub”。
   - SubscriptionModelPanel 的标题从“订阅设置”改为“Panel Hub 设置”。
   - 描述改为“用于 Panel Hub 中新增/编辑订阅时的 AI 自动分类识别”。
   - 可以保留 SubscriptionCategoriesPanel 的“订阅分类”文案，因为它实际只管理订阅分类。
   - 不要修改内部 SettingsTab key `subscriptions`。
   - 不要修改 workflow type `subscriptions`。
   - 不要做 Flyway 迁移。

4. 修复 DeepSeek 原生 API Key “记录消耗没生效”的体验。
   - 保留后端当前业务口径：apiFetchEnabled=true 的 remainingBalance 由 DeepSeek 官方同步作为真值，手动消费不扣减 official remainingBalance。
   - 手动消费必须增加 monthlySpend 并写入 consume ledger。
   - 非自动同步 Provider 的消费仍然扣减 remainingBalance。
   - 在 ApiKeyCard 中把自动同步 Key 的余额文案改清楚：
     - 显示“官方余额：xx”
     - 显示“本月记录消费：xx”
     - 提示“余额由 DeepSeek 官方同步，手动消费只记录流水和月消费，不改写官方余额。”
   - 对非自动同步 Key 显示“余额由充值/消费记录计算。”
   - 检查 useApiKeys 中 consume 成功后是否 invalidate api-keys 和对应 ledger query，确保月消费和流水立即刷新。
   - 补充后端测试：
     - apiFetchEnabled=false：消费后余额减少、monthlySpend 增加、写入 consume ledger。
     - apiFetchEnabled=true：消费后余额不变、monthlySpend 增加、写入 consume ledger。
   - 如果测试或运行出现 MyBatis-Plus boolean lambda cache 问题，重点检查 ApiKey::isArchived、ApiKey::isApiFetchEnabled、ApiKey::isLowBalanceNotify，按项目规范修复；不要在没有失败证据时扩大改动。

完成后运行：

cd frontend && pnpm typecheck
cd frontend && pnpm build
cd backend && mvn test

如果本地 Java/Maven 需要固定路径，使用：

cd backend && JAVA_HOME=/Users/manuelm/.local/share/mise/installs/java/21.0.2 PATH=/Users/manuelm/.local/share/mise/installs/java/21.0.2/bin:/Users/manuelm/.local/share/mise/installs/maven/3.9.2/apache-maven-3.9.2/bin:$PATH mvn test

最后输出：
- 修改文件列表
- 每个问题的修复说明
- 验证命令结果
- 任何未覆盖风险或需要人工确认的地方
```
