# Panel Hub Review 修复 — 执行提示词

> 将以下内容完整复制给 Claude Code 即可执行

---

```
你正在 Nexus 项目（/Users/manuelm/Workspace/Projects/Nexus/nexus）的 `panelhub` 分支上工作。

请阅读修复方案文档 `docs/plans/2026-06-24-panelhub-review-fixes.md`，按照文档中的执行顺序逐项修复。以下是每个修复项的具体指令：

## 步骤 1：F2 — Hook 提升到 index.tsx（核心改造）

这是最大的改动，其余 F1/F3/F4 会随之自然解决。

### 1.1 改造 `frontend/src/pages/PanelHub/index.tsx`

- 将现有的 `useApiKeys()` 和 `useCredentials()` 调用的返回值完整保留（包括 create/update/remove/recharge/consume/syncBalance/syncingId/creating 等全部字段）
- 新增操作函数：
  ```ts
  const handleUnarchiveApiKey = (id: string) => apiKeyHook.update(id, { archived: false })
  const handleUnarchiveCredential = (id: string) => credentialHook.update(id, { archived: false })
  ```
- 在 `sharedProps` 中新增全部 API Key 和 Credential 的数据与操作 props（参照方案文档 F2 章节的 props 列表）
- 移除 `sharedProps` 中原有的 `onCreateApiKeyClick` 和 `onCreateCredentialClick`（这两个只是切换 view，不需要了）

### 1.2 改造 `PanelHubDesktopView.tsx`

- 移除文件顶部对 `useApiKeys` 和 `useCredentials` 的 import
- 移除组件内部对 `useApiKeys()` 和 `useCredentials()` 的调用
- 在 `PanelHubDesktopViewProps` 类型中新增全部 API Key / Credential 操作相关 props
- 所有操作改为调用 props 传入的函数
- `ApiKeyTabView` 和 `CredentialTabView` 改为传入数据和操作 props
- 归档区的 API Key 卡片：使用 `props.onUnarchiveApiKey`
- 归档区的 Credential 卡片：新增 `onUnarchive` 传入 `props.onUnarchiveCredential`

### 1.3 改造 `PanelHubMobileView.tsx`

与 Desktop 做完全相同的改造。注意 Mobile 版有 `apiKeyCreateRequestKey` 和 `credentialCreateRequestKey` 状态用于触发创建弹窗——这个机制保留，但 hook 调用移除。

### 1.4 改造 `ApiKeyTabView.tsx`

- 移除内部的 `useApiKeys()` 调用
- Props 改为接收全部数据和操作：
  ```ts
  type ApiKeyTabViewProps = {
    apiKeys: ApiKey[]
    syncingId: string | null
    creating: boolean
    onCreate: (data: ApiKeyCreatePayload) => void
    onUpdate: (id: string, data: Record<string, unknown>) => void
    onDelete: (id: string) => void
    onRecharge: (id: string, data: { amount: number; note?: string }) => void
    onConsume: (id: string, data: { amount: number; note?: string }) => void
    onSyncBalance: (id: string) => void
  }
  ```
- 移除无用的 `onEdit` prop
- 保留内部的 `formOpen/editingItem/handleEdit/handleCreate` 逻辑（表单弹窗是 Tab 内部交互）
- `handleSubmit` 内改为调用 `props.onCreate` / `props.onUpdate`

### 1.5 改造 `CredentialTabView.tsx`

同 ApiKeyTabView 的改造模式：
- 移除内部的 `useCredentials()` 调用
- Props 改为接收数据和操作
- 移除无用的 `onEdit` prop
- 保留内部的表单弹窗逻辑

## 步骤 2：F10 — 原生 select/datalist 替换为 Radix UI Select

项目有标准的 Radix UI Select 组件（`frontend/src/components/ui/Select.tsx`）和已有参考实现（`PanelHub/components/SubscriptionFormFields.tsx` 中的 `SelectField`）。以下 4 处需要替换：

### 2.1 `frontend/src/pages/PanelHub/apikeys/ApiKeyFormDialog.tsx`

- 添加 import：`import * as Select from '@radix-ui/react-select'` 和 `import { Check, ChevronDown } from 'lucide-react'`
- 同时将文件末尾第 169 行的 `import { cn } from '../../../lib/utils'` 移到顶部 import 块（修复 F8）
- 将第 92 行原生 `<select>` 替换为 Radix Select
- Trigger 样式：`nexus-input inline-flex h-9 w-full items-center justify-between gap-2 px-3 text-xs font-semibold shadow-none focus:outline-none focus:ring-2 focus:ring-ring`
- Content 样式：`z-[90] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg`
- Item 样式：`relative flex h-9 cursor-default select-none items-center rounded-md px-8 text-xs font-semibold outline-none data-[highlighted]:bg-accent`
- 注意 `onValueChange` 替代 `onChange`

### 2.2 `frontend/src/pages/PanelHub/credentials/CredentialFormDialog.tsx`

- 移除原生 `<datalist>` 和 `categoryInput` 状态的手动 Enter 逻辑
- 改为：如果 `categories` 列表非空，先渲染一个 Radix Select 供选择已有分类；下方保留一个输入框让用户直接输入新分类名（双通道）
- Select 的 `onValueChange` 直接调用 `update('category', v)`
- 输入框直接 `onChange` 调用 `update('category', e.target.value)`
- 这同时解决了 F9（分类输入体验差）的问题

### 2.3 `frontend/src/pages/Mindbank/components/PromptTemplateManager.tsx`

- 添加 import：`import * as Select from '@radix-ui/react-select'` 和 `import { Check, ChevronDown } from 'lucide-react'`
- 将第 335 行原生 `<select>` 替换为 Radix Select
- options 来自 `Object.keys(PROMPT_TYPE_LABELS)`，label 来自 `PROMPT_TYPE_LABELS[t]`
- 使用与 2.1 相同的 Trigger/Content/Item 样式

### 2.4 `frontend/src/pages/Mindbank/components/MinioFilePicker.tsx`

- 添加 import：`import * as Select from '@radix-ui/react-select'` 和 `import { Check, ChevronDown } from 'lucide-react'`
- 将第 140 行原生 `<select>` 替换为 Radix Select
- 注意 Radix Select 不支持空字符串 value，使用 `'__default__'` 作为"自动使用默认模板"的 value
- 在 `onValueChange` 中：`(v) => setPromptTemplateId(v === '__default__' ? '' : v)`
- 初始值：`value={promptTemplateId || '__default__'}`
- 第一个 Item value 为 `'__default__'`，文本为 "自动使用默认模板"

### 样式统一核验

所有替换后的 Select 组件必须遵循以下规范（与 `SubscriptionFormFields.tsx` 一致）：
- Trigger 高度：表单内统一 `h-9`
- Content position：`popper`，sideOffset：`6`
- Content 圆角：`rounded-lg`
- Item 高度：`h-9`
- Item 圆角：`rounded-md`
- ItemIndicator 用 `<Check>` 图标

## 步骤 3：F5 — 后端 toResponse 不解密

修改 `backend/src/main/java/com/nexus/service/ApiKeyService.java`：

- `toResponse()` 方法改为对 `entity.getEncryptedKey()` 密文做打码，不再调用 `llmConfigService.decrypt()`
- 打码逻辑：如果密文长度 > 9，取前 5 + `...` + 后 4；否则返回 `****`
- 注意：`revealKey()` 方法保持不变（那是用户主动请求解密）

## 步骤 4：F6 — 后端参数上界

修改 `backend/src/main/java/com/nexus/service/ApiKeyService.java`：

- `getLedger()` 方法开头加 `int safeLimit = Math.min(Math.max(limit, 1), 100);`，后续用 `safeLimit`
- `getBalanceHistory()` 方法开头加 `int safeDays = Math.min(Math.max(days, 1), 365);`，后续用 `safeDays`

## 步骤 5：F7 — CredentialCard 复制优化

修改 `frontend/src/pages/PanelHub/credentials/CredentialCard.tsx`：

- `handleCopyPassword` 函数中，如果 `passwordText` 已有值（说明用户刚 reveal 过），直接用本地缓存复制，不再调用 API
- 仅当 `passwordText` 为空时才调用 `credentialApi.revealPassword()`

## 验证

全部修改完成后，依次执行：

```bash
cd frontend && pnpm build
```

```bash
cd backend && JAVA_HOME=/Users/manuelm/.local/share/mise/installs/java/21.0.2 PATH=/Users/manuelm/.local/share/mise/installs/java/21.0.2/bin:/Users/manuelm/.local/share/mise/installs/maven/3.9.2/apache-maven-3.9.2/bin:$PATH mvn -q -pl backend compile
```

确保前端构建和后端编译都通过。

## 注意事项

- 所有代码必须符合 CLAUDE.md 中的注释规范（类注释、方法 Javadoc、WHY 注释、中文优先）
- 不要引入新的依赖（`@radix-ui/react-select` 已经在项目中）
- 不要修改 Flyway 迁移文件
- 不要改动 SubscriptionService / SubscriptionController 等非本次修复范围的文件
- 修改完成后不要自动 commit，等我确认
```
