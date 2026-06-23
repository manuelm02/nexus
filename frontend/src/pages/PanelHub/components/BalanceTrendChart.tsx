import { useQuery } from '@tanstack/react-query'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatDate } from '../../../lib/utils'

type BalancePoint = { balance: number; snapshottedAt: string }

type BalanceTrendChartProps = {
  entityId: string
  fetchFn: (id: string, days: number) => Promise<{ data?: { data?: BalancePoint[] } }>
  queryKey: string[]
  days?: number
}

/** 泛化余额趋势图组件，支持 API Key 和订阅共用，数据来自自定义 fetchFn */
export function BalanceTrendChart({ entityId, fetchFn, queryKey, days = 30 }: BalanceTrendChartProps) {
  const { data } = useQuery({
    queryKey: [...queryKey, entityId],
    queryFn: () => fetchFn(entityId, days),
  })
  const points = data?.data?.data ?? []

  if (points.length < 2) {
    return <p className="text-[11px] text-muted-foreground">同步数据不足，暂无趋势图</p>
  }

  return (
    <div className="h-16 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
          <defs>
            <linearGradient id={`balance-${entityId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="snapshottedAt" hide />
          <YAxis hide domain={['auto', 'auto']} />
          <Tooltip
            formatter={(value) => Number(value).toFixed(2)}
            labelFormatter={(label) => formatDate(String(label))}
            contentStyle={{ fontSize: 11, borderRadius: 8 }}
          />
          <Area type="monotone" dataKey="balance" name="余额" stroke="hsl(var(--primary))" fill={`url(#balance-${entityId})`} strokeWidth={1.5} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
