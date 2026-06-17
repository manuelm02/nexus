import { useState } from 'react'
import { Loader2, X } from 'lucide-react'
import type { SubscriptionCategory } from '../../../types/domain.types'

export type SubscriptionCategoriesPanelProps = {
  categories: SubscriptionCategory[]
  isLoading: boolean
  onCreate: (name: string) => void
  onDelete: (id: string) => void
  isCreating: boolean
  isDeleting: string | null
}

// 订阅分类管理面板：在设置页展示分类列表并支持增删操作。
export function SubscriptionCategoriesPanel({
  categories,
  isLoading,
  onCreate,
  onDelete,
  isCreating,
  isDeleting,
}: SubscriptionCategoriesPanelProps) {
  const [newName, setNewName] = useState('')

  const handleAdd = () => {
    const trimmed = newName.trim()
    if (!trimmed) return
    onCreate(trimmed)
    setNewName('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAdd()
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-extrabold text-foreground">订阅分类管理</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">管理订阅分类，AI 识别时会自动添加新分类</p>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <span
              key={cat.id}
              className="inline-flex items-center gap-1.5 rounded-full border bg-muted px-3 py-1 text-xs font-semibold text-foreground"
            >
              {cat.name}
              <button
                type="button"
                onClick={() => onDelete(cat.id)}
                disabled={isDeleting === cat.id}
                className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
                aria-label={`删除分类 ${cat.name}`}
              >
                {isDeleting === cat.id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <X className="h-3 w-3" />
                )}
              </button>
            </span>
          ))}
          {categories.length === 0 && (
            <p className="text-xs text-muted-foreground">暂无分类，添加订阅时会自动创建</p>
          )}
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入分类名称"
          className="nexus-input h-9 flex-1 px-3 text-sm"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!newName.trim() || isCreating}
          className="nexus-button-primary h-9 px-4 text-xs disabled:opacity-50"
        >
          {isCreating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : '添加'}
        </button>
      </div>
    </div>
  )
}
