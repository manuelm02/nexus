import { useEffect, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import * as Select from '@radix-ui/react-select'
import { Check, ChevronDown, X } from 'lucide-react'
import { cn } from '../../../lib/utils'
import { DatePicker } from '../../../components/ui/DatePicker'
import type { ApiKey } from '../../../types/domain.types'

type ApiKeyFormData = {
  label: string
  provider: string
  apiKey: string
  baseUrl: string
  planName: string
  planExpireDate: string
  lowBalanceNotify: boolean
  lowBalanceThreshold: string
  notes: string
}

const PROVIDERS = ['deepseek', 'openai', 'anthropic', 'claude']

function emptyForm(): ApiKeyFormData {
  return { label: '', provider: 'deepseek', apiKey: '', baseUrl: '', planName: '', planExpireDate: '', lowBalanceNotify: false, lowBalanceThreshold: '', notes: '' }
}

function itemToForm(item: ApiKey): ApiKeyFormData {
  return {
    label: item.label,
    provider: item.provider,
    apiKey: '',
    baseUrl: item.baseUrl ?? '',
    planName: item.planName ?? '',
    planExpireDate: item.planExpireDate ?? '',
    lowBalanceNotify: item.lowBalanceNotify,
    lowBalanceThreshold: item.lowBalanceThreshold?.toString() ?? '',
    notes: item.notes ?? '',
  }
}

type ApiKeyFormDialogProps = {
  open: boolean
  item: ApiKey | null
  saving: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: Parameters<typeof import('../../../api/apiKey.api').apiKeyApi.create>[0], id?: string) => void
}

/** API Key 创建/编辑表单对话框，支持桌面弹窗和移动端底部 Sheet */
export function ApiKeyFormDialog({ open, item, saving, onOpenChange, onSubmit }: ApiKeyFormDialogProps) {
  const [form, setForm] = useState<ApiKeyFormData>(emptyForm())

  useEffect(() => {
    if (open) setForm(item ? itemToForm(item) : emptyForm())
  }, [item, open])

  const update = (field: keyof ApiKeyFormData, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = () => {
    if (!form.label.trim() || !form.provider.trim()) return
    const data: Parameters<typeof import('../../../api/apiKey.api').apiKeyApi.create>[0] = {
      label: form.label,
      provider: form.provider,
      apiKey: form.apiKey,
      baseUrl: form.baseUrl || undefined,
      planName: form.planName || undefined,
      planExpireDate: form.planExpireDate || undefined,
      lowBalanceNotify: form.lowBalanceNotify,
      lowBalanceThreshold: form.lowBalanceThreshold ? Number(form.lowBalanceThreshold) : undefined,
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
            <Dialog.Title className="text-sm font-black sm:text-base sm:font-semibold">{item ? '编辑 API Key' : '添加 API Key'}</Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" className="nexus-button-utility hidden h-9 w-9 text-muted-foreground sm:inline-flex" aria-label="关闭">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="mt-3 space-y-3 sm:mt-4">
            <label className="block space-y-1">
              <span className="text-xs font-bold text-muted-foreground">平台 *</span>
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
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-bold text-muted-foreground">标签 *</span>
              <input value={form.label} onChange={(e) => update('label', e.target.value)}
                className="nexus-input h-9 w-full px-3 text-xs" placeholder="例如：工作 DeepSeek" />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-bold text-muted-foreground">API Key {!item ? '*' : ''}</span>
              <input value={form.apiKey} onChange={(e) => update('apiKey', e.target.value)}
                type="password" className="nexus-input h-9 w-full px-3 text-xs"
                placeholder={item ? '留空表示不修改' : '输入 API Key'} />
              {item && <p className="text-[11px] text-muted-foreground">当前 Key：{item.maskedKey}</p>}
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-bold text-muted-foreground">Base URL</span>
              <input value={form.baseUrl} onChange={(e) => update('baseUrl', e.target.value)}
                className="nexus-input h-9 w-full px-3 text-xs" placeholder="https://api.deepseek.com" />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-bold text-muted-foreground">套餐名称</span>
              <input value={form.planName} onChange={(e) => update('planName', e.target.value)}
                className="nexus-input h-9 w-full px-3 text-xs" placeholder="Pro Plan" />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-bold text-muted-foreground">套餐到期日</span>
              <DatePicker
                value={form.planExpireDate}
                onChange={(v) => update('planExpireDate', v)}
                allowClear
                compact
                placeholder="选择到期日"
              />
            </label>

            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground">低余额预警</span>
              <button type="button" role="switch" aria-checked={form.lowBalanceNotify}
                onClick={() => update('lowBalanceNotify', !form.lowBalanceNotify)}
                className={cn('h-5 w-9 rounded-full transition', form.lowBalanceNotify ? 'bg-[hsl(var(--primary))]' : 'bg-muted')}>
                <span className={cn('block h-4 w-4 rounded-full bg-white shadow transition-transform m-0.5', form.lowBalanceNotify ? 'translate-x-4' : '')} />
              </button>
            </div>

            {form.lowBalanceNotify && (
              <label className="block space-y-1">
                <span className="text-xs font-bold text-muted-foreground">预警阈值</span>
                <input type="number" min="0" step="0.01" value={form.lowBalanceThreshold} onChange={(e) => update('lowBalanceThreshold', e.target.value)}
                  className="nexus-input h-9 w-full px-3 text-xs" placeholder="余额低于此值时提醒" />
              </label>
            )}

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
            <button type="button" disabled={saving || !form.label.trim()} onClick={handleSubmit}
              className="nexus-button h-9 px-6 text-xs font-bold sm:w-auto">
              {saving ? '保存中…' : item ? '保存' : form.provider === 'deepseek' ? '创建并同步余额' : '创建'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

