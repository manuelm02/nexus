import { Plus, Search, Trash2, Pencil } from 'lucide-react'
import type { ChatConversation } from '../../types/domain.types'
import { cn } from '../../lib/utils'

type ChatSidebarProps = {
  conversations: ChatConversation[]
  activeId: string | null
  search: string
  isLoading: boolean
  onSearchChange: (value: string) => void
  onCreate: () => void
  onSelect: (conversation: ChatConversation) => void
  onDelete: (id: string) => void
  onRename: (conversation: ChatConversation) => void
}

// ChatSidebar 展示对话列表、搜索、新建与删除/重命名入口
export function ChatSidebar({
  conversations,
  activeId,
  search,
  isLoading,
  onSearchChange,
  onCreate,
  onSelect,
  onDelete,
  onRename,
}: ChatSidebarProps) {
  return (
    <aside className="hidden h-full w-64 flex-col border-r bg-card md:flex">
      <div className="flex items-center justify-between gap-2 border-b p-3">
        <h2 className="text-sm font-black text-muted-foreground">最近对话</h2>
        <button
          type="button"
          onClick={onCreate}
          className="nexus-button-primary h-8 gap-1 px-2.5 text-xs"
        >
          <Plus className="h-4 w-4" /> 新建
        </button>
      </div>

      <div className="border-b p-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="搜索对话"
            className="nexus-input h-9 w-full pl-8 text-xs"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <p className="p-2 text-xs text-muted-foreground">加载中…</p>
        ) : conversations.length === 0 ? (
          <p className="p-2 text-xs text-muted-foreground">暂无对话</p>
        ) : (
          <div className="space-y-1">
            {conversations.map((c) => (
              <div
                key={c.id}
                className={cn(
                  'group flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 text-xs font-semibold transition-colors',
                  activeId === c.id ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-accent',
                )}
                onClick={() => onSelect(c)}
              >
                <span className="truncate pr-2">{c.title}</span>
                <div className={cn('flex items-center gap-0.5 opacity-0 group-hover:opacity-100', activeId === c.id && 'opacity-100')}>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onRename(c) }}
                    className="rounded p-1 hover:bg-white/10"
                    aria-label="重命名"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onDelete(c.id) }}
                    className="rounded p-1 hover:bg-white/10"
                    aria-label="删除"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}
