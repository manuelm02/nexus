import { useEffect, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/Select'
import { CategoryInput } from '../components/CategoryInput'

type UsageAccountCreateDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: string[]
  creating: boolean
  createError: Error | null
  createSuccess: boolean
  onSubmit: (payload: { name: string; category?: string; apiProvider: string; apiKey: string; lowBalanceNotify: boolean; lowBalanceThreshold?: number }) => void
  onAiSuggestCategory: (name: string, notes?: string) => Promise<string | undefined>
}

const PROVIDERS = [
  { value: 'deepseek', label: 'DeepSeek（余额自动监控）' },
]

// UsageAccountCreateDialog 新建用量账户：选择监控 Provider → 输入 API Key → 提交时后端立即拉取余额
export function UsageAccountCreateDialog({ open, onOpenChange, categories, creating, createError, createSuccess, onSubmit, onAiSuggestCategory }: UsageAccountCreateDialogProps) {
  const [provider, setProvider] = useState('deepseek')
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [threshold, setThreshold] = useState('')

  const reset = () => { setName(''); setCategory(''); setApiKey(''); setThreshold('') }

  useEffect(() => {
    if (createSuccess) {
      onOpenChange(false)
      reset()
    }
  }, [createSuccess, onOpenChange])

  const handleSubmit = () => {
    if (!name || !apiKey) return
    onSubmit({
      name,
      category: category || undefined,
      apiProvider: provider,
      apiKey,
      lowBalanceNotify: !!threshold,
      lowBalanceThreshold: threshold ? Number(threshold) : undefined,
    })
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o) }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[80] w-[min(calc(100vw-2rem),26rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-card p-5 shadow-lg">
          <Dialog.Title className="text-base font-bold">添加用量账户</Dialog.Title>
          <Dialog.Description className="mt-1 text-xs text-muted-foreground">
            选择要监控的服务并提供 API Key，创建后会立即拉取一次余额。
          </Dialog.Description>

          <div className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">监控类型</label>
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">账户名称</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="nexus-input h-10 w-full px-3 text-sm" placeholder="例如：个人 DeepSeek" />
            </div>

            <CategoryInput
              value={category}
              onChange={setCategory}
              subscriptionName={name}
              categories={categories}
              onAiSuggest={() => { void onAiSuggestCategory(name).then((r) => { if (r) setCategory(r) }) }}
              isAiLoading={false}
            />

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">DeepSeek API Key</label>
              <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="nexus-input h-10 w-full px-3 text-sm" placeholder="sk-..." />
              <p className="text-[11px] text-muted-foreground">仅用于调用余额查询接口，加密存储，不会展示明文。</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground">低余额预警阈值（可选）</label>
              <input type="number" min="0" step="0.01" value={threshold} onChange={(e) => setThreshold(e.target.value)} className="nexus-input h-10 w-full px-3 text-sm" placeholder="例如：10" />
            </div>

            {createError && (
              <p className="rounded-md border border-[hsl(var(--destructive)/0.3)] bg-[hsl(var(--destructive-soft))] p-2 text-xs text-[hsl(var(--destructive))]">
                {createError.message || '创建失败，请检查 API Key 是否正确'}
              </p>
            )}
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <Dialog.Close className="nexus-button-utility h-9 px-4 text-sm">取消</Dialog.Close>
            <button type="button" disabled={!name || !apiKey || creating} onClick={handleSubmit} className="nexus-button-primary h-9 px-4 text-sm">
              {creating ? '连接中...' : '创建并同步余额'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
