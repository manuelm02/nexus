import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, type PieLabelRenderProps } from 'recharts'
import type { Subscription } from '../../../../types/domain.types'
import { categorySpendConverted } from '../../subscriptions.shared'

type CategoryPieChartProps = { items: Subscription[]; rates: Record<string, number> }

// 分类饼图配色：以 primary 为主色，搭配同饱和度的邻近/互补色，保证各分类在深浅主题下都有足够区分度
const COLORS = [
  'hsl(var(--primary))',
  'hsl(190 75% 45%)',
  'hsl(250 60% 60%)',
  'hsl(35 85% 55%)',
  'hsl(160 55% 42%)',
  'hsl(215 25% 60%)',
]

// CategoryPieChart 概览图表：按分类的月度等效支出占比，全币种按父组件提供的汇率折算为 CNY 汇总
export function CategoryPieChart({ items, rates }: CategoryPieChartProps) {
  const { data, excludedCount } = categorySpendConverted(items, rates)

  if (data.length === 0) {
    return (
      <div className="nexus-surface p-4">
        <h3 className="text-sm font-bold">分类支出占比</h3>
        <p className="mt-2 text-xs text-muted-foreground">暂无周期性订阅数据</p>
      </div>
    )
  }

  return (
    <div className="nexus-surface p-4">
      <h3 className="text-sm font-bold">分类支出占比（已折算为 CNY，月度等效）</h3>
      <div className="mt-2 h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="amount" nameKey="category" cx="50%" cy="50%" outerRadius={80} label={(props: PieLabelRenderProps) => `${String(props.payload?.category || '')} ${((Number(props.percent) || 0) * 100).toFixed(0)}%`}>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(value) => Number(value).toFixed(2)} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      {excludedCount > 0 && (
        <p className="mt-1 text-[11px] text-muted-foreground">另有 {excludedCount} 笔订阅因汇率数据暂未覆盖其币种未计入</p>
      )}
    </div>
  )
}
