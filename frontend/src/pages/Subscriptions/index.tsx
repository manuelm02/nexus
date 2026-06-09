import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { subscriptionApi } from '../../api/subscription.api'
import type { Subscription } from '../../types/domain.types'
import { BILLING_TYPE_LABELS } from '../../lib/constants'
import { cn, formatDate } from '../../lib/utils'
import { Plus, Trash2, CreditCard, AlertCircle } from 'lucide-react'

const STATUS_COLOR: Record<string, string> = {
  active:    'text-green-600 bg-green-50',
  expired:   'text-red-600 bg-red-50',
  cancelled: 'text-gray-500 bg-gray-50',
  paused:    'text-yellow-600 bg-yellow-50',
}
const STATUS_LABEL: Record<string, string> = {
  active: '订阅中', expired: '已到期', cancelled: '已取消', paused: '已暂停',
}

// SubscriptionsPage 管理订阅服务、费用和到期信息。
export default function SubscriptionsPage() {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', category: '', price: '', currency: 'CNY', billingType: 'monthly', expireDate: '' })
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: () => subscriptionApi.list(),
  })

  const createMutation = useMutation({
    mutationFn: () => subscriptionApi.create({
      name: form.name,
      category: form.category || undefined,
      price: form.price ? parseFloat(form.price) : undefined,
      currency: form.currency,
      billingType: form.billingType || undefined,
      expireDate: form.expireDate || undefined,
    } as Partial<Subscription>),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['subscriptions'] })
      setShowForm(false)
      setForm({ name: '', category: '', price: '', currency: 'CNY', billingType: 'monthly', expireDate: '' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => subscriptionApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subscriptions'] }),
  })

  const items: Subscription[] = data?.data?.data ?? []
  const totalMonthly = items
    .filter((i) => i.status === 'active' && i.billingType === 'monthly')
    .reduce((sum, i) => sum + (i.price ?? 0), 0)

  const isExpiringSoon = (item: Subscription) => {
    if (!item.expireDate) return false
    const days = Math.ceil((new Date(item.expireDate).getTime() - Date.now()) / 86400000)
    return days <= 7 && days >= 0
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">Subscriptions</h1>
          <p className="text-xs text-muted-foreground mt-0.5">你为什么付费，比你付了多少钱更值得记录。</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" /> 添加
        </button>
      </div>

      {totalMonthly > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">月度支出（订阅中）</p>
          <p className="text-2xl font-bold mt-1">¥{totalMonthly.toFixed(2)}</p>
        </div>
      )}

      {showForm && (
        <form
          onSubmit={(e) => { e.preventDefault(); createMutation.mutate() }}
          className="rounded-lg border bg-card p-4 space-y-3"
        >
          <h2 className="text-sm font-medium">添加订阅</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <input
                required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="服务名称 *"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <input
              value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
              placeholder="分类（如：AI工具）"
              className="rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <input
              type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })}
              placeholder="金额"
              className="rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <select
              value={form.billingType} onChange={(e) => setForm({ ...form, billingType: e.target.value })}
              className="rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {Object.entries(BILLING_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <input
              type="date" value={form.expireDate} onChange={(e) => setForm({ ...form, expireDate: e.target.value })}
              placeholder="到期日"
              className="rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent transition-colors">取消</button>
            <button type="submit" disabled={createMutation.isPending} className="rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors">
              保存
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">加载中…</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className="rounded-lg border bg-card p-4 group flex items-start gap-3">
              <CreditCard className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{item.name}</p>
                  <span className={cn('text-xs rounded px-1.5 py-0.5', STATUS_COLOR[item.status])}>
                    {STATUS_LABEL[item.status]}
                  </span>
                  {isExpiringSoon(item) && (
                    <span className="flex items-center gap-1 text-xs text-orange-600">
                      <AlertCircle className="h-3 w-3" /> 即将到期
                    </span>
                  )}
                </div>
                <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                  {item.price && <span>{item.currency} {item.price} / {BILLING_TYPE_LABELS[item.billingType ?? ''] ?? item.billingType}</span>}
                  {item.expireDate && <span>到期：{formatDate(item.expireDate)}</span>}
                  {item.category && <span>{item.category}</span>}
                </div>
              </div>
              <button
                onClick={() => deleteMutation.mutate(item.id)}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">暂无订阅记录</p>
          )}
        </ul>
      )}
    </div>
  )
}
