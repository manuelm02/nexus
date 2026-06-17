import { useState } from 'react'
import { ArchiveRestore, Pencil, RefreshCw } from 'lucide-react'
import type { Subscription } from '../../../types/domain.types'
import { cn, formatRelative } from '../../../lib/utils'
import { balanceHealth, type BalanceHealth } from '../subscriptions.shared'
import { DeleteConfirm } from './DeleteConfirm'
import { LedgerHistory } from '../usage/LedgerHistory'
import { BalanceTrendChart } from '../usage/BalanceTrendChart'

type UsageAccountCardProps = {
  item: Subscription
  deleting: boolean
  syncing?: boolean
  onEdit: (item: Subscription) => void
  onDelete: (id: string) => void
  onRecharge: (id: string, data: { amount: number; date?: string; note?: string }) => void
  onConsume: (id: string, data: { amount: number; note?: string }) => void
  onSyncBalance?: (id: string) => void
  onUnarchive?: (id: string) => void
}

const TEXT_COLOR_BY_HEALTH: Record<BalanceHealth, string> = {
  normal: 'text-foreground',
  low: 'text-[hsl(var(--warning))]',
  empty: 'text-[hsl(var(--destructive))]',
}

const BORDER_BY_HEALTH: Record<BalanceHealth, string> = {
  normal: '',
  low: 'border-l-2 border-l-[hsl(var(--warning))]',
  empty: 'border-l-2 border-l-[hsl(var(--destructive))]',
}

function InlineAmountAction({ label, actionLabel, tone, onSubmit }: {
  label: string; actionLabel: string; tone: 'success' | 'destructive'; onSubmit: (amount: number) => void
}) {
  const [amount, setAmount] = useState('')
  const handleSubmit = () => {
    if (!amount || Number(amount) <= 0) return
    onSubmit(Number(amount))
    setAmount('')
  }
  return (
    <div className="space-y-1">
      <span className="text-[11px] font-bold text-muted-foreground">{label}</span>
      <div className="flex gap-1">
        <input
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
          className="nexus-input h-8 flex-1 px-2 text-xs"
          placeholder="金额"
        />
        <button
          type="button"
          disabled={!amount || Number(amount) <= 0}
          onClick={handleSubmit}
          className={cn(
            'h-8 px-2 text-[11px] font-bold rounded-md border disabled:opacity-50',
            tone === 'success'
              ? 'border-[hsl(var(--success)/0.3)] bg-[hsl(var(--success-soft))] text-[hsl(var(--success))]'
              : 'border-[hsl(var(--destructive)/0.3)] bg-[hsl(var(--destructive-soft))] text-[hsl(var(--destructive))]',
          )}
        >
          {actionLabel}
        </button>
      </div>
    </div>
  )
}

// UsageAccountCard 展示按量账户的 Provider 徽标、余额趋势图、内联充值/消费和折叠流水
export function UsageAccountCard({ item, deleting, syncing, onEdit, onDelete, onRecharge, onConsume, onSyncBalance, onUnarchive }: UsageAccountCardProps) {
  const health = balanceHealth(item)

  return (
    <article className={cn('rounded-lg border bg-card p-4 shadow-[var(--shadow-xs)]', BORDER_BY_HEALTH[health])}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-bold text-foreground">{item.name}</h3>
            {item.category && (
              <span className="rounded-full border bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
                {item.category}
              </span>
            )}
            {item.apiFetchEnabled && (
              <span className="rounded-full border border-[hsl(var(--primary)/0.3)] bg-[hsl(var(--primary)/0.08)] px-2 py-0.5 text-[11px] font-bold text-[hsl(var(--primary))]">
                {item.apiProvider === 'deepseek' ? 'DeepSeek' : item.apiProvider}
              </span>
            )}
            {item.archived && (
              <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
                已归档
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-muted-foreground">
            <span className={cn(health !== 'normal' && TEXT_COLOR_BY_HEALTH[health])}>
              余额：{item.remainingBalance?.toFixed(2) ?? '—'}
            </span>
            <span>月消费：{item.monthlySpend?.toFixed(2) ?? '0.00'}</span>
            {item.lowBalanceThreshold != null && (
              <span>预警阈值：{item.lowBalanceThreshold.toFixed(2)}</span>
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

      {item.apiFetchEnabled && (
        <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>余额由 DeepSeek 自动同步{item.apiLastFetchedAt ? `（${formatRelative(item.apiLastFetchedAt)}）` : ''}</span>
          {onSyncBalance && (
            <button type="button" onClick={() => onSyncBalance(item.id)} disabled={syncing} className="nexus-button-utility h-7 gap-1 px-2 text-[11px]">
              <RefreshCw className={cn('h-3 w-3', syncing && 'animate-spin')} /> 刷新余额
            </button>
          )}
        </div>
      )}
      {!item.apiFetchEnabled && (
        <p className="mt-2 text-[11px] text-muted-foreground">余额由充值/消费记录计算</p>
      )}

      {item.apiFetchEnabled && (
        <div className="mt-3">
          <BalanceTrendChart subscriptionId={item.id} />
        </div>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <InlineAmountAction label="充值" actionLabel="充值" tone="success" onSubmit={(amount) => onRecharge(item.id, { amount })} />
        <InlineAmountAction label="消费" actionLabel="记录" tone="destructive" onSubmit={(amount) => onConsume(item.id, { amount })} />
      </div>

      <div className="mt-3">
        <LedgerHistory subscriptionId={item.id} />
      </div>
    </article>
  )
}
