import { AlertCircle, ArchiveRestore, CalendarClock, Pencil } from 'lucide-react'
import type { Subscription } from '../../../types/domain.types'
import { cn, formatDate } from '../../../lib/utils'
import {
  BILLING_TYPE_LABELS,
  STATUS_LABELS,
  STATUS_STYLES,
  daysUntil,
  isExpired,
  isExpiringSoon,
  formatMoney,
  dueDateLabel,
} from '../subscriptions.shared'
import { CycleProgressBar } from './CycleProgressBar'
import { DeleteConfirm } from './DeleteConfirm'

type SubscriptionCardProps = {
  item: Subscription
  deleting: boolean
  onEdit: (item: Subscription) => void
  onDelete: (id: string) => void
  onUnarchive?: (id: string) => void
}

// SubscriptionCard 展示非 per_token 订阅的计费信息、周期进度条和编辑/删除/取消归档操作。
export function SubscriptionCard({ item, deleting, onEdit, onDelete, onUnarchive }: SubscriptionCardProps) {
  const bt = item.billingType
  const expiring = isExpiringSoon(item)
  const expired = isExpired(item)
  const days = daysUntil(item.expireDate)
  const dueDate = dueDateLabel(item)

  return (
    <article className="rounded-lg border bg-card p-4 shadow-[var(--shadow-xs)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-bold text-foreground">{item.name}</h3>
            {item.category && (
              <span className="rounded-full border bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
                {item.category}
              </span>
            )}
            {item.archived && (
              <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
                已归档
              </span>
            )}
            <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-bold', STATUS_STYLES[item.status])}>
              {STATUS_LABELS[item.status]}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-muted-foreground">
            {(bt === 'monthly' || bt === 'yearly' || bt === 'one_time') && (
              <span>
                {formatMoney(item.currency || 'CNY', item.price ?? 0)}
                {bt !== 'one_time' && ` / ${BILLING_TYPE_LABELS[bt ?? ''] ?? bt}`}
              </span>
            )}
            {bt === 'lifetime' && (
              <span>{formatMoney(item.currency || 'CNY', item.price ?? 0)}</span>
            )}
            {(bt === 'monthly' || bt === 'yearly') && item.autoRenew && (
              <span className="text-primary">自动续费</span>
            )}
            {dueDate && (
              <span>{dueDate.label}：{formatDate(dueDate.date)}</span>
            )}
            {bt === 'lifetime' && item.startDate && (
              <span>购买日期：{formatDate(item.startDate)}</span>
            )}
          </div>
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

      {(expiring || expired) && (
        <div className={cn(
          'mt-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold',
          expired
            ? 'border-[hsl(var(--destructive)/0.24)] bg-[hsl(var(--destructive-soft))] text-[hsl(var(--destructive))]'
            : 'border-[hsl(var(--warning)/0.28)] bg-[hsl(var(--warning-soft))] text-[hsl(var(--warning))]',
        )}>
          {expired ? <AlertCircle className="h-3.5 w-3.5" /> : <CalendarClock className="h-3.5 w-3.5" />}
          {expired ? '已到期' : days === 0 ? '今天到期' : `${days} 天后到期`}
        </div>
      )}

      <CycleProgressBar item={item} />

      {item.url && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <a href={item.url} target="_blank" rel="noreferrer" className="nexus-button-utility h-9 px-2.5 text-xs">
            打开
          </a>
        </div>
      )}
    </article>
  )
}
