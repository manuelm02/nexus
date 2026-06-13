import { useState } from 'react'
import { Trash2, Pencil, Star, Loader2 } from 'lucide-react'
import type { LlmProvider } from '../../../types/domain.types'
import { cn } from '../../../lib/utils'

type ProviderCardProps = {
  provider: LlmProvider
  isDefault: boolean
  setDefaultPending: boolean
  deletePending: boolean
  onEdit: () => void
  onSetDefault: () => void
  onDelete: () => void
}

// ProviderCard 展示单个 LLM Provider 的名称、类型、模型、状态和操作入口。
export function ProviderCard({ provider, isDefault, setDefaultPending, deletePending, onEdit, onSetDefault, onDelete }: ProviderCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  // 点击卡片外部关闭确认气泡
  const handleDismiss = () => setConfirmDelete(false)

  return (
    <div className={cn(
      'group relative rounded-xl border px-4 py-3 transition-colors',
      isDefault ? 'border-primary/20 bg-primary/[0.03]' : 'border-border bg-card hover:border-input',
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-bold text-foreground">{provider.name}</span>
            {isDefault && (
              <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[10px] font-black text-primary-foreground">
                默认
              </span>
            )}
            <span className={cn(
              'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold',
              provider.enabled
                ? 'bg-success-soft text-success'
                : 'bg-muted text-muted-foreground',
            )}>
              {provider.enabled ? '启用' : '禁用'}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {provider.provider} · {provider.model || '未指定模型'}
          </p>
        </div>

        {/* 操作区：设为默认、编辑、删除 */}
        <div className="flex shrink-0 items-center gap-0.5">
          {!isDefault && (
            <button
              type="button"
              onClick={onSetDefault}
              disabled={setDefaultPending}
              className="flex h-8 items-center gap-1 rounded-lg px-2 text-[11px] font-bold text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
            >
              {setDefaultPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Star className="h-3 w-3" />}
              默认
            </button>
          )}

          <button
            type="button"
            onClick={onEdit}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            aria-label={`编辑 ${provider.name}`}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>

          {/* 删除按钮：弹出确认气泡 */}
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            disabled={deletePending}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
            aria-label={`删除 ${provider.name}`}
          >
            {deletePending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* 删除确认气泡：点击取消或外部关闭 */}
      {confirmDelete && (
        <>
          {/* 透明遮罩捕获外部点击 */}
          <div className="fixed inset-0 z-10" onClick={handleDismiss} />
          <div className="absolute right-2 top-11 z-20 rounded-lg border border-border bg-popover p-2 shadow-lg">
            <p className="mb-1.5 text-[11px] font-semibold text-foreground">确认删除「{provider.name}」？</p>
            <div className="flex gap-1">
              <button type="button" onClick={handleDismiss} className="flex h-6 items-center rounded-[0.625rem] border bg-card px-2 text-[10px] font-bold text-accent-foreground transition-colors hover:border-input hover:bg-accent">
                取消
              </button>
              <button
                type="button"
                onClick={() => { onDelete(); setConfirmDelete(false) }}
                className="flex h-6 items-center rounded-md bg-destructive px-2 text-[10px] font-bold text-destructive-foreground hover:bg-destructive/90"
              >
                删除
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
