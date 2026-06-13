import { useState } from 'react'
import { Search, Plus, Trash2, Archive, ArchiveRestore, Eye, EyeOff, Tag, ExternalLink } from 'lucide-react'
import { cn, formatRelative } from '../../../lib/utils'
import type { Bookmark, Paginated } from '../../../types/domain.types'

export type BookmarkPanelProps = {
  bookmarks: Paginated<Bookmark> | undefined
  isLoading: boolean
  isError: boolean
  queryParams: { q?: string; tag?: string; archived?: boolean; unread?: boolean; page: number; size: number }
  onQueryChange: (params: Partial<BookmarkPanelProps['queryParams']>) => void
  onCreate: (data: { url: string; title?: string; description?: string; notes?: string; tags?: string[] }) => void
  onUpdate: (id: string, data: Partial<Bookmark>) => void
  onDelete: (id: string) => void
  isCreating: boolean
  createError?: string
  hideCreate?: boolean
}

// 书签面板：快速保存表单 + 搜索筛选 + 卡片列表。桌面端和移动端共享此组件。
export function BookmarkPanel({
  bookmarks,
  isLoading,
  isError,
  queryParams,
  onQueryChange,
  onCreate,
  onUpdate,
  onDelete,
  isCreating,
  createError,
  hideCreate,
}: BookmarkPanelProps) {
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const items = bookmarks?.records ?? []

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return
    const tags = tagInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    onCreate({ url: url.trim(), title: title.trim() || undefined, tags: tags.length > 0 ? tags : undefined })
    setUrl('')
    setTitle('')
    setTagInput('')
    setShowCreateForm(false)
  }

  const handleDelete = (id: string) => {
    onDelete(id)
    setDeleteTarget(null)
  }

  return (
    <div className="space-y-3">
      {/* 快速创建表单 */}
      {!hideCreate && (
      <div className="rounded-lg border bg-card p-3 shadow-[var(--shadow-xs)]">
        {!showCreateForm ? (
          <button
            type="button"
            onClick={() => setShowCreateForm(true)}
            className="flex w-full items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="h-4 w-4" />
            添加书签
          </button>
        ) : (
          <form onSubmit={handleCreate} className="space-y-2">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="URL（必填，以 http:// 或 https:// 开头）"
              className="nexus-input w-full px-3 py-1.5 text-sm"
              autoFocus
            />
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="标题（可选，留空则用域名）"
              className="nexus-input w-full px-3 py-1.5 text-sm"
            />
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="标签，逗号分隔"
              className="nexus-input w-full px-3 py-1.5 text-sm"
            />
            {createError && (
              <p className="text-xs text-destructive">{createError}</p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="nexus-button-utility px-3 py-1.5 text-xs"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={!url.trim() || isCreating}
                className="nexus-button-primary px-3 py-1.5 text-xs"
              >
                保存
              </button>
            </div>
          </form>
        )}
      </div>
      )}

      {/* 搜索和筛选栏 */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[140px]">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={queryParams.q ?? ''}
            onChange={(e) => onQueryChange({ q: e.target.value || undefined, page: 1 })}
            placeholder="搜索标题、URL、描述…"
            className="nexus-input w-full pl-8 pr-3 py-1.5 text-sm"
          />
        </div>
        <FilterButton
          active={queryParams.archived === false && queryParams.unread === undefined}
          onClick={() => onQueryChange({ archived: false, unread: undefined, page: 1 })}
        >
          全部
        </FilterButton>
        <FilterButton
          active={queryParams.unread === true}
          onClick={() => onQueryChange({ unread: true, archived: false, page: 1 })}
        >
          未读
        </FilterButton>
        <FilterButton
          active={queryParams.archived === true}
          onClick={() => onQueryChange({ archived: true, unread: undefined, page: 1 })}
        >
          归档
        </FilterButton>
      </div>

      {/* 列表 */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground py-4">加载中…</p>
      ) : isError ? (
        <p className="text-sm text-destructive py-4">书签加载失败</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">暂无书签</p>
      ) : (
        <div className="space-y-2">
          {items.map((b) => (
            <BookmarkCard
              key={b.id}
              bookmark={b}
              onToggleUnread={() => onUpdate(b.id, { unread: !b.unread })}
              onToggleArchived={() => onUpdate(b.id, { archived: !b.archived })}
              onDelete={() => setDeleteTarget(b.id)}
              deleteTarget={deleteTarget}
              onConfirmDelete={handleDelete}
              onCancelDelete={() => setDeleteTarget(null)}
            />
          ))}
          {/* 分页 */}
          {bookmarks && bookmarks.pages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-muted-foreground">共 {bookmarks.total} 条</span>
              <div className="flex gap-1">
                <button
                  onClick={() => onQueryChange({ page: queryParams.page - 1 })}
                  disabled={queryParams.page <= 1}
                  className="nexus-button-utility px-2 py-1 text-xs disabled:opacity-40"
                >
                  上一页
                </button>
                <button
                  onClick={() => onQueryChange({ page: queryParams.page + 1 })}
                  disabled={queryParams.page >= bookmarks.pages}
                  className="nexus-button-utility px-2 py-1 text-xs disabled:opacity-40"
                >
                  下一页
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 删除确认弹层 */}
    </div>
  )
}

/** 筛选按钮 */
function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
        active
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

/** 书签卡片 */
function BookmarkCard({
  bookmark: b,
  onToggleUnread,
  onToggleArchived,
  onDelete,
  deleteTarget,
  onConfirmDelete,
  onCancelDelete,
}: {
  bookmark: Bookmark
  onToggleUnread: () => void
  onToggleArchived: () => void
  onDelete: () => void
  deleteTarget: string | null
  onConfirmDelete: (id: string) => void
  onCancelDelete: () => void
}) {
  const isConfirming = deleteTarget === b.id

  return (
    <div
      className={cn(
        'group relative rounded-lg border bg-card p-3 shadow-[var(--shadow-xs)] transition-colors',
        b.unread && 'border-l-2 border-l-primary',
      )}
    >
      {isConfirming ? (
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-destructive">确认删除？</span>
          <div className="flex gap-1.5">
            <button onClick={onCancelDelete} className="nexus-button-utility px-2 py-1 text-xs">取消</button>
            <button onClick={() => onConfirmDelete(b.id)} className="rounded-md bg-destructive px-2 py-1 text-xs font-semibold text-destructive-foreground hover:bg-destructive/90">删除</button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <a
                  href={b.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-foreground hover:text-primary truncate"
                >
                  {b.title || b.domain}
                </a>
                <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
              </div>
              {b.domain && (
                <p className="mt-0.5 text-xs text-muted-foreground truncate">{b.domain}</p>
              )}
              {b.description && (
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{b.description}</p>
              )}
            </div>
            {/* 操作按钮 — 桌面端 hover 显示，移动端始终可见 */}
            <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity md:opacity-0">
              <IconBtn onClick={onToggleUnread} title={b.unread ? '标记已读' : '标记未读'}>
                {b.unread ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </IconBtn>
              <IconBtn onClick={onToggleArchived} title={b.archived ? '取消归档' : '归档'}>
                {b.archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
              </IconBtn>
              <IconBtn onClick={onDelete} title="删除" destructive>
                <Trash2 className="h-3.5 w-3.5" />
              </IconBtn>
            </div>
          </div>
          {/* 标签 */}
          {b.tagNames.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {b.tagNames.map((t) => (
                <span key={t} className="inline-flex items-center gap-0.5 rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">
                  <Tag className="h-2.5 w-2.5" />
                  {t}
                </span>
              ))}
            </div>
          )}
          {/* 底部元数据 */}
          <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
            {b.unread && <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">未读</span>}
            {b.archived && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">已归档</span>}
            <span>{formatRelative(b.createdAt)}</span>
          </div>
        </>
      )}
    </div>
  )
}

/** 图标操作按钮 */
function IconBtn({
  onClick,
  title,
  destructive,
  children,
}: {
  onClick: () => void
  title: string
  destructive?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); onClick() }}
      title={title}
      aria-label={title}
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded-md transition-colors',
        destructive
          ? 'text-muted-foreground hover:bg-destructive/10 hover:text-destructive'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}
