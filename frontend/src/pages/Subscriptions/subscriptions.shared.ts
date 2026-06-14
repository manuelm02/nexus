import type { Subscription } from '../../types/domain.types'
import { BILLING_TYPE_LABELS } from '../../lib/constants'

export type SubscriptionStatus = Subscription['status']
export type SubscriptionFilter = 'all' | 'expiring' | 'expired'

export const SUBSCRIPTION_STATUSES: SubscriptionStatus[] = ['active', 'expired', 'cancelled', 'paused']

export const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  active: '订阅中',
  expired: '已到期',
  cancelled: '已取消',
  paused: '已暂停',
}

export const STATUS_STYLES: Record<SubscriptionStatus, string> = {
  active: 'border-[hsl(var(--success)/0.25)] bg-[hsl(var(--success-soft))] text-[hsl(var(--success))]',
  expired: 'border-[hsl(var(--destructive)/0.24)] bg-[hsl(var(--destructive-soft))] text-[hsl(var(--destructive))]',
  cancelled: 'border-border bg-muted text-muted-foreground',
  paused: 'border-[hsl(var(--warning)/0.28)] bg-[hsl(var(--warning-soft))] text-[hsl(var(--warning))]',
}

export { BILLING_TYPE_LABELS }

export function daysUntil(dateStr?: string): number | null {
  if (!dateStr) return null
  const target = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(target.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - today.getTime()) / 86400000)
}

export function isExpiringSoon(item: Subscription): boolean {
  const days = daysUntil(item.expireDate)
  return item.status === 'active' && days !== null && days >= 0 && days <= item.notifyDaysBefore
}

export function isExpired(item: Subscription): boolean {
  return item.status === 'expired'
}

export function groupMonthlyTotalsByCurrency(items: Subscription[]): Record<string, number> {
  return items.reduce<Record<string, number>>((totals, item) => {
    if (item.status !== 'active' || item.billingType !== 'monthly') return totals
    const currency = item.currency || 'CNY'
    totals[currency] = (totals[currency] ?? 0) + (item.price ?? 0)
    return totals
  }, {})
}

export function usagePercent(item: Subscription): number | null {
  if (!item.usageLimit || item.usageLimit <= 0) return null
  return Math.min(100, Math.max(0, ((item.usageUsed ?? 0) / item.usageLimit) * 100))
}

export function formatMoney(currency: string, amount: number): string {
  const symbol = currency === 'CNY' ? '¥' : currency === 'USD' ? '$' : `${currency} `
  return `${symbol}${amount.toFixed(2)}`
}
