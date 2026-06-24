import { useQuery } from '@tanstack/react-query'
import type { ApiKey, Credential, Subscription, SubscriptionStats } from '../../../types/domain.types'
import { subscriptionApi } from '../../../api/subscription.api'
import type { SubscriptionFilter } from '../panelhub.shared'
import { isExpiringSoon, daysUntilExpiry } from '../credentials/credentials.shared'
import { SubscriptionsStatsRow } from './SubscriptionsStatsRow'
import { MonthlySpendTrendChart } from './dashboard/MonthlySpendTrendChart'
import { CategoryPieChart } from './dashboard/CategoryPieChart'
import { ExpiryTimeline } from './dashboard/ExpiryTimeline'

type PanelHubDashboardProps = {
  stats: SubscriptionStats | null
  statsLoading: boolean
  expiringCount: number
  expiredCount: number
  filter: SubscriptionFilter
  subscriptionItems: Subscription[]
  onFilterChange: (filter: SubscriptionFilter) => void
  apiKeys?: ApiKey[]
  credentials?: Credential[]
}

/** PanelHub 概览：订阅统计 + API Key 状态概览 + 账号到期提醒 */
export function PanelHubDashboard(props: PanelHubDashboardProps) {
  const { apiKeys = [], credentials = [] } = props
  const { data: ratesData } = useQuery({
    queryKey: ['subscription-exchange-rates'],
    queryFn: () => subscriptionApi.exchangeRates(),
    staleTime: 1000 * 60 * 60,
  })
  const rates = ratesData?.data?.data ?? {}

  const activeKeys = apiKeys.filter((k) => !k.archived)
  const keyActiveCount = activeKeys.filter((k) => k.status === 'active').length
  const keyExhaustedCount = activeKeys.filter((k) => k.status === 'exhausted').length
  const keyDisabledCount = activeKeys.filter((k) => k.status === 'disabled').length
  const keyTotalBalance = activeKeys.filter((k) => k.status === 'active')
    .reduce((sum, k) => sum + (k.remainingBalance ?? 0), 0)
  const lowBalanceKeys = activeKeys.filter((k) =>
    k.status === 'active' && k.lowBalanceNotify && k.remainingBalance != null &&
    k.lowBalanceThreshold != null && k.remainingBalance < k.lowBalanceThreshold
  )
  const expiringCredentials = credentials.filter((c) => !c.archived && isExpiringSoon(c, 30))

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-2">
        <MonthlySpendTrendChart items={props.subscriptionItems} rates={rates} />
        <CategoryPieChart items={props.subscriptionItems} rates={rates} />
      </div>
      <SubscriptionsStatsRow
        stats={props.stats}
        statsLoading={props.statsLoading}
        rates={rates}
        expiringCount={props.expiringCount}
        expiredCount={props.expiredCount}
        filter={props.filter}
        onFilterChange={props.onFilterChange}
      />
      <ExpiryTimeline items={props.subscriptionItems} />

      {/* API Key 状态概览 */}
      {activeKeys.length > 0 && (
        <div className="rounded-lg border bg-card p-4 shadow-[var(--shadow-xs)]">
          <h3 className="text-sm font-bold text-foreground mb-3">API Key 状态</h3>
          <div className="grid grid-cols-4 gap-3 text-center">
            <div className="space-y-1">
              <p className="text-2xl font-bold text-emerald-600">{keyActiveCount}</p>
              <p className="text-[11px] text-muted-foreground">可用</p>
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-bold text-red-500">{keyExhaustedCount}</p>
              <p className="text-[11px] text-muted-foreground">已耗尽</p>
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-bold text-gray-400">{keyDisabledCount}</p>
              <p className="text-[11px] text-muted-foreground">已禁用</p>
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-bold text-foreground">¥{keyTotalBalance.toFixed(2)}</p>
              <p className="text-[11px] text-muted-foreground">总余额</p>
            </div>
          </div>
          {lowBalanceKeys.length > 0 && (
            <div className="mt-3 space-y-1">
              <p className="text-[11px] font-bold text-[hsl(var(--warning))]">低余额预警：</p>
              {lowBalanceKeys.map((k) => (
                <p key={k.id} className="text-[11px] text-muted-foreground">
                  {k.label}（{k.provider}）— 余额 ¥{k.remainingBalance?.toFixed(2)}（阈值 ¥{k.lowBalanceThreshold?.toFixed(2)}）
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 账号到期提醒 */}
      {expiringCredentials.length > 0 && (
        <div className="rounded-lg border bg-card p-4 shadow-[var(--shadow-xs)]">
          <h3 className="text-sm font-bold text-foreground mb-3">即将到期的账号</h3>
          <div className="space-y-1.5">
            {expiringCredentials.map((c) => {
              const days = daysUntilExpiry(c)
              return (
                <p key={c.id} className="text-[11px] text-muted-foreground flex justify-between">
                  <span>{c.platform}{c.label ? ` — ${c.label}` : ''}</span>
                  <span className="font-bold text-[hsl(var(--warning))]">
                    {days != null && days <= 0 ? '已过期' : `还有 ${days} 天`}
                  </span>
                </p>
              )
            })}
          </div>
        </div>
      )}
      {expiringCredentials.length === 0 && credentials.length > 0 && (
        <div className="rounded-lg border bg-card p-4 shadow-[var(--shadow-xs)]">
          <h3 className="text-sm font-bold text-foreground mb-2">账号到期提醒</h3>
          <p className="text-[11px] text-muted-foreground">暂无即将到期的账号</p>
        </div>
      )}
    </div>
  )
}
