import { useState } from 'react'
import { Plus, Trash2, Eye, Play, CheckCircle2, Folder, Loader2 } from 'lucide-react'
import { cn } from '../../../../lib/utils'
import type { BookmarkSmartGroup, BookmarkSmartGroupRequest, MatchedBookmark } from '../../../../types/domain.types'

export type BookmarkSmartGroupPanelProps = {
  groups: BookmarkSmartGroup[]
  onCreate: (req: BookmarkSmartGroupRequest) => void
  onUpdate: (id: string, req: Partial<BookmarkSmartGroupRequest>) => void
  onDelete: (id: string) => void
  onPreview: (groupId: string) => void
  onApply: (bookmarkIds: string[], groupIds: string[]) => void
  isAiAvailable: boolean
  isCreating?: boolean
  previewResult?: { groupId: string; matchedBookmarks: MatchedBookmark[] } | null
  isPreviewing?: boolean
}

// 智能分组管理面板：分组列表 + 创建新分组表单 + 测试匹配 + 应用分配。
export function BookmarkSmartGroupPanel({
  groups,
  onCreate,
  onUpdate,
  onDelete,
  onPreview,
  isCreating,
  previewResult,
  isPreviewing,
}: BookmarkSmartGroupPanelProps) {
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [matchMode, setMatchMode] = useState<'any_tag' | 'all_tags' | 'domain' | 'url_pattern'>('any_tag')
  const [matchValue, setMatchValue] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  const handleCreate = () => {
    if (!name.trim() || !matchValue.trim()) return
    onCreate({
      name: name.trim(),
      description: description.trim() || undefined,
      matchMode,
      matchValue: matchValue.trim(),
      orderIndex: groups.length,
      enabled: true,
    })
    setName('')
    setDescription('')
    setMatchValue('')
    setShowCreate(false)
  }

  return (
    <div className="space-y-3">
      {/* 分组列表 */}
      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">暂无智能分组</p>
      ) : (
        <div className="space-y-2">
          {groups.map((g) => (
            <div
              key={g.id}
              className="rounded-lg border bg-card p-3 shadow-[var(--shadow-xs)]"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Folder className="h-4 w-4 shrink-0 text-primary" />
                    <span className="text-sm font-bold text-foreground truncate">{g.name}</span>
                    {!g.enabled && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">已禁用</span>
                    )}
                  </div>
                  {g.description && (
                    <p className="mt-0.5 text-xs text-muted-foreground truncate">{g.description}</p>
                  )}
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    模式：<span className="font-medium">{matchModeLabel(g.matchMode)}</span>
                    {' · '}
                    匹配值：<span className="font-mono text-[10px]">{g.matchValue}</span>
                    {' · '}
                    书签数：<span className="font-semibold">{g.bookmarkCount}</span>
                  </p>
                </div>

                {/* 操作按钮 */}
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => onPreview(g.id)}
                    disabled={isPreviewing}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
                    title="测试匹配"
                  >
                    {isPreviewing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdate(g.id, { enabled: !g.enabled })}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                    title={g.enabled ? '禁用' : '启用'}
                  >
                    <Eye className={cn('h-3.5 w-3.5', !g.enabled && 'opacity-40')} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(g.id)}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    title="删除"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* 删除确认 */}
              {deleteTarget === g.id && (
                <div className="mt-2 flex items-center justify-end gap-2 pt-2 border-t border-border">
                  <span className="text-xs text-destructive font-medium">确认删除此分组？</span>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(null)}
                    className="nexus-button-utility px-2 py-1 text-[10px]"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={() => { onDelete(g.id); setDeleteTarget(null) }}
                    className="rounded-md bg-destructive px-2 py-1 text-[10px] font-semibold text-destructive-foreground hover:bg-destructive/90"
                  >
                    删除
                  </button>
                </div>
              )}

              {/* 预览结果 */}
              {previewResult && previewResult.groupId === g.id && (
                <div className="mt-2 space-y-1 border-t border-border pt-2">
                  <p className="text-[11px] font-semibold text-muted-foreground">
                    匹配到 {previewResult.matchedBookmarks.length} 个书签
                  </p>
                  {previewResult.matchedBookmarks.slice(0, 10).map((b) => (
                    <div key={b.bookmarkId} className="flex items-center gap-1.5 text-xs">
                      <CheckCircle2 className={cn(
                        'h-3 w-3 shrink-0',
                        b.alreadyAssigned ? 'text-muted-foreground' : 'text-success',
                      )} />
                      <span className={cn('truncate', b.alreadyAssigned && 'text-muted-foreground')}>
                        {b.title || b.url}
                      </span>
                      {b.alreadyAssigned && (
                        <span className="text-[10px] text-muted-foreground shrink-0">已分配</span>
                      )}
                    </div>
                  ))}
                  {previewResult.matchedBookmarks.length > 10 && (
                    <p className="text-[10px] text-muted-foreground pl-4">
                      …还有 {previewResult.matchedBookmarks.length - 10} 个
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 创建新分组表单 */}
      {showCreate ? (
        <div className="rounded-lg border bg-card p-3 shadow-[var(--shadow-xs)] space-y-2">
          <p className="text-xs font-bold text-foreground">创建新分组</p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="分组名称"
            className="nexus-input w-full px-3 py-1.5 text-sm"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="描述（可选）"
            className="nexus-input w-full px-3 py-1.5 text-sm"
          />
          <div className="flex gap-2">
            <select
              value={matchMode}
              onChange={(e) => setMatchMode(e.target.value as typeof matchMode)}
              className="nexus-input flex-1 px-2 py-1.5 text-xs"
            >
              <option value="any_tag">任意标签匹配</option>
              <option value="all_tags">全部标签匹配</option>
              <option value="domain">域名匹配</option>
              <option value="url_pattern">URL 模式匹配</option>
            </select>
            <input
              value={matchValue}
              onChange={(e) => setMatchValue(e.target.value)}
              placeholder="匹配值"
              className="nexus-input flex-[2] px-3 py-1.5 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="nexus-button-utility px-3 py-1.5 text-xs"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={!name.trim() || !matchValue.trim() || isCreating}
              className="nexus-button-primary flex items-center gap-1.5 px-3 py-1.5 text-xs"
            >
              {isCreating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              创建
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed bg-card/50 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:border-input transition-colors"
        >
          <Plus className="h-4 w-4" />
          创建新分组
        </button>
      )}
    </div>
  )
}

/** 匹配模式的中文标签 */
function matchModeLabel(mode: string): string {
  switch (mode) {
    case 'any_tag': return '任意标签'
    case 'all_tags': return '全部标签'
    case 'domain': return '域名'
    case 'url_pattern': return 'URL 模式'
    default: return mode
  }
}
