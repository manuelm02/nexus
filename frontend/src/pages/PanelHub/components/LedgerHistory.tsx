import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown } from 'lucide-react'
import { cn, formatDate } from '../../../lib/utils'

type LedgerPoint = { id: string; entryType: string; amount: number; balanceAfter: number; note?: string; occurredOn: string }

type LedgerHistoryProps = {
  entityId: string
  fetchFn: (id: string, limit: number) => Promise<{ data?: { data?: LedgerPoint[] } }>
  queryKey: string[]
  limit?: number
}

/** 泛化流水记录折叠组件，支持 API Key 和订阅共用 */
export function LedgerHistory({ entityId, fetchFn, queryKey, limit = 10 }: LedgerHistoryProps) {
  const [open, setOpen] = useState(false)

  const { data } = useQuery({
    queryKey: [...queryKey, entityId],
    queryFn: () => fetchFn(entityId, limit),
    enabled: open,
  })
  const records = data?.data?.data ?? []

  return (
    <div className="border-t pt-2">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between text-[11px] font-bold text-muted-foreground">
        查看流水
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="mt-2 space-y-1.5">
          {records.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">暂无流水记录</p>
          ) : records.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
              <span>{formatDate(r.occurredOn)}</span>
              <span className={cn('font-semibold', r.entryType === 'recharge' ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--destructive))]')}>
                {r.entryType === 'recharge' ? '+' : '-'}{r.amount.toFixed(2)}
              </span>
              <span className="truncate">{r.note}</span>
              <span className="shrink-0">余额 {r.balanceAfter.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
