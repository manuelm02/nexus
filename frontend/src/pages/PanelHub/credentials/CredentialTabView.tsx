import { useEffect, useRef, useState } from 'react'
import type { Credential } from '../../../types/domain.types'
import { CredentialCard } from './CredentialCard'
import { CredentialFormDialog } from './CredentialFormDialog'
import { groupByCategory } from './credentials.shared'

type CredentialTabViewProps = {
  createRequestKey: number
  credentials: Credential[]
  creating: boolean
  onCreate: (data: Parameters<typeof import('../../../api/credential.api').credentialApi.create>[0]) => void
  onUpdate: (id: string, data: Record<string, unknown>) => void
  onDelete: (id: string) => void
}

/** 凭证管理 Tab 主视图：按分类分组展示卡片，新增入口由 Panel Hub 顶部按钮统一触发。数据与操作通过 props 注入。 */
export function CredentialTabView({ createRequestKey, credentials, creating, onCreate, onUpdate, onDelete }: CredentialTabViewProps) {
  const [formOpen, setFormOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Credential | null>(null)
  const previousCreateRequestKeyRef = useRef(createRequestKey)

  const activeItems = credentials.filter((c) => !c.archived)
  const groups = groupByCategory(activeItems)
  const existingCategories = [...new Set(credentials.map((c) => c.category).filter(Boolean) as string[])]

  const handleEdit = (item: Credential) => {
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

  if (credentials.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">加载中…</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-muted-foreground">{activeItems.length} 个凭证</p>
      </div>

      {activeItems.length === 0 ? (
        <p className="text-sm text-muted-foreground py-12 text-center">暂无凭证，点击上方新增</p>
      ) : (
        Object.entries(groups).map(([category, items]) => (
          <div key={category} className="space-y-2">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{category}</h3>
            <div className="grid gap-3 lg:grid-cols-2">
              {items.map((c) => (
                <CredentialCard
                  key={c.id}
                  item={c}
                  deleting={false}
                  onEdit={handleEdit}
                  onDelete={onDelete}
                />
              ))}
            </div>
          </div>
        ))
      )}

      <CredentialFormDialog
        open={formOpen}
        item={editingItem}
        saving={creating}
        categories={existingCategories}
        onOpenChange={(o) => { setFormOpen(o); if (!o) setEditingItem(null) }}
        onSubmit={handleSubmit}
      />
    </div>
  )
}
