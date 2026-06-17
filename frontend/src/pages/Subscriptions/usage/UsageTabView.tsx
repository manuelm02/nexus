import { useUsageAccounts } from './useUsageAccounts'
import { UsageAccountCreateDialog } from './UsageAccountCreateDialog'
import { UsageAccountCard } from '../components/UsageAccountCard'
import type { Subscription } from '../../../types/domain.types'

type UsageTabViewProps = {
  createOpen: boolean
  onCreateOpenChange: (open: boolean) => void
  onAiSuggestCategory: (name: string, notes?: string) => Promise<string | undefined>
  onEdit: (item: Subscription) => void
}

// UsageTabView "用量面板"Tab 的视图：数据查询、统计文案、卡片列表、创建弹窗；新增按钮由父级标题行统一提供。
export function UsageTabView({ createOpen, onCreateOpenChange, onAiSuggestCategory, onEdit }: UsageTabViewProps) {
  const account = useUsageAccounts()

  return (
    <div className="space-y-4">
      <div className="text-xs font-semibold text-muted-foreground">
        共 {account.usageItems.length} 个用量账户
      </div>

      {account.isLoading ? (
        <section className="nexus-surface p-4 text-sm text-muted-foreground">加载中...</section>
      ) : account.usageItems.length === 0 ? (
        <section className="nexus-surface p-8 text-center text-sm text-muted-foreground">暂无用量账户，点击上方"+ 新增"按钮添加</section>
      ) : (
        <section className="space-y-3">
          {account.usageItems.map((item) => (
            <UsageAccountCard
              key={item.id}
              item={item}
              deleting={account.deletingId === item.id}
              syncing={account.syncingId === item.id}
              onEdit={onEdit}
              onDelete={account.deleteAccount}
              onRecharge={account.recharge}
              onConsume={account.consume}
              onSyncBalance={account.syncBalance}
            />
          ))}
        </section>
      )}

      <UsageAccountCreateDialog
        open={createOpen}
        onOpenChange={onCreateOpenChange}
        categories={account.categories}
        creating={account.creating}
        createError={account.createError}
        createSuccess={account.createSuccess}
        onSubmit={(payload) => account.createUsageAccount(payload)}
        onAiSuggestCategory={onAiSuggestCategory}
      />
    </div>
  )
}
