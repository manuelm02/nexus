import { useEffect, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import * as Select from '@radix-ui/react-select'
import { Check, ChevronDown, X } from 'lucide-react'
import { DatePicker } from '../../../components/ui/DatePicker'
import type { Credential } from '../../../types/domain.types'

type CredentialFormData = {
  platform: string
  label: string
  category: string
  username: string
  password: string
  totpSecret: string
  url: string
  expireDate: string
  notes: string
}

function emptyForm(): CredentialFormData {
  return { platform: '', label: '', category: '', username: '', password: '', totpSecret: '', url: '', expireDate: '', notes: '' }
}

function itemToForm(item: Credential): CredentialFormData {
  return {
    platform: item.platform,
    label: item.label ?? '',
    category: item.category ?? '',
    username: item.username ?? '',
    password: '',
    totpSecret: '',
    url: item.url ?? '',
    expireDate: item.expireDate ?? '',
    notes: item.notes ?? '',
  }
}

type CredentialFormDialogProps = {
  open: boolean
  item: Credential | null
  saving: boolean
  categories: string[]
  onOpenChange: (open: boolean) => void
  onSubmit: (data: Parameters<typeof import('../../../api/credential.api').credentialApi.create>[0], id?: string) => void
}

/** 账号创建/编辑表单对话框 */
export function CredentialFormDialog({ open, item, saving, categories, onOpenChange, onSubmit }: CredentialFormDialogProps) {
  const [form, setForm] = useState<CredentialFormData>(emptyForm())

  useEffect(() => {
    if (open) setForm(item ? itemToForm(item) : emptyForm())
  }, [item, open])

  const update = (field: keyof CredentialFormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = () => {
    if (!form.platform.trim()) return
    const data: Parameters<typeof import('../../../api/credential.api').credentialApi.create>[0] = {
      platform: form.platform,
      label: form.label || undefined,
      category: form.category || undefined,
      username: form.username || undefined,
      password: form.password || undefined,
      totpSecret: form.totpSecret || undefined,
      url: form.url || undefined,
      expireDate: form.expireDate || undefined,
      notes: form.notes || undefined,
    }
    onSubmit(data, item?.id)
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" />
        <Dialog.Content className="nexus-surface fixed inset-x-0 bottom-0 top-auto z-50 max-h-[85dvh] w-full overflow-y-auto rounded-b-none rounded-t-2xl p-3 sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:w-[calc(100vw-2rem)] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg sm:p-4">
          <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-muted-foreground/25 sm:hidden" />
          <div className="flex items-center justify-between gap-3">
            <Dialog.Title className="text-sm font-black sm:text-base sm:font-semibold">{item ? '编辑账号' : '添加账号'}</Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" className="nexus-button-utility hidden h-9 w-9 text-muted-foreground sm:inline-flex" aria-label="关闭">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="mt-3 space-y-3 sm:mt-4">
            <label className="block space-y-1">
              <span className="text-xs font-bold text-muted-foreground">平台 *</span>
              <input value={form.platform} onChange={(e) => update('platform', e.target.value)}
                className="nexus-input h-9 w-full px-3 text-xs" placeholder="例如 GitHub" />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-bold text-muted-foreground">标签</span>
              <input value={form.label} onChange={(e) => update('label', e.target.value)}
                className="nexus-input h-9 w-full px-3 text-xs" placeholder="例如：工作账号" />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-bold text-muted-foreground">分类</span>
              {/* 分类选择：Radix Select 提供已有分类 + 下方输入框支持自由输入新分类（双通道 Combobox 模式） */}
              {categories.length > 0 && (
                <Select.Root value={form.category} onValueChange={(v) => update('category', v)}>
                  <Select.Trigger className="nexus-input inline-flex h-9 w-full items-center justify-between gap-2 px-3 text-xs font-semibold shadow-none focus:outline-none focus:ring-2 focus:ring-ring">
                    <Select.Value placeholder="选择已有分类" />
                    <Select.Icon><ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /></Select.Icon>
                  </Select.Trigger>
                  <Select.Portal>
                    <Select.Content position="popper" sideOffset={6} className="z-[90] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg">
                      <Select.Viewport>
                        {categories.filter(Boolean).map((c) => (
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
              )}
              <input
                value={form.category}
                onChange={(e) => update('category', e.target.value)}
                className="nexus-input h-9 w-full px-3 text-xs"
                placeholder="输入新分类或从上方选择"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-bold text-muted-foreground">用户名</span>
              <input value={form.username} onChange={(e) => update('username', e.target.value)}
                className="nexus-input h-9 w-full px-3 text-xs" placeholder="用户名或邮箱" />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-bold text-muted-foreground">密码 {!item ? '' : '(留空不修改)'}</span>
              <input value={form.password} onChange={(e) => update('password', e.target.value)}
                type="password" className="nexus-input h-9 w-full px-3 text-xs"
                placeholder={item ? '留空表示不修改' : '输入密码'} />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-bold text-muted-foreground">TOTP 密钥 {!item ? '' : '(留空不修改)'}</span>
              <input value={form.totpSecret} onChange={(e) => update('totpSecret', e.target.value)}
                type="password" className="nexus-input h-9 w-full px-3 text-xs"
                placeholder={item ? '留空表示不修改' : '输入 Base32 密钥'} />
              <p className="text-[11px] text-muted-foreground">通常在平台开启 2FA 时获取的 Base32 编码密钥</p>
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-bold text-muted-foreground">登录 URL</span>
              <input value={form.url} onChange={(e) => update('url', e.target.value)}
                className="nexus-input h-9 w-full px-3 text-xs" placeholder="https://..." />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-bold text-muted-foreground">密码到期日</span>
              <DatePicker
                value={form.expireDate}
                onChange={(v) => update('expireDate', v)}
                allowClear
                compact
                placeholder="选择到期日"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-bold text-muted-foreground">备注</span>
              <textarea value={form.notes} onChange={(e) => update('notes', e.target.value)}
                className="nexus-input w-full px-3 py-2 text-xs" rows={2} placeholder="备注信息" />
            </label>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 border-t pt-3 sm:mt-5 sm:flex sm:flex-row sm:items-center sm:justify-end sm:pt-4">
            <Dialog.Close asChild>
              <button type="button" className="nexus-button-utility h-9 px-4 text-xs font-bold sm:w-auto">取消</button>
            </Dialog.Close>
            <button type="button" disabled={saving || !form.platform.trim()} onClick={handleSubmit}
              className="nexus-button h-9 px-6 text-xs font-bold sm:w-auto">
              {saving ? '保存中…' : item ? '保存' : '创建'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
