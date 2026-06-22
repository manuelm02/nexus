# Phase 7.8 — Credentials Tab 组件提示词

执行计划：`docs/superpowers/plans/2026-06-22-panel-hub-phase7.md`（Phase 7.8 节）  
前置：Phase 7.7 已完成（API Keys Tab UI 已到位）

---

你正在开发 Nexus 项目（路径：`/Users/manuelm/Workspace/Projects/Nexus/nexus`），React 18 + TypeScript + Tailwind CSS v3 + shadcn/ui + TanStack Query。请先阅读 `CLAUDE.md`，再阅读计划文档 Phase 7.8 节。

本阶段目标：实现 Credentials Tab 的完整 UI 组件——账号密码卡片（含 TOTP 验证码实时展示）、创建/编辑表单、Hook。

---

## 第一步：安装依赖

```bash
cd /Users/manuelm/Workspace/Projects/Nexus/nexus/frontend
pnpm add otpauth
# 若有 postinstall 脚本需执行：
pnpm approve-builds
```

`otpauth` 库用于在客户端从 TOTP secret 计算当前 6 位验证码。

## 第二步：阅读参考文件

- `frontend/src/pages/PanelHub/apikeys/ApiKeyCard.tsx`（刚创建的卡片，参考布局/样式一致性）
- `frontend/src/pages/PanelHub/apikeys/useApiKeys.ts`（Hook 模式）
- `frontend/src/pages/PanelHub/apikeys/ApiKeyFormDialog.tsx`（表单对话框模式）
- `frontend/src/api/credential.api.ts`（Phase 7.5 创建的 API 层）
- `frontend/src/types/domain.types.ts`（Credential 类型定义）

## 第三步：创建 credentials/credentials.shared.ts

创建 `frontend/src/pages/PanelHub/credentials/credentials.shared.ts`：

```typescript
import type { Credential } from '../../../types/domain.types'

/** 判断凭证是否即将到期 */
export function isExpiringSoon(credential: Credential, daysAhead = 30): boolean {
  if (!credential.expireDate) return false
  const expire = new Date(credential.expireDate)
  const threshold = new Date()
  threshold.setDate(threshold.getDate() + daysAhead)
  return expire <= threshold
}

/** 计算距到期还有几天（null 表示无到期日） */
export function daysUntilExpiry(credential: Credential): number | null {
  if (!credential.expireDate) return null
  const diff = new Date(credential.expireDate).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

/** 是否已过期 */
export function isExpired(credential: Credential): boolean {
  if (!credential.expireDate) return false
  return new Date(credential.expireDate) < new Date()
}

/** 按 category 分组 */
export function groupByCategory(credentials: Credential[]): Record<string, Credential[]> {
  const groups: Record<string, Credential[]> = {}
  for (const c of credentials) {
    const cat = c.category || '未分类'
    ;(groups[cat] ??= []).push(c)
  }
  return groups
}

/** Platform 名称到展示色的映射 */
export const PLATFORM_COLORS: Record<string, string> = {
  github: 'bg-gray-800 text-white',
  google: 'bg-blue-100 text-blue-700',
  aws: 'bg-amber-100 text-amber-700',
  azure: 'bg-sky-100 text-sky-700',
  vercel: 'bg-black text-white',
}
```

## 第四步：创建 credentials/useCredentials.ts

创建 `frontend/src/pages/PanelHub/credentials/useCredentials.ts`：

- **Query：** `useQuery(['credentials'], credentialApi.list)`
- **Mutations：** create、update、delete → invalidate `['credentials']`
- **返回：** `credentials`、`isLoading`、`create`、`update`、`remove`

> 注意：revealPassword 和 revealTotp 不走 mutation（它们是一次性读取，不影响列表数据），直接在组件中用 `credentialApi.revealPassword(id)` 即时调用。

## 第五步：创建 credentials/CredentialCard.tsx

创建 `frontend/src/pages/PanelHub/credentials/CredentialCard.tsx`：

**卡片布局（从上到下）：**

1. **头部行：** platform 徽章（彩色标签）+ label 名称 + 到期警告 badge（右对齐）
   - 30天内到期 → 黄色 warning badge 显示"还有 N 天"
   - 已过期 → 红色 destructive badge 显示"已过期"

2. **用户名行（如有）：** 展示 username + 复制按钮

3. **密码行（passwordSet=true）：**
   - 默认展示 `••••••••••`
   - 👁 按钮：点击 → 调用 `credentialApi.revealPassword(id)` → 临时显示明文 → 5秒后自动隐藏
   - 📋 按钮：直接调用 `credentialApi.revealPassword(id)` → 复制到剪贴板 → 显示"已复制"

4. **TOTP 行（totpSet=true）：**
   - 初始状态："点击显示验证码"按钮
   - 点击后：调用 `credentialApi.revealTotp(id)` 获取密钥
   - 用 `otpauth` 库计算当前 TOTP 码：
     ```typescript
     import { TOTP } from 'otpauth'
     const totp = new TOTP({ secret: totpSecret })
     const code = totp.generate()  // "384521"
     const remaining = totp.period - (Math.floor(Date.now() / 1000) % totp.period)  // 剩余秒数
     ```
   - 展示 6 位码（大字号、等宽字体）+ 剩余秒数倒计时（环形或数字）
   - 每秒更新倒计时，到 0 时自动重新 generate
   - 点击验证码 → 复制到剪贴板
   - **TOTP secret 只保存在组件 state 中，不持久化**

5. **URL 行（如有）：** 可点击链接，打开新标签页

6. **分类 badge（如有）：** 小标签展示 category

7. **底部操作栏：** 编辑 / 归档 / 删除

**Props：**
```typescript
type CredentialCardProps = {
  item: Credential
  deleting: boolean
  onEdit: (item: Credential) => void
  onDelete: (id: string) => void
  onUnarchive?: (id: string) => void
}
```

**TOTP 实现细节：**
```typescript
// 组件内部状态
const [totpSecret, setTotpSecret] = useState<string | null>(null)
const [totpCode, setTotpCode] = useState('')
const [totpRemaining, setTotpRemaining] = useState(30)

// 获取 secret 后启动定时器
useEffect(() => {
  if (!totpSecret) return
  const totp = new TOTP({ issuer: item.platform, label: item.username || item.label || '', secret: totpSecret })
  
  const tick = () => {
    setTotpCode(totp.generate())
    setTotpRemaining(totp.period - (Math.floor(Date.now() / 1000) % totp.period))
  }
  tick() // 立即执行一次
  const interval = setInterval(tick, 1000)
  return () => clearInterval(interval)
}, [totpSecret])
```

## 第六步：创建 credentials/CredentialFormDialog.tsx

创建 `frontend/src/pages/PanelHub/credentials/CredentialFormDialog.tsx`：

支持创建和编辑两种模式。

**表单字段：**
1. 平台 (platform) — 文本输入，必填
2. 标签 (label) — 文本输入（可选）
3. 分类 (category) — 可输入可选择（支持自由输入新分类，或选择已有分类——从当前 credentials 列表提取去重的 category 值）
4. 用户名 (username) — 文本输入（可选）
5. 密码 (password) — Password 输入
   - 创建模式：placeholder "输入密码"
   - 编辑模式：placeholder "留空表示不修改"
6. TOTP 密钥 (totpSecret) — Password 输入
   - 创建模式：placeholder "输入 Base32 密钥"
   - 编辑模式：placeholder "留空表示不修改"
   - 下方小字提示："通常在平台开启 2FA 时获取的 Base32 编码密钥"
7. 登录 URL (url) — 文本输入（可选）
8. 密码到期日 (expireDate) — 日期选择（可选）
9. 关联订阅 (subscriptionId) — Select 下拉（可选）
10. 备注 (notes) — Textarea（可选）

## 第七步：创建 credentials/CredentialTabView.tsx

创建 `frontend/src/pages/PanelHub/credentials/CredentialTabView.tsx`：

```typescript
type CredentialTabViewProps = {
  onEdit: (item: Credential) => void
}
```

- 使用 `useCredentials()` hook
- 按 category 分组展示（使用 `groupByCategory`）
- 每个分组一个标题 + 卡片网格
- 无分类项归入"未分类"组
- 创建按钮 → 打开 CredentialFormDialog
- 空状态提示

## 第八步：验证

```bash
cd /Users/manuelm/Workspace/Projects/Nexus/nexus/frontend

# TypeScript 检查
npx tsc --noEmit

# 启动并测试（确保后端运行）
pnpm dev

# 测试：
# 1. 创建凭证（含密码 + TOTP secret）
# 2. 密码默认打码 → 点击眼睛揭示 → 5秒后自动隐藏
# 3. 点击复制密码 → 剪贴板中是明文
# 4. 点击显示验证码 → 6位码实时展示 + 倒计时
# 5. 倒计时归零 → 自动刷新验证码
# 6. 点击验证码 → 复制到剪贴板
# 7. 创建多个凭证设置不同分类 → 分类分组展示正确
# 8. 设置到期日为近期 → 到期警告 badge 显示
```

**注意事项：**
- `otpauth` 库的 TOTP secret 通常是 Base32 编码（如 `JBSWY3DPEHPK3PXP`），默认配置即可
- 密码明文只在组件 state 中短暂存在，5秒后清除（`setTimeout(() => setRevealed(false), 5000)`）
- TOTP secret 调用 revealTotp 后保存在 state 中，组件卸载时自然清除；不要存到 localStorage
- 复制操作使用 `navigator.clipboard.writeText()`，需要用户在安全上下文中（HTTPS 或 localhost）
- 每个导出组件顶部一行注释说明用途
