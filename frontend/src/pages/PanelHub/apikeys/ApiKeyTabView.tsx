import { useEffect, useRef, useState } from 'react'
import type { ApiKey } from '../../../types/domain.types'
import { PayAsYouGoCard } from './PayAsYouGoCard'
import { PlanBasedCard } from './PlanBasedCard'
import { ApiKeyFormDialog } from './ApiKeyFormDialog'

type ApiKeyTabViewProps = {
  isLoading: boolean
  createRequestKey: number
  apiKeys: ApiKey[]
  syncingId: string | null
  creating: boolean
  onCreate: (data: Parameters<typeof import('../../../api/apiKey.api').apiKeyApi.create>[0]) => void
  onUpdate: (id: string, data: Record<string, unknown>) => void
  onDelete: (id: string) => void
  onRecharge: (id: string, data: { amount: number; date?: string; note?: string }) => void
  onConsume: (id: string, data: { amount: number; note?: string }) => void
  onSyncBalance: (id: string) => void
}

/** API Key Tab 主视图：按 billingType 分组——按量计费占满一行置顶，套餐型两列网格在下方。数据与操作通过 props 注入。 */
export function ApiKeyTabView({ isLoading, createRequestKey, apiKeys, syncingId, creating, onCreate, onUpdate, onDelete, onRecharge, onConsume: _onConsume, onSyncBalance }: ApiKeyTabViewProps) {
  const [formOpen, setFormOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<ApiKey | null>(null)
  const previousCreateRequestKeyRef = useRef(createRequestKey)

  const activeItems = apiKeys.filter((k) => !k.archived)

  // 按 billingType 分组
  const payAsYouGo = activeItems.filter((k) => k.billingType === 'pay_as_you_go')
  const planBased = activeItems.filter((k) => k.billingType === 'plan_based')

  const handleEdit = (item: ApiKey) => {
    setEditingItem(item)
    setFormOpen(true)
  }

  useEffect(() => {
    // React StrictMode 会重复执行 effect；只响应父视图顶部"新增"按钮造成的 key 真实变化。
    if (previousCreateRequestKeyRef.current === createRequestKey) {
      return
    }
    previousCreateRequestKeyRef.current = createRequestKey
    setEditingItem(null)
    setFormOpen(true)
  }, [createRequestKey])

  const handleSubmit = (data: Parameters<typeof onCreate>[0], id?: string) => {
    if (id) {
      onUpdate(id, data as Record<string, unknown>)
    } else {
      onCreate(data)
    }
    setFormOpen(false)
  }

  if (isLoading) {
    return <section className="nexus-surface p-8 text-center text-sm text-muted-foreground">加载中…</section>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-muted-foreground">{activeItems.length} 个 API Key</p>
      </div>

      {activeItems.length === 0 ? (
        <section className="nexus-surface p-8 text-center text-sm text-muted-foreground">暂无 API Key 记录</section>
      ) : (
        <div className="space-y-4">
          {/* 按量计费：每个占满一行，置顶 */}
          {payAsYouGo.length > 0 && (
            <div className="space-y-3">
              {payAsYouGo.map((k) => (
                <PayAsYouGoCard
                  key={k.id}
                  item={k}
                  deleting={false}
                  syncing={syncingId === k.id}
                  onEdit={handleEdit}
                  onDelete={onDelete}
                  onRecharge={(id, amount, note) => onRecharge(id, { amount, note })}
                  onSyncBalance={onSyncBalance}
                />
              ))}
            </div>
          )}

          {/* 套餐型：两列网格，在下方 */}
          {planBased.length > 0 && (
            <div className="grid gap-3 lg:grid-cols-2">
              {planBased.map((k) => (
                <PlanBasedCard
                  key={k.id}
                  item={k}
                  deleting={false}
                  onEdit={handleEdit}
                  onDelete={onDelete}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <ApiKeyFormDialog
        open={formOpen}
        item={editingItem}
        saving={creating}
        onOpenChange={(o) => { setFormOpen(o); if (!o) setEditingItem(null) }}
        onSubmit={handleSubmit}
      />
    </div>
  )
}
