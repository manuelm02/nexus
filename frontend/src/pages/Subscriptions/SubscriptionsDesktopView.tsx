import { Plus } from 'lucide-react'
import type { Subscription } from '../../types/domain.types'
import type { SubscriptionFilter } from './subscriptions.shared'
import { SummaryBar } from './components/SummaryBar'
import { SubscriptionCard } from './components/SubscriptionCard'
import { SubscriptionFormDialog } from './components/SubscriptionFormDialog'
import type { SubscriptionPayload } from './components/SubscriptionFormFields'

type SubscriptionsDesktopViewProps = {
  items: Subscription[]
  monthlyTotals: Record<string, number>
  expiringCount: number
  expiredCount: number
  filter: SubscriptionFilter
  formOpen: boolean
  editingItem: Subscription | null
  saving: boolean
  deletingId: string | null
  usageSavingId: string | null
  isLoading: boolean
  onFilterChange: (filter: SubscriptionFilter) => void
  onCreateClick: () => void
  onEdit: (item: Subscription) => void
  onFormOpenChange: (open: boolean) => void
  onSubmit: (payload: SubscriptionPayload, id?: string) => void
  onDelete: (id: string) => void
  onUpdateUsage: (id: string, usageUsed: number) => void
}

// SubscriptionsDesktopView 渲染桌面端订阅工作台布局。
export function SubscriptionsDesktopView(props: SubscriptionsDesktopViewProps) {
  return (
    <div className="mx-auto hidden max-w-5xl space-y-5 p-6 md:block">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Subscriptions</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">你为什么付费，比你付了多少钱更值得记录。</p>
        </div>
        <button type="button" onClick={props.onCreateClick} className="nexus-button-primary gap-1.5 px-4 text-sm">
          <Plus className="h-4 w-4" /> 添加
        </button>
      </div>

      <SummaryBar monthlyTotals={props.monthlyTotals} expiringCount={props.expiringCount} expiredCount={props.expiredCount} filter={props.filter} onFilterChange={props.onFilterChange} />

      {props.isLoading ? (
        <section className="nexus-surface p-4 text-sm text-muted-foreground">加载中...</section>
      ) : props.items.length === 0 ? (
        <section className="nexus-surface p-8 text-center text-sm text-muted-foreground">暂无订阅记录</section>
      ) : (
        <section className="grid gap-3 lg:grid-cols-2">
          {props.items.map((item) => (
            <SubscriptionCard key={item.id} item={item} deleting={props.deletingId === item.id} usageSaving={props.usageSavingId === item.id} onEdit={props.onEdit} onDelete={props.onDelete} onUpdateUsage={props.onUpdateUsage} />
          ))}
        </section>
      )}

      <SubscriptionFormDialog open={props.formOpen} item={props.editingItem} saving={props.saving} onOpenChange={props.onFormOpenChange} onSubmit={props.onSubmit} />
    </div>
  )
}
