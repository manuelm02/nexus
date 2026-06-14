import { AlertCircle } from 'lucide-react'
import { cn } from '../../../lib/utils'
import { formatMoney, type SubscriptionFilter } from '../subscriptions.shared'

type SummaryBarProps = {
  monthlyTotals: Record<string, number>
  expiringCount: number
  expiredCount: number
  filter: SubscriptionFilter
  onFilterChange: (filter: SubscriptionFilter) => void
}

// SummaryBar 展示订阅月度支出和页面内到期提醒入口。
export function SummaryBar({ monthlyTotals, expiringCount, expiredCount, filter, onFilterChange }: SummaryBarProps) {
  const totals = Object.entries(monthlyTotals)

  return (
    <section className="grid gap-3 md:grid-cols-[1fr_auto]">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {totals.length > 0 ? totals.map(([currency, amount]) => (
          <div key={currency} className="rounded-lg border bg-card p-4 shadow-[var(--shadow-xs)]">
            <p className="text-xs font-semibold text-muted-foreground">月度支出（订阅中）</p>
            <p className="mt-1 text-2xl font-black text-foreground">{formatMoney(currency, amount)}</p>
          </div>
        )) : (
          <div className="rounded-lg border bg-card p-4 shadow-[var(--shadow-xs)]">
            <p className="text-xs font-semibold text-muted-foreground">月度支出（订阅中）</p>
            <p className="mt-1 text-2xl font-black text-foreground">¥0.00</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 md:justify-end">
        <button type="button" onClick={() => onFilterChange(filter === 'expiring' ? 'all' : 'expiring')} className={cn('inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-xs font-bold transition-colors', filter === 'expiring' ? 'border-[hsl(var(--warning)/0.35)] bg-[hsl(var(--warning-soft))] text-[hsl(var(--warning))]' : 'bg-card text-muted-foreground hover:bg-accent')}>
          <AlertCircle className="h-4 w-4" /> 即将到期 {expiringCount}
        </button>
        <button type="button" onClick={() => onFilterChange(filter === 'expired' ? 'all' : 'expired')} className={cn('inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-xs font-bold transition-colors', filter === 'expired' ? 'border-[hsl(var(--destructive)/0.3)] bg-[hsl(var(--destructive-soft))] text-[hsl(var(--destructive))]' : 'bg-card text-muted-foreground hover:bg-accent')}>
          <AlertCircle className="h-4 w-4" /> 已到期 {expiredCount}
        </button>
      </div>
    </section>
  )
}
