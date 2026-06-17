import type { Subscription } from '../../../../types/domain.types'
import { formatMoney, upcomingDueItems } from '../../subscriptions.shared'
import { formatDate } from '../../../../lib/utils'

type ExpiryTimelineProps = { items: Subscription[] }

// ExpiryTimeline 概览：未来 90 天内到期/续费订阅的横向时间线列表
export function ExpiryTimeline({ items }: ExpiryTimelineProps) {
  const due = upcomingDueItems(items, 15)

  return (
    <div className="nexus-surface p-4">
      <h3 className="text-sm font-bold">未来 15 天到期</h3>
      {due.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">未来 15 天内没有到期/续费的订阅</p>
      ) : (
        <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
          {due.map((d) => (
            <div key={d.id} className="flex w-36 shrink-0 flex-col gap-1 rounded-lg border p-3">
              <span className="text-[11px] font-bold text-muted-foreground">{formatDate(d.date)}</span>
              <span className="truncate text-sm font-bold">{d.name}</span>
              <span className="text-xs text-muted-foreground">{formatMoney(d.currency, d.amount)}</span>
              <span className={d.daysLeft <= 7 ? 'text-[11px] font-bold text-[hsl(var(--warning))]' : 'text-[11px] text-muted-foreground'}>
                {d.daysLeft === 0 ? '今天' : `${d.daysLeft} 天后`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
