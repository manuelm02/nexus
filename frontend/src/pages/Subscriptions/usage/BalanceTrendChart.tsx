import { useQuery } from '@tanstack/react-query'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { subscriptionApi } from '../../../api/subscription.api'
import { formatDate } from '../../../lib/utils'

type BalanceTrendChartProps = { subscriptionId: string }

// BalanceTrendChart 用量账户卡片内的近30天余额迷你趋势图，数据来自 /balance-history
export function BalanceTrendChart({ subscriptionId }: BalanceTrendChartProps) {
  const { data } = useQuery({
    queryKey: ['subscription-balance-history', subscriptionId],
    queryFn: () => subscriptionApi.balanceHistory(subscriptionId, 30),
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
            <linearGradient id={`balance-${subscriptionId}`} x1="0" y1="0" x2="0" y2="1">
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
          <Area type="monotone" dataKey="balance" name="余额" stroke="hsl(var(--primary))" fill={`url(#balance-${subscriptionId})`} strokeWidth={1.5} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
