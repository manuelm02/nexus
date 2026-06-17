import { useQuery } from '@tanstack/react-query'
import type { Subscription, SubscriptionStats } from '../../../types/domain.types'
import { subscriptionApi } from '../../../api/subscription.api'
import type { SubscriptionFilter } from '../subscriptions.shared'
import { SubscriptionsStatsRow } from './SubscriptionsStatsRow'
import { MonthlySpendTrendChart } from './dashboard/MonthlySpendTrendChart'
import { CategoryPieChart } from './dashboard/CategoryPieChart'
import { ExpiryTimeline } from './dashboard/ExpiryTimeline'

type SubscriptionsDashboardProps = {
  stats: SubscriptionStats | null
  statsLoading: boolean
  expiringCount: number
  expiredCount: number
  filter: SubscriptionFilter
  subscriptionItems: Subscription[]
  onFilterChange: (filter: SubscriptionFilter) => void
}

// SubscriptionsDashboard 概览 Tab：图表置顶 + 统一汇率获取 + 统计行 + 到期时间线
export function SubscriptionsDashboard(props: SubscriptionsDashboardProps) {
  const { data: ratesData } = useQuery({
    queryKey: ['subscription-exchange-rates'],
    queryFn: () => subscriptionApi.exchangeRates(),
    staleTime: 1000 * 60 * 60,
  })
  const rates = ratesData?.data?.data ?? {}

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
    </div>
  )
}
