import { useMemo, useState } from 'react'
import { Plus, Pencil, Trash2, FolderOpen } from 'lucide-react'
import * as Popover from '@radix-ui/react-popover'
import { cn } from '../../../lib/utils'
import type { Workspace } from '../../../types/mindbank.types'

/**
 * WorkspaceList 桌面端左栏，按 domainTag 分组展示 Workspace。
 * 同一 domainTag 归入同一分组下，无 domainTag 的归入"未分组"分组。
 * 选中 workspace 高亮，hover 显示编辑/删除按钮（删除走 Popover 二次确认）。
 */
export function WorkspaceList({
  workspaces,
  selectedId,
  onSelect,
  onEdit,
  onDelete,
  onCreate,
  isLoading,
  isDeleting,
}: {
  workspaces: Workspace[]
  selectedId: number | null
  onSelect: (id: number) => void
  onEdit: (workspace: Workspace) => void
  onDelete: (id: number) => void
  onCreate: () => void
  isLoading: boolean
  isDeleting: boolean
}) {
  // 按 domainTag 分组；null/空字符串统一归入"未分组"
  const grouped = useMemo(() => {
    const map = new Map<string, Workspace[]>()
    for (const w of workspaces) {
      const key = (w.domainTag ?? '').trim() || '未分组'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(w)
    }
    return Array.from(map.entries())
  }, [workspaces])

  return (
    <div className="flex h-full flex-col">
      {/* 标题区 */}
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-1.5">
          <FolderOpen className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-black text-foreground">Workspaces</h2>
          <span className="text-[10px] text-muted-foreground">({workspaces.length})</span>
        </div>
      </div>

      {/* 列表 */}
      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">加载中…</p>
        ) : grouped.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs leading-5 text-muted-foreground">
            还没有 Workspace。
            <br />
            点击下方按钮创建第一个。
          </p>
        ) : (
          <div className="space-y-3">
            {grouped.map(([tag, items]) => (
              <div key={tag}>
                <p className="px-2 pb-1 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                  #{tag}
                </p>
                <ul className="space-y-0.5">
                  {items.map((w) => (
                    <li key={w.id}>
                      <WorkspaceRow
                        workspace={w}
                        selected={w.id === selectedId}
                        onSelect={() => onSelect(w.id)}
                        onEdit={() => onEdit(w)}
                        onDelete={() => onDelete(w.id)}
                        isDeleting={isDeleting}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 底部新建按钮 */}
      <div className="border-t border-border p-2">
        <button
          type="button"
          onClick={onCreate}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-card px-3 py-2.5 text-sm font-bold text-muted-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary"
        >
          <Plus className="h-3.5 w-3.5" />
          新建 Workspace
        </button>
      </div>
    </div>
  )
}

/**
 * WorkspaceRow 单个 workspace 列表项，hover 显示操作按钮，删除走 Popover 二次确认。
 */
function WorkspaceRow({
  workspace,
  selected,
  onSelect,
  onEdit,
  onDelete,
  isDeleting,
}: {
  workspace: Workspace
  selected: boolean
  onSelect: () => void
  onEdit: () => void
  onDelete: () => void
  isDeleting: boolean
}) {
  const [popoverOpen, setPopoverOpen] = useState(false)

  return (
    <div
      className={cn(
        'group relative flex items-center gap-2 rounded-md px-2 py-2 transition-colors',
        selected
          ? 'bg-primary/10 text-foreground'
          : 'text-foreground/80 hover:bg-accent',
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        className="min-w-0 flex-1 text-left"
      >
        <p className="truncate text-sm font-bold">{workspace.name}</p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          {workspace.documentCount} 个文档
        </p>
      </button>

      {/* hover 操作按钮组 */}
      <div
        className={cn(
          'flex shrink-0 items-center gap-0.5 transition-opacity',
          selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100',
        )}
      >
        <button
          type="button"
          onClick={onEdit}
          className="nexus-button-utility h-7 w-7 text-muted-foreground"
          aria-label="编辑"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <Popover.Root open={popoverOpen} onOpenChange={setPopoverOpen}>
          <Popover.Trigger asChild>
            <button
              type="button"
              className="nexus-button-utility h-7 w-7 text-muted-foreground hover:text-destructive"
              aria-label="删除"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              side="top"
              align="end"
              sideOffset={6}
              className="z-[80] w-[min(calc(100vw-2rem),18rem)] rounded-lg border bg-popover p-3 text-popover-foreground shadow-lg"
            >
              <p className="text-sm font-bold">确认删除 Workspace？</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                「{workspace.name}」的 DB 记录将被删除，AnythingLLM 中的工作空间和向量数据保留。
              </p>
              <div className="mt-3 flex justify-end gap-2">
                <Popover.Close asChild>
                  <button type="button" className="nexus-button-utility h-9 px-3 text-xs">取消</button>
                </Popover.Close>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => {
                    onDelete()
                    setPopoverOpen(false)
                  }}
                  className="inline-flex h-9 items-center justify-center rounded-md border border-destructive bg-destructive px-3 text-xs font-semibold text-destructive-foreground disabled:opacity-50"
                >
                  确认删除
                </button>
              </div>
              <Popover.Arrow className="fill-popover" />
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </div>
    </div>
  )
}
