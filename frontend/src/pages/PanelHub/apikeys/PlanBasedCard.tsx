import { useState } from 'react'
import { Pencil, Copy, ArchiveRestore } from 'lucide-react'
import type { ApiKey } from '../../../types/domain.types'
import { cn } from '../../../lib/utils'
import { PROVIDER_COLORS, STATUS_STYLES, STATUS_LABELS } from './apikeys.shared'
import { DeleteConfirm } from '../components/DeleteConfirm'
import { apiKeyApi } from '../../../api/apiKey.api'

type PlanBasedCardProps = {
  item: ApiKey
  deleting: boolean
  onEdit: (item: ApiKey) => void
  onDelete: (id: string) => void
  onUnarchive?: (id: string) => void
}

/** 套餐型卡片：精简信息展示，无余额/图表/流水。两列网格布局。 */
export function PlanBasedCard({ item, deleting, onEdit, onDelete, onUnarchive }: PlanBasedCardProps) {
  const [copied, setCopied] = useState(false)

  const handleCopyKey = async () => {
    try {
      const res = await apiKeyApi.revealKey(item.id)
      await navigator.clipboard.writeText(res.data?.data ?? '')
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* 复制失败静默处理 */ }
  }

  return (
    <article className="rounded-lg border bg-card p-4 shadow-[var(--shadow-xs)]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold', PROVIDER_COLORS[item.provider] ?? 'bg-muted text-muted-foreground')}>
              {item.provider}
            </span>
            <h3 className="truncate text-base font-bold text-foreground">{item.label}</h3>
            <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold', STATUS_STYLES[item.status] ?? '')}>
              {STATUS_LABELS[item.status] ?? item.status}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono text-[11px]">{item.maskedKey}</span>
            <button type="button" onClick={handleCopyKey} className="nexus-button-utility h-6 px-1.5 text-[11px]" aria-label="复制 Key">
              {copied ? '已复制' : <><Copy className="h-3 w-3 inline mr-0.5" />复制</>}
            </button>
          </div>

          {item.baseUrl && (
            <p className="text-[11px] text-muted-foreground truncate">{item.baseUrl}</p>
          )}

          {item.planExpireDate && (
            <p className="text-xs text-muted-foreground">
              套餐到期：{item.planExpireDate}
            </p>
          )}

          {item.notes && (
            <p className="text-[11px] text-muted-foreground truncate">{item.notes}</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={() => onEdit(item)} className="nexus-button-utility h-9 w-9 text-muted-foreground" aria-label="编辑">
            <Pencil className="h-4 w-4" />
          </button>
          {onUnarchive && (
            <button type="button" onClick={() => onUnarchive(item.id)} className="nexus-button-utility h-9 w-9 text-muted-foreground" aria-label="取消归档">
              <ArchiveRestore className="h-4 w-4" />
            </button>
          )}
          <DeleteConfirm deleting={deleting} onConfirm={() => onDelete(item.id)} />
        </div>
      </div>
    </article>
  )
}
