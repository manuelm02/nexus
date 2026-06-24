import { useEffect, useRef, useState } from 'react'
import type { ApiKey } from '../../../types/domain.types'
import { ApiKeyCard } from './ApiKeyCard'
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

/** API Key Tab 主视图：卡片网格展示。加载态和空状态使用统一的 nexus-surface 风格。数据与操作通过 props 注入。 */
export function ApiKeyTabView({ isLoading, createRequestKey, apiKeys, syncingId, creating, onCreate, onUpdate, onDelete, onRecharge, onConsume, onSyncBalance }: ApiKeyTabViewProps) {
  const [formOpen, setFormOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<ApiKey | null>(null)
  const previousCreateRequestKeyRef = useRef(createRequestKey)

  const activeItems = apiKeys.filter((k) => !k.archived)

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
        <div className="grid gap-3 lg:grid-cols-2">
          {activeItems.map((k) => (
            <ApiKeyCard
              key={k.id}
              item={k}
              deleting={false}
              syncing={syncingId === k.id}
              onEdit={handleEdit}
              onDelete={onDelete}
              onRecharge={(id, amount, note) => onRecharge(id, { amount, note })}
              onConsume={(id, amount, note) => onConsume(id, { amount, note })}
              onSyncBalance={onSyncBalance}
            />
          ))}
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
