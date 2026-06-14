import { Plus } from 'lucide-react'
import type { Subscription } from '../../types/domain.types'
import type { SubscriptionFilter } from './subscriptions.shared'
import { SummaryBar } from './components/SummaryBar'
import { SubscriptionCard } from './components/SubscriptionCard'
import { SubscriptionFormSheet } from './components/SubscriptionFormSheet'
import type { SubscriptionPayload } from './components/SubscriptionFormFields'

type SubscriptionsMobileViewProps = {
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

// SubscriptionsMobileView 渲染移动端订阅列表和底部表单 sheet。
export function SubscriptionsMobileView(props: SubscriptionsMobileViewProps) {
  return (
    <div className="space-y-4 p-4 md:hidden">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-black">Subscriptions</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">订阅、到期和用量。</p>
        </div>
        <button type="button" onClick={props.onCreateClick} className="nexus-button-primary h-10 w-10 p-0" aria-label="添加订阅">
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <SummaryBar monthlyTotals={props.monthlyTotals} expiringCount={props.expiringCount} expiredCount={props.expiredCount} filter={props.filter} onFilterChange={props.onFilterChange} />

      {props.isLoading ? (
        <section className="nexus-surface p-4 text-sm text-muted-foreground">加载中...</section>
      ) : props.items.length === 0 ? (
        <section className="nexus-surface p-8 text-center text-sm text-muted-foreground">暂无订阅记录</section>
      ) : (
        <section className="space-y-3">
          {props.items.map((item) => (
            <SubscriptionCard key={item.id} item={item} deleting={props.deletingId === item.id} usageSaving={props.usageSavingId === item.id} onEdit={props.onEdit} onDelete={props.onDelete} onUpdateUsage={props.onUpdateUsage} />
          ))}
        </section>
      )}

      <SubscriptionFormSheet open={props.formOpen} item={props.editingItem} saving={props.saving} onOpenChange={props.onFormOpenChange} onSubmit={props.onSubmit} />
    </div>
  )
}
