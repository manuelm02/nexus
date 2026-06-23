# Panel Hub Review 修复方案

> 创建日期：2026-06-24
> 分支：`panelhub`
> 前置条件：Phase 7 全部 9 个子阶段代码已写完，本方案修复 review 中发现的 bug 和改进项

---

## 问题总览

| # | 严重度 | 类型 | 位置 | 描述 |
|---|--------|------|------|------|
| F1 | **P0** | Bug | `PanelHubDesktopView.tsx:127-130` | 渲染回调中调用 `useApiKeys()` Hook，违反 Rules of Hooks |
| F2 | **P1** | 架构 | `PanelHubDesktopView.tsx` + `PanelHubMobileView.tsx` | 重复调用 `useApiKeys()` / `useCredentials()`，状态不共享 |
| F3 | **P1** | Bug | `ApiKeyTabView.tsx` + `CredentialTabView.tsx` | `onEdit` prop 被忽略（`_onEdit`），外部编辑入口断路 |
| F10 | **P1** | UI 规范 | 5 处文件 | 使用原生 `<select>` / `<datalist>` 而非项目标准 Radix UI Select 组件 |
| F4 | **P2** | 功能缺失 | `PanelHubDesktopView.tsx:141` + `PanelHubMobileView.tsx:124-128` | 归档 Tab 中 API Key / Credential 缺少取消归档 |
| F5 | **P2** | 性能 | `ApiKeyService.java:296` | `toResponse()` 每次调用都解密，列表接口会批量解密全部 Key |
| F6 | **P2** | 防御 | `ApiKeyService.java:248` | `getLedger()` 的 LIMIT 参数无上界保护 |
| F7 | **P3** | 性能 | `CredentialCard.tsx:46` | `handleCopyPassword` 重复调用 `revealPassword` API |
| F8 | **P3** | 代码质量 | `ApiKeyFormDialog.tsx:169` | `import { cn }` 放在文件末尾，不符合规范 |
| F9 | **P3** | 功能缺失 | `CredentialFormDialog.tsx:106` | 分类输入使用 datalist + 手动 Enter，体验不流畅 |

---

## F1：渲染回调中调用 Hook（P0 必修）

### 问题

`PanelHubDesktopView.tsx` 第 127-130 行，在归档 API Key 的 `onUnarchive` 回调中调用了 `useApiKeys()`：

```tsx
onUnarchive={(id) => {
  const { update } = useApiKeys()  // ❌ 违反 Rules of Hooks
  update(id, { archived: false })
}}
```

React Hook 只能在组件函数体或自定义 Hook 的顶层调用，不能在回调/条件/循环中调用。此代码在运行时会直接报错。

### 修复

使用组件顶层已解构的 `update` 方法（来自 `useApiKeys()`）。但这依赖 F2 的修复——将 hook 提升到 `index.tsx` 后，`update` 通过 props 传入。

在 F2 修复后，`PanelHubDesktopView` 不再自己调用 `useApiKeys()`，而是从 props 接收所有操作函数。归档区的 `onUnarchive` 改为：

```tsx
onUnarchive={(id) => props.onUnarchiveApiKey(id)}
```

`index.tsx` 中对应逻辑：

```tsx
const handleUnarchiveApiKey = (id: string) => apiKeyHook.update(id, { archived: false })
const handleUnarchiveCredential = (id: string) => credentialHook.update(id, { archived: false })
```

---

## F2：Hook 重复调用，状态不共享（P1 架构修复）

### 问题

当前数据流：

```
index.tsx          → useApiKeys()、useCredentials()  → 仅传 apiKeys/credentials 数组给 Desktop/Mobile
PanelHubDesktopView → useApiKeys()、useCredentials()  → 获取自己的 remove/recharge/consume/syncBalance
PanelHubMobileView  → useApiKeys()、useCredentials()  → 同上
```

TanStack Query 的数据层会去重请求，但 `useState`（如 `syncingId`）是独立实例——点击桌面端的"刷新余额"按钮不会让移动端的同一个 Key 显示 loading 状态。更重要的是，三处各自独立管理 mutation，逻辑分散。

### 修复方案

**原则：`index.tsx` 是唯一数据源，Desktop/Mobile 是纯展示层。**

1. **`index.tsx`** 调用 `useApiKeys()` 和 `useCredentials()`，获取全部数据 + 操作函数
2. 将操作函数（`create/update/remove/recharge/consume/syncBalance/syncingId`）全部通过 `sharedProps` 传给 Desktop 和 Mobile
3. **`PanelHubDesktopView`** 和 **`PanelHubMobileView`** 移除对 `useApiKeys()` / `useCredentials()` 的导入和调用
4. **`ApiKeyTabView`** 和 **`CredentialTabView`** 也改为从 props 接收数据和操作，不再自己调用 hook

### Props 变更

`PanelHubDesktopView` / `PanelHubMobileView` 新增 props：

```typescript
// API Key 相关
apiKeys: ApiKey[]
apiKeySyncingId: string | null
onCreateApiKey: (data: ApiKeyCreatePayload) => void
onUpdateApiKey: (id: string, data: Record<string, unknown>) => void
onDeleteApiKey: (id: string) => void
onRechargeApiKey: (id: string, data: { amount: number; note?: string }) => void
onConsumeApiKey: (id: string, data: { amount: number; note?: string }) => void
onSyncApiKeyBalance: (id: string) => void
apiKeyCreating: boolean

// Credential 相关
credentials: Credential[]
onCreateCredential: (data: CredentialCreatePayload) => void
onUpdateCredential: (id: string, data: Record<string, unknown>) => void
onDeleteCredential: (id: string) => void
credentialCreating: boolean
```

### index.tsx 改造要点

```typescript
const apiKeyHook = useApiKeys()
const credentialHook = useCredentials()

const sharedProps = {
  // ...现有 subscription props...

  // API Key
  apiKeys: apiKeyHook.apiKeys,
  apiKeySyncingId: apiKeyHook.syncingId,
  apiKeyCreating: apiKeyHook.creating,
  onCreateApiKey: apiKeyHook.create,
  onUpdateApiKey: apiKeyHook.update,
  onDeleteApiKey: apiKeyHook.remove,
  onRechargeApiKey: apiKeyHook.recharge,
  onConsumeApiKey: apiKeyHook.consume,
  onSyncApiKeyBalance: apiKeyHook.syncBalance,
  onUnarchiveApiKey: (id: string) => apiKeyHook.update(id, { archived: false }),

  // Credential
  credentials: credentialHook.credentials,
  credentialCreating: credentialHook.creating,
  onCreateCredential: credentialHook.create,
  onUpdateCredential: credentialHook.update,
  onDeleteCredential: credentialHook.remove,
  onUnarchiveCredential: (id: string) => credentialHook.update(id, { archived: false }),
}
```

### ApiKeyTabView / CredentialTabView 改造

改为接收全部数据和操作函数作为 props，移除内部的 `useApiKeys()` / `useCredentials()` 调用。这同时修复了 F3（`onEdit` 不生效的问题），因为编辑状态管理回到了 TabView 组件内部，不再与外层冲突。

---

## F3：`onEdit` prop 被忽略（P1 功能 Bug）

### 问题

`ApiKeyTabView` 和 `CredentialTabView` 接收 `onEdit` prop 但标记为 `_onEdit` 未使用。Desktop/Mobile 传入的都是 `() => {}`。

两个 TabView 内部自建了完整的编辑逻辑（`formOpen` + `editingItem` + `handleEdit`），实际上 `onEdit` prop 设计上是冗余的。

### 修复

随 F2 一起修复。TabView 保留内部的 `formOpen/editingItem/handleEdit` 逻辑（因为编辑弹窗属于 Tab 内部交互），移除无用的 `onEdit` prop 定义，Desktop/Mobile 也不再传入空函数。

---

## F4：归档 Tab 缺少取消归档（P2）

### 问题

- 归档 Subscription 有 `onUnarchive` 按钮 ✅
- 归档 API Key：Desktop 有但实现错误（F1），Mobile 完全没有 `onUnarchive` ❌
- 归档 Credential：Desktop 和 Mobile 都没有 `onUnarchive` ❌

### 修复

在 F2 改造后，Desktop 和 Mobile 的归档区 API Key / Credential 卡片统一传入：

```tsx
// 归档 API Key
<ApiKeyCard
  ...
  onUnarchive={(id) => props.onUnarchiveApiKey(id)}
/>

// 归档 Credential
<CredentialCard
  ...
  onUnarchive={(id) => props.onUnarchiveCredential(id)}
/>
```

---

## F5：列表查询批量解密 Key（P2 性能）

### 问题

`ApiKeyService.toResponse()` 每次调用 `llmConfigService.decrypt()` 再 `maskKey()`。列表接口 `list()` 会对每个 Key 解密一次。这意味着每次打开页面都要执行 N 次 AES 解密操作——虽然 AES 很快，但从安全原则上不应为了展示"打码"结果就把明文解密出来。

### 修复

在 `ApiKey` 实体新增 `maskedKey` 字段，创建/更新时一并计算和存储。`toResponse()` 直接读取 `maskedKey` 字段，不再解密。

#### 数据库

不需要新增 migration——`maskedKey` 可以作为一个 transient 字段在应用层生成后存入 `notes` 里（不推荐），或者新增一列。推荐简单方案：

**方案 A（推荐，零 migration 改动）：对密文做截取打码**

密文本身就是唯一标识，可以取密文前 5 字符 + `...` + 后 4 字符作为打码展示，不需要解密。

修改 `ApiKeyService`：

```java
private ApiKeyResponse toResponse(ApiKey entity) {
    String maskedKey = maskKey(entity.getEncryptedKey());
    return ApiKeyResponse.from(entity, maskedKey);
}
```

但这会改变用户看到的打码格式（从 `sk-abc...wxyz` 变成密文摘要）。如果用户期望看到明文前缀（如 `sk-`），则需要方案 B。

**方案 B（加一列 `key_prefix`）：**

在 `ApiKey` 实体新增 `keyPrefix` 字段（`VARCHAR(20)`），创建/更新时从明文中截取前 8 个字符存储。`maskKey()` 改为拼接 `keyPrefix + ...`。这需要新增 V1_9 migration。

**建议采用方案 A**——打码本身就是为了防泄漏，用户不需要看到明文前缀。如果后续用户反馈需要明文前缀再升级到方案 B。

---

## F6：getLedger LIMIT 无上界（P2 防御）

### 问题

```java
public List<ApiKeyLedgerEntry> getLedger(String id, int limit) {
    ...
    .last("LIMIT " + limit));
}
```

虽然 Spring 会将请求参数转为 `int`，但用户可以传入 `limit=999999999`。

### 修复

在 `ApiKeyService.getLedger()` 加上边界：

```java
public List<ApiKeyLedgerEntry> getLedger(String id, int limit) {
    getOrThrow(id);
    int safeLimit = Math.min(Math.max(limit, 1), 100);
    return ledgerMapper.selectList(new LambdaQueryWrapper<ApiKeyLedgerEntry>()
            .eq(ApiKeyLedgerEntry::getApiKeyId, id)
            .orderByDesc(ApiKeyLedgerEntry::getCreatedAt)
            .last("LIMIT " + safeLimit));
}
```

同理 `getBalanceHistory()` 的 `days` 参数也加上界：

```java
int safeDays = Math.min(Math.max(days, 1), 365);
```

---

## F7：CredentialCard 复制密码重复调用 API（P3）

### 问题

`CredentialCard.tsx` 的 `handleCopyPassword` 每次都调用 `credentialApi.revealPassword()`，即使密码已经 reveal 过了。

### 修复

如果 `passwordRevealed` 为 true 且 `passwordText` 非空，直接复制本地缓存的明文：

```tsx
const handleCopyPassword = async () => {
  try {
    let pw = passwordText
    if (!pw) {
      const res = await credentialApi.revealPassword(item.id)
      pw = res.data?.data ?? ''
    }
    await navigator.clipboard.writeText(pw)
    setPasswordCopied(true)
    setTimeout(() => setPasswordCopied(false), 1500)
  } catch { /* 静默处理 */ }
}
```

---

## F8：import 位置不规范（P3）

### 问题

`ApiKeyFormDialog.tsx` 第 169 行 `import { cn } from '../../../lib/utils'` 放在文件末尾。

### 修复

将该 import 移到文件顶部的 import 块中（第 2-4 行附近）。

---

## F9：CredentialFormDialog 分类输入体验（P3 可选）

### 问题

当前用 `<datalist>` + 手动 Enter 确认分类，用户可能不知道需要按 Enter。

### 修复建议

随 F10 一并修复——改为 Radix Combobox 模式（见 F10-S2）。

---

## F10：下拉框未统一使用 Radix UI Select（P1 UI 规范）

### 问题

项目已有标准的 Radix UI Select 组件（`frontend/src/components/ui/Select.tsx`），`SubscriptionFormFields.tsx` 中也有一个封装好的 `SelectField` 组件正确使用了该规范。但 Phase 6（Mindbank）和 Phase 7（Panel Hub）的部分页面仍然使用了原生 HTML `<select>` 和 `<datalist>`，导致 UI 样式不统一——原生控件无法自定义主题、无动画、dark mode 下样式不可控。

### 影响位置清单

| # | 文件 | 行号 | 当前实现 | 目标实现 |
|---|------|------|---------|---------|
| S1 | `PanelHub/apikeys/ApiKeyFormDialog.tsx` | 92 | 原生 `<select>` — Provider 选择（deepseek/openai/anthropic/claude） | Radix Select |
| S2 | `PanelHub/credentials/CredentialFormDialog.tsx` | 104-115 | 原生 `<datalist>` + 手动 Enter — 分类选择 | Radix Combobox（Select + 自由输入） |
| S3 | `Mindbank/components/PromptTemplateManager.tsx` | 335 | 原生 `<select>` — 模板类型选择（initial_tidy/merge_update/…） | Radix Select |
| S4 | `Mindbank/components/MinioFilePicker.tsx` | 140 | 原生 `<select>` — Prompt 模板选择（支持"自动使用默认模板"空项） | Radix Select |
| S5 | `Mindbank/components/WorkspaceDialog.tsx` | 103-112 | 原生 `<datalist>` — 领域标签（当前为空 datalist，无实际下拉项） | 暂不处理（无数据源） |

### 设计规范参考

项目标准 Select 样式定义在 `frontend/src/components/ui/Select.tsx`，以及 `SubscriptionFormFields.tsx` 中的 `SelectField` 封装。核心样式特征：

```
Trigger:  nexus-input h-10/h-9 w-full items-center justify-between gap-2 px-3 text-sm font-semibold
Content:  z-[90] rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg
Item:     h-9 rounded-md px-8 text-sm font-semibold data-[highlighted]:bg-accent
Indicator: absolute left-2 text-primary <Check icon>
```

### 修复方案

#### S1：ApiKeyFormDialog Provider 选择

将原生 `<select>` 替换为 Radix Select。当前代码：

```tsx
<select value={form.provider} onChange={(e) => update('provider', e.target.value)}
  className="nexus-input h-9 w-full px-3 text-xs">
  {PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
</select>
```

替换为（复用 `SubscriptionFormFields.tsx` 中 `SelectField` 的模式）：

```tsx
import * as Select from '@radix-ui/react-select'
import { Check, ChevronDown } from 'lucide-react'

// 在 JSX 中：
<Select.Root value={form.provider} onValueChange={(v) => update('provider', v)}>
  <Select.Trigger className="nexus-input inline-flex h-9 w-full items-center justify-between gap-2 px-3 text-xs font-semibold shadow-none focus:outline-none focus:ring-2 focus:ring-ring">
    <Select.Value />
    <Select.Icon><ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /></Select.Icon>
  </Select.Trigger>
  <Select.Portal>
    <Select.Content position="popper" sideOffset={6} className="z-[90] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg">
      <Select.Viewport>
        {PROVIDERS.map((p) => (
          <Select.Item key={p} value={p} className="relative flex h-9 cursor-default select-none items-center rounded-md px-8 text-xs font-semibold outline-none data-[highlighted]:bg-accent">
            <Select.ItemIndicator className="absolute left-2 flex h-4 w-4 items-center justify-center text-primary">
              <Check className="h-3.5 w-3.5" />
            </Select.ItemIndicator>
            <Select.ItemText>{p}</Select.ItemText>
          </Select.Item>
        ))}
      </Select.Viewport>
    </Select.Content>
  </Select.Portal>
</Select.Root>
```

#### S2：CredentialFormDialog 分类选择（Combobox 模式）

当前的 `<datalist>` + Enter 体验差。改为 Radix Select + "自定义输入"选项的组合模式。因为分类既可以从已有列表选择，也可以自由输入新分类，需要一个 Combobox 方案。

**方案：使用 Popover + Command 模式（shadcn/ui Combobox 模式）**

由于项目已有 `@radix-ui/react-popover`（被 Select 间接依赖），可以用 Popover 包裹一个列表实现 Combobox。如果不想引入新依赖，可以用简化方案：

**简化方案（推荐）：Radix Select + "输入新分类" 入口**

```tsx
// 分类选择：Select + 末尾固定一个"自定义输入"按钮
<div className="space-y-1">
  {categories.length > 0 ? (
    <Select.Root value={form.category} onValueChange={(v) => update('category', v)}>
      <Select.Trigger className="nexus-input inline-flex h-9 w-full items-center justify-between gap-2 px-3 text-xs font-semibold shadow-none">
        <Select.Value placeholder="选择或输入分类" />
        <Select.Icon><ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /></Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content position="popper" sideOffset={6} className="z-[90] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg">
          <Select.Viewport>
            {categories.map((c) => (
              <Select.Item key={c} value={c} className="relative flex h-9 cursor-default select-none items-center rounded-md px-8 text-xs font-semibold outline-none data-[highlighted]:bg-accent">
                <Select.ItemIndicator className="absolute left-2 flex h-4 w-4 items-center justify-center text-primary">
                  <Check className="h-3.5 w-3.5" />
                </Select.ItemIndicator>
                <Select.ItemText>{c}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  ) : null}
  <input
    value={form.category}
    onChange={(e) => update('category', e.target.value)}
    className="nexus-input h-9 w-full px-3 text-xs"
    placeholder="输入新分类或从上方选择"
  />
</div>
```

实现时可参考 `PanelHub/components/CategoryInput.tsx` 中 Subscription 分类的实现模式（它已经是 Radix Select）。

#### S3：PromptTemplateManager 模板类型选择

将第 335 行原生 `<select>` 替换为 Radix Select：

```tsx
// 当前
<select value={promptType} onChange={(e) => setPromptType(e.target.value as PromptType)}
  className="nexus-input h-9 w-full px-3 text-sm">
  {(Object.keys(PROMPT_TYPE_LABELS) as PromptType[]).map((t) => (
    <option key={t} value={t}>{PROMPT_TYPE_LABELS[t]}</option>
  ))}
</select>

// 替换为
<Select.Root value={promptType} onValueChange={(v) => setPromptType(v as PromptType)}>
  <Select.Trigger className="nexus-input inline-flex h-9 w-full items-center justify-between gap-2 px-3 text-sm font-semibold shadow-none focus:outline-none focus:ring-2 focus:ring-ring">
    <Select.Value />
    <Select.Icon><ChevronDown className="h-4 w-4 text-muted-foreground" /></Select.Icon>
  </Select.Trigger>
  <Select.Portal>
    <Select.Content position="popper" sideOffset={6} className="z-[90] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg">
      <Select.Viewport>
        {(Object.keys(PROMPT_TYPE_LABELS) as PromptType[]).map((t) => (
          <Select.Item key={t} value={t} className="relative flex h-9 cursor-default select-none items-center rounded-md px-8 text-sm font-semibold outline-none data-[highlighted]:bg-accent">
            <Select.ItemIndicator className="absolute left-2 flex h-4 w-4 items-center justify-center text-primary">
              <Check className="h-3.5 w-3.5" />
            </Select.ItemIndicator>
            <Select.ItemText>{PROMPT_TYPE_LABELS[t]}</Select.ItemText>
          </Select.Item>
        ))}
      </Select.Viewport>
    </Select.Content>
  </Select.Portal>
</Select.Root>
```

#### S4：MinioFilePicker Prompt 模板选择

与 S3 相同模式，但需要支持空字符串 value（"自动使用默认模板"）。Radix Select 不允许 `value=""`，改为用一个特殊标记值如 `__default__`：

```tsx
<Select.Root value={promptTemplateId || '__default__'} onValueChange={(v) => setPromptTemplateId(v === '__default__' ? '' : v)}>
  <Select.Trigger className="nexus-input inline-flex h-9 w-full items-center justify-between gap-2 rounded-lg px-3 text-xs font-semibold shadow-none" disabled={promptTemplatesQuery.isLoading}>
    <Select.Value placeholder="自动使用默认模板" />
    <Select.Icon><ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /></Select.Icon>
  </Select.Trigger>
  <Select.Portal>
    <Select.Content position="popper" sideOffset={6} className="z-[90] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg">
      <Select.Viewport>
        <Select.Item value="__default__" className="relative flex h-9 cursor-default select-none items-center rounded-md px-8 text-xs font-semibold outline-none data-[highlighted]:bg-accent">
          <Select.ItemIndicator className="absolute left-2 flex h-4 w-4 items-center justify-center text-primary">
            <Check className="h-3.5 w-3.5" />
          </Select.ItemIndicator>
          <Select.ItemText>自动使用默认模板</Select.ItemText>
        </Select.Item>
        {(promptTemplatesQuery.data ?? []).map((template) => (
          <Select.Item key={template.id} value={template.id} className="relative flex h-9 cursor-default select-none items-center rounded-md px-8 text-xs font-semibold outline-none data-[highlighted]:bg-accent">
            <Select.ItemIndicator className="absolute left-2 flex h-4 w-4 items-center justify-center text-primary">
              <Check className="h-3.5 w-3.5" />
            </Select.ItemIndicator>
            <Select.ItemText>{PROMPT_TYPE_LABELS[template.promptType]} · {template.name}{template.defaultFlag ? '（默认）' : ''}</Select.ItemText>
          </Select.Item>
        ))}
      </Select.Viewport>
    </Select.Content>
  </Select.Portal>
</Select.Root>
```

#### S5：WorkspaceDialog 领域标签

当前 `<datalist>` 为空（无数据源），暂不处理。未来如果后端返回已有 tag 列表，再改为 Radix Select / Combobox。

---

## 执行顺序

建议按以下顺序执行（依赖关系决定）：

| 步骤 | 修复项 | 说明 |
|------|--------|------|
| 1 | F2 | 核心架构改造——Hook 提升到 index.tsx，Desktop/Mobile 改为纯展示 |
| 2 | F1 + F3 + F4 | 随 F2 自然解决——Hook 回调 Bug 消失、onEdit 问题消失、归档取消归档统一实现 |
| 3 | F10 | 全部原生 `<select>` / `<datalist>` 替换为 Radix UI Select（含 F9 的 Credential 分类） |
| 4 | F5 | 后端 `toResponse()` 改为对密文打码 |
| 5 | F6 | 后端 LIMIT/days 参数加上界 |
| 6 | F7 | 前端 CredentialCard 复制优化 |
| 7 | F8 | import 位置修正 |

### 验证

```bash
# 前端编译
cd frontend && pnpm build

# 后端编译
cd backend && mise exec java@21 -- mvn -q -pl backend compile

# 后端测试
cd backend && mise exec java@21 -- mvn -Dtest=SubscriptionServiceTest test
```

---

## 涉及文件清单

### 前端修改

| 文件 | 变更 |
|------|------|
| `pages/PanelHub/index.tsx` | Hook 统一调用 + 全部操作函数通过 sharedProps 下发 |
| `pages/PanelHub/PanelHubDesktopView.tsx` | 移除 `useApiKeys/useCredentials` 调用，改为从 props 接收；修复归档 onUnarchive |
| `pages/PanelHub/PanelHubMobileView.tsx` | 同上 |
| `pages/PanelHub/apikeys/ApiKeyTabView.tsx` | 改为从 props 接收数据和操作，移除 `onEdit` prop |
| `pages/PanelHub/credentials/CredentialTabView.tsx` | 同上 |
| `pages/PanelHub/credentials/CredentialCard.tsx` | 复制密码复用已 reveal 的文本 |
| `pages/PanelHub/apikeys/ApiKeyFormDialog.tsx` | import 位置修正 + 原生 select 改为 Radix Select（F10-S1） |
| `pages/PanelHub/credentials/CredentialFormDialog.tsx` | 原生 datalist 改为 Radix Select + 输入框 Combobox 模式（F10-S2） |
| `pages/Mindbank/components/PromptTemplateManager.tsx` | 原生 select 改为 Radix Select（F10-S3） |
| `pages/Mindbank/components/MinioFilePicker.tsx` | 原生 select 改为 Radix Select（F10-S4） |

### 后端修改

| 文件 | 变更 |
|------|------|
| `service/ApiKeyService.java` | `toResponse()` 改为对密文打码；`getLedger()` 加 LIMIT 上界；`getBalanceHistory()` 加 days 上界 |
