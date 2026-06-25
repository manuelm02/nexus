import { useState } from 'react'
import { Pencil, RefreshCw, Copy } from 'lucide-react'
import type { ApiKey } from '../../../types/domain.types'
import { cn, formatRelative } from '../../../lib/utils'
import { balanceHealth, type BalanceHealth, PROVIDER_COLORS, STATUS_STYLES, STATUS_LABELS } from './apikeys.shared'
import { DeleteConfirm } from '../components/DeleteConfirm'
import { LedgerHistory } from '../components/LedgerHistory'
import { BalanceTrendChart } from '../components/BalanceTrendChart'
import { apiKeyApi } from '../../../api/apiKey.api'

type PayAsYouGoCardProps = {
  item: ApiKey
  deleting: boolean
  syncing: boolean
  onEdit: (item: ApiKey) => void
  onDelete: (id: string) => void
  onRecharge: (id: string, amount: number, note?: string) => void
  onSyncBalance: (id: string) => void
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

function InlineRechargeAction({ onSubmit }: { onSubmit: (amount: number) => void }) {
  const [amount, setAmount] = useState('')
  const handleSubmit = () => {
    if (!amount || Number(amount) <= 0) return
    onSubmit(Number(amount))
    setAmount('')
  }
  return (
    <div className="flex gap-1">
      <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit() }}
        className="nexus-input h-8 flex-1 px-2 text-xs" placeholder="金额" />
      <button type="button" disabled={!amount || Number(amount) <= 0} onClick={handleSubmit}
        className="h-8 px-2 text-[11px] font-bold rounded-md border border-[hsl(var(--success)/0.3)] bg-[hsl(var(--success-soft))] text-[hsl(var(--success))] disabled:opacity-50">
        充值
      </button>
    </div>
  )
}

/** 按量计费卡片：余额追踪、趋势图、充值操作、充值流水。占满一行用于置顶展示。 */
export function PayAsYouGoCard({ item, deleting, syncing, onEdit, onDelete, onRecharge, onSyncBalance }: PayAsYouGoCardProps) {
  const health = balanceHealth(item)
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
    <article className={cn('rounded-lg border bg-card p-4 shadow-[var(--shadow-xs)]', BORDER_BY_HEALTH[health])}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1 flex-1">
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

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold text-muted-foreground">
            <span className={cn('font-mono', health !== 'normal' && TEXT_COLOR_BY_HEALTH[health])}>
              官方余额：{item.remainingBalance?.toFixed(2) ?? '—'}
            </span>
            <span className="font-mono">当月消费：{item.monthlySpend?.toFixed(2) ?? '0.00'}</span>
            {item.lowBalanceThreshold != null && (
              <span className="font-mono">预警阈值：{item.lowBalanceThreshold.toFixed(2)}</span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={() => onEdit(item)} className="nexus-button-utility h-9 w-9 text-muted-foreground" aria-label="编辑">
            <Pencil className="h-4 w-4" />
          </button>
          <DeleteConfirm deleting={deleting} onConfirm={() => onDelete(item.id)} />
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>余额由 {item.provider} 官方同步{item.apiLastFetchedAt ? `（同步于 ${formatRelative(item.apiLastFetchedAt)}）` : ''}</span>
        <button type="button" onClick={() => onSyncBalance(item.id)} disabled={syncing} className="nexus-button-utility h-7 gap-1 px-2 text-[11px]">
          <RefreshCw className={cn('h-3 w-3', syncing && 'animate-spin')} /> 刷新余额
        </button>
      </div>

      <div className="mt-3">
        <BalanceTrendChart entityId={item.id} fetchFn={apiKeyApi.balanceHistory} queryKey={['api-key-balance-history']} />
      </div>

      <div className="mt-3 space-y-1">
        <span className="text-[11px] font-bold text-muted-foreground">充值</span>
        <InlineRechargeAction onSubmit={(amount) => onRecharge(item.id, amount)} />
      </div>

      <div className="mt-3">
        <LedgerHistory entityId={item.id} fetchFn={apiKeyApi.ledger} queryKey={['api-key-ledger']} />
      </div>
    </article>
  )
}
