import * as Popover from '@radix-ui/react-popover'
import { AlertCircle, CalendarClock, Pencil, Trash2 } from 'lucide-react'
import type { Subscription } from '../../../types/domain.types'
import { cn, formatDate } from '../../../lib/utils'
import { BILLING_TYPE_LABELS, STATUS_LABELS, STATUS_STYLES, daysUntil, isExpired, isExpiringSoon, usagePercent } from '../subscriptions.shared'
import { UsagePopover } from './UsagePopover'

type SubscriptionCardProps = {
  item: Subscription
  deleting: boolean
  usageSaving: boolean
  onEdit: (item: Subscription) => void
  onDelete: (id: string) => void
  onUpdateUsage: (id: string, usageUsed: number) => void
}

// SubscriptionCard 展示单个订阅的金额、到期、状态、用量和快捷操作。
export function SubscriptionCard({ item, deleting, usageSaving, onEdit, onDelete, onUpdateUsage }: SubscriptionCardProps) {
  const percent = usagePercent(item)
  const expiring = isExpiringSoon(item)
  const expired = isExpired(item)
  const days = daysUntil(item.expireDate)

  return (
    <article className="rounded-lg border bg-card p-4 shadow-[var(--shadow-xs)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-bold text-foreground">{item.name}</h3>
            {item.category && <span className="rounded-full border bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">{item.category}</span>}
            <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-bold', STATUS_STYLES[item.status])}>{STATUS_LABELS[item.status]}</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-muted-foreground">
            <span>{item.currency} {item.price ?? 0} / {BILLING_TYPE_LABELS[item.billingType ?? ''] ?? item.billingType ?? '未设置'}</span>
            {item.expireDate && <span>到期：{formatDate(item.expireDate)}</span>}
            {item.nextBillingDate && <span>下次扣费：{formatDate(item.nextBillingDate)}</span>}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={() => onEdit(item)} className="nexus-button-utility h-9 w-9 text-muted-foreground" aria-label="编辑">
            <Pencil className="h-4 w-4" />
          </button>
          <DeleteConfirm deleting={deleting} onConfirm={() => onDelete(item.id)} />
        </div>
      </div>

      {(expiring || expired) && (
        <div className={cn('mt-3 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold', expired ? 'border-[hsl(var(--destructive)/0.24)] bg-[hsl(var(--destructive-soft))] text-[hsl(var(--destructive))]' : 'border-[hsl(var(--warning)/0.28)] bg-[hsl(var(--warning-soft))] text-[hsl(var(--warning))]')}>
          {expired ? <AlertCircle className="h-3.5 w-3.5" /> : <CalendarClock className="h-3.5 w-3.5" />}
          {expired ? '已到期' : days === 0 ? '今天到期' : `${days} 天后到期`}
        </div>
      )}

      {percent !== null && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between gap-3 text-xs font-semibold text-muted-foreground">
            <span>用量</span>
            <span>{item.usageUsed ?? 0}/{item.usageLimit} {item.usageUnit}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {item.usageLimit ? <UsagePopover item={item} saving={usageSaving} onSave={onUpdateUsage} /> : null}
        {item.url && (
          <a href={item.url} target="_blank" rel="noreferrer" className="nexus-button-utility h-9 px-2.5 text-xs">
            打开
          </a>
        )}
      </div>
    </article>
  )
}

function DeleteConfirm({ deleting, onConfirm }: { deleting: boolean; onConfirm: () => void }) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button type="button" className="nexus-button-utility h-9 w-9 text-muted-foreground hover:text-destructive" aria-label="删除">
          <Trash2 className="h-4 w-4" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content side="top" align="end" sideOffset={8} className="z-[80] w-[min(calc(100vw-2rem),18rem)] rounded-lg border bg-popover p-3 text-popover-foreground shadow-lg">
          <p className="text-sm font-bold">确认删除这个订阅？</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">此操作无法撤销。</p>
          <div className="mt-4 flex justify-end gap-2">
            <Popover.Close asChild>
              <button type="button" className="nexus-button-utility h-9 px-3 text-xs">取消</button>
            </Popover.Close>
            <button type="button" disabled={deleting} onClick={onConfirm} className="inline-flex h-9 items-center justify-center rounded-md border border-destructive bg-destructive px-3 text-xs font-semibold text-destructive-foreground disabled:opacity-50">
              确认删除
            </button>
          </div>
          <Popover.Arrow className="fill-popover" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
