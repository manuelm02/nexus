import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Subscription } from '../../../../types/domain.types'
import { monthlySpendTrend } from '../../subscriptions.shared'

type MonthlySpendTrendChartProps = { items: Subscription[]; rates: Record<string, number> }

// MonthlySpendTrendChart 概览图表：近 6 个月总支出（CNY，月度等效）趋势，配色与用量趋势图统一使用 primary 渐变
export function MonthlySpendTrendChart({ items, rates }: MonthlySpendTrendChartProps) {
  const data = monthlySpendTrend(items, rates, 6)
  return (
    <div className="nexus-surface p-4">
      <h3 className="text-sm font-bold">近 6 个月总支出（CNY，月度等效）</h3>
      <div className="mt-2 h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="monthly-spend-trend" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(value) => Number(value).toFixed(2)} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
            <Area type="monotone" dataKey="total" name="总支出" stroke="hsl(var(--primary))" fill="url(#monthly-spend-trend)" strokeWidth={1.5} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
