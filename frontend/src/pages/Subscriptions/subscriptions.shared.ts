import type { Subscription } from '../../types/domain.types'
import { BILLING_TYPE_LABELS } from '../../lib/constants'

export type SubscriptionStatus = Subscription['status']
export type SubscriptionFilter = 'all' | 'expiring' | 'expired'
export type SubscriptionView = 'dashboard' | 'subscriptions' | 'usage' | 'archived'

export const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  active: '订阅中',
  expired: '已过期',
  paused: '已暂停',
}

export const STATUS_STYLES: Record<SubscriptionStatus, string> = {
  active: 'border-[hsl(var(--success)/0.25)] bg-[hsl(var(--success-soft))] text-[hsl(var(--success))]',
  expired: 'border-[hsl(var(--destructive)/0.24)] bg-[hsl(var(--destructive-soft))] text-[hsl(var(--destructive))]',
  paused: 'border-[hsl(var(--warning)/0.28)] bg-[hsl(var(--warning-soft))] text-[hsl(var(--warning))]',
}

export { BILLING_TYPE_LABELS }

type BillingType = 'monthly' | 'yearly' | 'one_time' | 'lifetime' | 'per_token'

type FieldKey =
  | 'name' | 'category' | 'price' | 'currency' | 'startDate' | 'expireDate'
  | 'nextBillingDate' | 'autoRenew' | 'notifyEnabled' | 'notifyDaysBefore'
  | 'url' | 'notes' | 'archived'
  | 'remainingBalance' | 'monthlySpend'
  | 'lowBalanceNotify' | 'lowBalanceThreshold'
  | 'usageLimit' | 'usageUnit'

/** 按类型的字段可见性映射，驱动表单和卡片渲染 */
export const FIELD_VISIBILITY: Record<BillingType, Set<FieldKey>> = {
  monthly: new Set(['name', 'category', 'price', 'currency', 'startDate', 'expireDate', 'nextBillingDate', 'autoRenew', 'notifyEnabled', 'notifyDaysBefore', 'url', 'notes', 'archived']),
  yearly: new Set(['name', 'category', 'price', 'currency', 'startDate', 'expireDate', 'nextBillingDate', 'autoRenew', 'notifyEnabled', 'notifyDaysBefore', 'url', 'notes', 'archived']),
  one_time: new Set(['name', 'category', 'price', 'currency', 'startDate', 'expireDate', 'notifyEnabled', 'notifyDaysBefore', 'url', 'notes', 'archived']),
  lifetime: new Set(['name', 'category', 'price', 'currency', 'startDate', 'notes', 'archived']),
  per_token: new Set(['name', 'category', 'remainingBalance', 'monthlySpend', 'lowBalanceNotify', 'lowBalanceThreshold', 'notes', 'archived']),
}

export function isFieldVisible(billingType: string | undefined, field: FieldKey): boolean {
  if (!billingType) return true
  const set = FIELD_VISIBILITY[billingType as BillingType]
  return set ? set.has(field) : true
}

export function daysUntil(dateStr?: string): number | null {
  if (!dateStr) return null
  const target = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(target.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - today.getTime()) / 86400000)
}

export function isExpiringSoon(item: Subscription): boolean {
  if (item.archived) return false
  const days = daysUntil(item.expireDate)
  return item.status === 'active' && days !== null && days >= 0 && days <= item.notifyDaysBefore
}

export function isExpired(item: Subscription): boolean {
  return item.status === 'expired'
}

export function usagePercent(item: Subscription): number | null {
  if (!item.usageLimit || item.usageLimit <= 0) return null
  return Math.min(100, Math.max(0, ((item.usageUsed ?? 0) / item.usageLimit) * 100))
}

export type BalanceHealth = 'normal' | 'low' | 'empty'

/** 按量账户余额健康度：归档项强制视为 normal（不强调色）。 */
export function balanceHealth(item: Subscription): BalanceHealth {
  if (item.archived) return 'normal'
  const balance = item.remainingBalance ?? 0
  if (balance <= 0) return 'empty'
  if (item.lowBalanceThreshold != null && balance <= item.lowBalanceThreshold) return 'low'
  return 'normal'
}

/** 环形图填充比例：以预警阈值的 3 倍为"满"刻度；未设阈值时仅区分有/无余额。 */
export function balanceRatio(item: Subscription): number {
  const balance = item.remainingBalance ?? 0
  if (item.lowBalanceThreshold != null && item.lowBalanceThreshold > 0) {
    return balance / (item.lowBalanceThreshold * 3)
  }
  return balance > 0 ? 1 : 0
}

export type CycleHealth = 'normal' | 'soon' | 'overdue'

/** 计费周期健康度：归档项强制视为 normal（不强调色）。 */
export function cycleHealth(item: Subscription): CycleHealth {
  if (item.archived) return 'normal'
  if (isExpired(item)) return 'overdue'
  if (isExpiringSoon(item)) return 'soon'
  return 'normal'
}

export type CycleProgress = { percent: number; elapsedDays: number; totalDays: number }

function daysBetween(startStr: string, endStr: string): number {
  const start = new Date(`${startStr}T00:00:00`)
  const end = new Date(`${endStr}T00:00:00`)
  return Math.round((end.getTime() - start.getTime()) / 86400000)
}

function addPeriod(dateStr: string, unit: 'month' | 'year', delta: number): string {
  const d = new Date(`${dateStr}T00:00:00`)
  if (unit === 'month') d.setMonth(d.getMonth() + delta)
  else d.setFullYear(d.getFullYear() + delta)
  return d.toISOString().slice(0, 10)
}

/**
 * 计费周期进度：monthly/yearly 以 nextBillingDate（或 expireDate）往前推一个周期作为周期起点；
 * one_time 用 startDate~expireDate；lifetime 无周期，返回 null。
 */
export function cycleProgress(item: Subscription): CycleProgress | null {
  const bt = item.billingType
  let startStr: string | undefined
  let endStr: string | undefined

  if (bt === 'one_time') {
    startStr = item.startDate
    endStr = item.expireDate
  } else if (bt === 'monthly' || bt === 'yearly') {
    endStr = item.nextBillingDate ?? item.expireDate
    if (endStr) startStr = addPeriod(endStr, bt === 'monthly' ? 'month' : 'year', -1)
  }

  if (!startStr || !endStr) return null
  const totalDays = daysBetween(startStr, endStr)
  if (totalDays <= 0) return null

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const elapsedRaw = Math.round((today.getTime() - new Date(`${startStr}T00:00:00`).getTime()) / 86400000)
  const elapsedDays = Math.min(Math.max(elapsedRaw, 0), totalDays)
  return { percent: (elapsedDays / totalDays) * 100, elapsedDays, totalDays }
}

export function formatMoney(currency: string, amount: number): string {
  const symbol = currency === 'CNY' ? '¥' : currency === 'USD' ? '$' : `${currency} `
  return `${symbol}${amount.toFixed(2)}`
}

/** 按类型返回应展示的日期标签和值 */
export function dueDateLabel(item: Subscription): { label: string; date: string | undefined } | null {
  const bt = item.billingType
  if (bt === 'monthly' || bt === 'yearly') {
    if (item.nextBillingDate) return { label: '下次扣费日期', date: item.nextBillingDate }
    if (item.expireDate) return { label: '到期日期', date: item.expireDate }
    return null
  }
  if (bt === 'one_time') {
    return item.expireDate ? { label: '结束日期', date: item.expireDate } : null
  }
  if (bt === 'lifetime') {
    return item.startDate ? { label: '购买日期', date: item.startDate } : null
  }
  return null
}

export type MonthlySpendPoint = { month: string; total: number }

/**
 * 近 N 个月"月度等效总支出"折算为 CNY 的趋势：
 * monthly 按月价计入，yearly 按 price/12 计入；
 * 若订阅有 startDate 且晚于该月月末，则该月不计入（订阅尚未开始）。
 * 非 CNY 金额按 rates 折算，缺失汇率的币种当月不计入（与 categorySpendConverted 一致的口径）。
 */
export function monthlySpendTrend(items: Subscription[], rates: Record<string, number>, monthsBack = 6): MonthlySpendPoint[] {
  const today = new Date()
  today.setDate(1)
  today.setHours(0, 0, 0, 0)

  const points: MonthlySpendPoint[] = []
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setMonth(d.getMonth() - i)
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0)
    let total = 0

    items.forEach((item) => {
      if (item.archived || item.status !== 'active') return
      if (item.billingType !== 'monthly' && item.billingType !== 'yearly') return
      if (item.startDate) {
        const start = new Date(`${item.startDate}T00:00:00`)
        if (start > monthEnd) return
      }
      const currency = item.currency || 'CNY'
      const rate = currency === 'CNY' ? 1 : rates[currency]
      if (rate == null) return
      const monthlyEquivalent = (item.billingType === 'monthly' ? (item.price ?? 0) : (item.price ?? 0) / 12) * rate
      total += monthlyEquivalent
    })

    points.push({ month: `${d.getMonth() + 1}月`, total })
  }
  return points
}

export type CnyAmount = { cny: number; unconverted: { currency: string; amount: number }[] }

/** 将 {currency: amount} 记录折算为 CNY 汇总；汇率缺失的币种归入 unconverted，由调用方展示提示 */
export function toCnyAmount(record: Record<string, number>, rates: Record<string, number>): CnyAmount {
  let cny = 0
  const unconverted: { currency: string; amount: number }[] = []
  Object.entries(record).forEach(([currency, amount]) => {
    const rate = currency === 'CNY' ? 1 : rates[currency]
    if (rate == null) { unconverted.push({ currency, amount }); return }
    cny += amount * rate
  })
  return { cny, unconverted }
}

export type CategorySpend = { category: string; amount: number }

/**
 * 分类支出占比（全币种汇总为 CNY）：monthly 按月价计入，yearly 按 price/12 折算为月度等效，
 * 非 CNY 金额按 `rates`（currency -> 兑 CNY 汇率）折算。`rates` 中缺失的币种会被跳过并计入 excludedCount。
 */
export function categorySpendConverted(items: Subscription[], rates: Record<string, number>): { data: CategorySpend[]; excludedCount: number } {
  let excludedCount = 0
  const totals = new Map<string, number>()

  items.forEach((item) => {
    if (item.archived || item.status !== 'active') return
    if (item.billingType !== 'monthly' && item.billingType !== 'yearly') return

    const currency = item.currency || 'CNY'
    const rate = currency === 'CNY' ? 1 : rates[currency]
    if (rate == null) {
      excludedCount++
      return
    }

    const monthlyEquivalent = (item.billingType === 'monthly' ? (item.price ?? 0) : (item.price ?? 0) / 12) * rate
    const category = item.category || '未分类'
    totals.set(category, (totals.get(category) ?? 0) + monthlyEquivalent)
  })

  return {
    data: Array.from(totals.entries()).map(([category, amount]) => ({ category, amount })),
    excludedCount,
  }
}

export type UpcomingDue = { id: string; name: string; date: string; daysLeft: number; amount: number; currency: string }

/** 未来 N 天内到期/续费的订阅，按日期升序，用于到期时间线 */
export function upcomingDueItems(items: Subscription[], daysAhead = 90): UpcomingDue[] {
  return items
    .filter((item) => !item.archived && item.status === 'active' && (item.billingType === 'monthly' || item.billingType === 'yearly' || item.billingType === 'one_time'))
    .map((item) => {
      const dateStr = item.nextBillingDate ?? item.expireDate
      if (!dateStr) return null
      const days = daysUntil(dateStr)
      if (days === null || days < 0 || days > daysAhead) return null
      return { id: item.id, name: item.name, date: dateStr, daysLeft: days, amount: item.price ?? 0, currency: item.currency || 'CNY' }
    })
    .filter((x): x is UpcomingDue => x !== null)
    .sort((a, b) => a.daysLeft - b.daysLeft)
}
