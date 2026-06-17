import { Plus } from 'lucide-react'
import type { Subscription, SubscriptionStats } from '../../types/domain.types'
import type { SubscriptionFilter, SubscriptionView } from './subscriptions.shared'
import { SubscriptionsDashboard } from './components/SubscriptionsDashboard'
import { SubscriptionCard } from './components/SubscriptionCard'
import { UsageAccountCard } from './components/UsageAccountCard'
import { SubscriptionViewTabs } from './components/SubscriptionViewTabs'
import { UsageTabView } from './usage/UsageTabView'
import { useUsageAccounts } from './usage/useUsageAccounts'

type SubscriptionsDesktopViewProps = {
  view: SubscriptionView
  onViewChange: (view: SubscriptionView) => void
  usageCreateOpen: boolean
  onUsageCreateOpenChange: (open: boolean) => void
  stats: SubscriptionStats | null
  statsLoading: boolean
  expiringCount: number
  expiredCount: number
  filter: SubscriptionFilter
  onFilterChange: (filter: SubscriptionFilter) => void
  subscriptionItems: Subscription[]
  allSubscriptionItems: Subscription[]
  archivedItems: Subscription[]
  archivedCount: number
  deletingId: string | null
  isLoading: boolean
  onCreateClick: () => void
  onCreateUsageClick: () => void
  onEdit: (item: Subscription) => void
  onUnarchive: (id: string) => void
  onDelete: (id: string) => void
  onAiSuggestCategory: (name: string, notes?: string) => Promise<string | undefined>
}

// SubscriptionsDesktopView 渲染桌面端订阅工作台布局：4 Tab（概览/订阅/用量面板/已归档）；弹层由父组件统一渲染
export function SubscriptionsDesktopView(props: SubscriptionsDesktopViewProps) {
  const { view } = props
  const showAddButton = view === 'subscriptions' || view === 'usage'
  const usageAccounts = useUsageAccounts()

  return (
    <div className="mx-auto hidden max-w-5xl space-y-5 p-6 md:block">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Subscriptions</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">你为什么付费，比你付了多少钱更值得记录。</p>
        </div>
        {showAddButton && (
          <button
            type="button"
            onClick={view === 'subscriptions' ? props.onCreateClick : props.onCreateUsageClick}
            className="nexus-button-primary gap-1.5 px-4 text-sm"
          >
            <Plus className="h-4 w-4" /> 新增
          </button>
        )}
      </div>

      <SubscriptionViewTabs
        view={view}
        archivedCount={props.archivedCount}
        onViewChange={props.onViewChange}
      />

      {view === 'dashboard' && (
        <SubscriptionsDashboard
          stats={props.stats}
          statsLoading={props.statsLoading}
          expiringCount={props.expiringCount}
          expiredCount={props.expiredCount}
          filter={props.filter}
          subscriptionItems={props.allSubscriptionItems}
          onFilterChange={props.onFilterChange}
        />
      )}

      {view === 'subscriptions' && (
        props.isLoading ? (
          <section className="nexus-surface p-4 text-sm text-muted-foreground">加载中...</section>
        ) : props.subscriptionItems.length === 0 ? (
          <section className="nexus-surface p-8 text-center text-sm text-muted-foreground">暂无订阅记录</section>
        ) : (
          <section className="grid gap-3 lg:grid-cols-2">
            {props.subscriptionItems.map((item) => (
              <SubscriptionCard
                key={item.id}
                item={item}
                deleting={props.deletingId === item.id}
                onEdit={props.onEdit}
                onDelete={props.onDelete}
              />
            ))}
          </section>
        )
      )}

      {view === 'usage' && (
        <UsageTabView
          createOpen={props.usageCreateOpen}
          onCreateOpenChange={props.onUsageCreateOpenChange}
          onAiSuggestCategory={props.onAiSuggestCategory}
          onEdit={props.onEdit}
        />
      )}

      {view === 'archived' && (
        props.isLoading ? (
          <section className="nexus-surface p-4 text-sm text-muted-foreground">加载中...</section>
        ) : props.archivedItems.length === 0 ? (
          <section className="nexus-surface p-8 text-center text-sm text-muted-foreground">暂无已归档项</section>
        ) : (
          <section className="grid gap-3 lg:grid-cols-2">
            {props.archivedItems.map((item) => (
              item.billingType === 'per_token' ? (
                <UsageAccountCard
                  key={item.id}
                  item={item}
                  deleting={props.deletingId === item.id}
                  syncing={usageAccounts.syncingId === item.id}
                  onEdit={props.onEdit}
                  onDelete={props.onDelete}
                  onRecharge={usageAccounts.recharge}
                  onConsume={usageAccounts.consume}
                  onSyncBalance={usageAccounts.syncBalance}
                  onUnarchive={props.onUnarchive}
                />
              ) : (
                <SubscriptionCard
                  key={item.id}
                  item={item}
                  deleting={props.deletingId === item.id}
                  onEdit={props.onEdit}
                  onDelete={props.onDelete}
                  onUnarchive={props.onUnarchive}
                />
              )
            ))}
          </section>
        )
      )}
    </div>
  )
}
