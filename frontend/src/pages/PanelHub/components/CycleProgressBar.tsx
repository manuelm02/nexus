import type { Subscription } from '../../../types/domain.types'
import { cn, formatDate } from '../../../lib/utils'
import { cycleHealth, cycleProgress, dueDateLabel, type CycleHealth } from '../panelhub.shared'

const FILL_BY_HEALTH: Record<CycleHealth, string> = {
  normal: 'bg-[hsl(var(--primary))]',
  soon: 'bg-[hsl(var(--warning))]',
  overdue: 'bg-[hsl(var(--destructive))]',
}

const TRACK_BY_HEALTH: Record<CycleHealth, string> = {
  normal: 'bg-muted',
  soon: 'bg-[hsl(var(--warning-soft))]',
  overdue: 'bg-[hsl(var(--destructive-soft))]',
}

// CycleProgressBar 展示 monthly/yearly/one_time 订阅当前计费周期的时间进度，lifetime 不渲染
export function CycleProgressBar({ item }: { item: Subscription }) {
  const progress = cycleProgress(item)
  if (!progress) return null

  const health = cycleHealth(item)
  const percent = health === 'overdue' ? 100 : progress.percent
  const due = dueDateLabel(item)
  const label = item.billingType === 'one_time'
    ? `已进行 ${progress.elapsedDays} / ${progress.totalDays} 天`
    : `本周期已过 ${progress.elapsedDays} / ${progress.totalDays} 天`

  return (
    <div className="mt-3 space-y-1">
      <div className={cn('h-1.5 w-full overflow-hidden rounded-full', TRACK_BY_HEALTH[health])}>
        <div
          className={cn('h-full rounded-full transition-[width] duration-300 ease-out', FILL_BY_HEALTH[health])}
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground">
        <span>{label}</span>
        {due && <span>{due.label}：{formatDate(due.date)}</span>}
      </div>
    </div>
  )
}
