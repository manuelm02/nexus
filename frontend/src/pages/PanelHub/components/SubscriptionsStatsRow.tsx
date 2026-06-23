import { AlertCircle } from 'lucide-react'
import type { SubscriptionStats } from '../../../types/domain.types'
import { cn } from '../../../lib/utils'
import { formatMoney, toCnyAmount, type CnyAmount, type SubscriptionFilter } from '../panelhub.shared'

type SubscriptionsStatsRowProps = {
  stats: SubscriptionStats | null | undefined
  statsLoading: boolean
  rates: Record<string, number>
  expiringCount: number
  expiredCount: number
  filter: SubscriptionFilter
  onFilterChange: (filter: SubscriptionFilter) => void
}

function AmountCard({ label, amount, loading }: { label: string; amount: CnyAmount; loading?: boolean }) {
  if (loading) {
    return (
      <div className="rounded-lg border bg-card p-4 shadow-[var(--shadow-xs)]">
        <div className="h-3 w-16 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-7 w-24 animate-pulse rounded bg-muted" />
      </div>
    )
  }
  return (
    <div className="rounded-lg border bg-card p-4 shadow-[var(--shadow-xs)]">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-black text-foreground">{formatMoney('CNY', amount.cny)}</p>
      {amount.unconverted.length > 0 && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          如 {amount.unconverted.map((u) => formatMoney(u.currency, u.amount)).join(' / ')} (汇率未覆盖)
        </p>
      )}
    </div>
  )
}

function FilterCard({
  active,
  tone,
  count,
  label,
  onClick,
}: {
  active: boolean
  tone: 'warning' | 'destructive'
  count: number
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center justify-between rounded-lg border bg-card p-4 shadow-[var(--shadow-xs)] text-left transition-colors',
        active
          ? tone === 'warning'
            ? 'border-[hsl(var(--warning)/0.35)] bg-[hsl(var(--warning-soft))]'
            : 'border-[hsl(var(--destructive)/0.3)] bg-[hsl(var(--destructive-soft))]'
          : 'hover:bg-accent',
      )}
    >
      <div>
        <p className={cn('text-xs font-semibold', active ? (tone === 'warning' ? 'text-[hsl(var(--warning))]' : 'text-[hsl(var(--destructive))]') : 'text-muted-foreground')}>
          {label}
        </p>
        <p className={cn('mt-1 text-2xl font-black', active ? (tone === 'warning' ? 'text-[hsl(var(--warning))]' : 'text-[hsl(var(--destructive))]') : 'text-foreground')}>
          {count}
        </p>
      </div>
      <AlertCircle className={cn('h-5 w-5', active ? (tone === 'warning' ? 'text-[hsl(var(--warning))]' : 'text-[hsl(var(--destructive))]') : 'text-muted-foreground')} />
    </button>
  )
}

// SubscriptionsStatsRow 以 6 张等尺寸卡片展示订阅统计：数量、月度/年度/本月支出统一折算 CNY，以及可点击的即将到期/已到期筛选入口
export function SubscriptionsStatsRow({
  stats,
  statsLoading,
  rates,
  expiringCount,
  expiredCount,
  filter,
  onFilterChange,
}: SubscriptionsStatsRowProps) {
  const activeAmount = statsLoading || !stats ? null : toCnyAmount(stats.monthlyTotal, rates)
  const yearlyAmount = statsLoading || !stats ? null : toCnyAmount(stats.yearlyTotal, rates)
  const dueAmount = statsLoading || !stats ? null : toCnyAmount(stats.dueThisMonth, rates)

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {statsLoading || !stats ? (
        <div className="rounded-lg border bg-card p-4 shadow-[var(--shadow-xs)]">
          <div className="h-3 w-16 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-7 w-16 animate-pulse rounded bg-muted" />
        </div>
      ) : (
        <div className="rounded-lg border bg-card p-4 shadow-[var(--shadow-xs)]">
          <p className="text-xs font-semibold text-muted-foreground">订阅中</p>
          <p className="mt-1 text-2xl font-black text-foreground">{stats.activeCount}</p>
        </div>
      )}

      <AmountCard label="月度支出" amount={activeAmount ?? { cny: 0, unconverted: [] }} loading={statsLoading || !stats} />
      <AmountCard label="年度支出" amount={yearlyAmount ?? { cny: 0, unconverted: [] }} loading={statsLoading || !stats} />
      <AmountCard label="本月待支付" amount={dueAmount ?? { cny: 0, unconverted: [] }} loading={statsLoading || !stats} />

      <FilterCard
        active={filter === 'expiring'}
        tone="warning"
        count={expiringCount}
        label="即将到期"
        onClick={() => onFilterChange(filter === 'expiring' ? 'all' : 'expiring')}
      />
      <FilterCard
        active={filter === 'expired'}
        tone="destructive"
        count={expiredCount}
        label="已到期"
        onClick={() => onFilterChange(filter === 'expired' ? 'all' : 'expired')}
      />
    </div>
  )
}
