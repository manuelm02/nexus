import { useState, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, FolderInput, Loader2 } from 'lucide-react'
import type { MindBankWorkspace } from '../crawl.types'

type ImportToMindbankProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaces: MindBankWorkspace[]
  workspacesLoading: boolean
  importing: boolean
  onConfirm: (workspaceId: number) => void
}

// ImportToMindbank 弹窗：选择目标 Workspace 后提交导入，触发 Pipeline 异步处理。
// 桌面端居中弹窗，移动端底部 sheet（与 SubscriptionFormDialog 响应式模式一致）。
export function ImportToMindbank({
  open,
  onOpenChange,
  workspaces,
  workspacesLoading,
  importing,
  onConfirm,
}: ImportToMindbankProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null)

  // 弹窗打开时重置选择
  useEffect(() => {
    if (open) setSelectedId(null)
  }, [open])

  const handleConfirm = () => {
    if (selectedId == null) return
    onConfirm(selectedId)
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" />
        <Dialog.Content className="nexus-surface fixed inset-x-0 bottom-0 top-auto z-50 max-h-[85dvh] w-full translate-x-0 translate-y-0 overflow-y-auto rounded-b-none rounded-t-2xl p-3 sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:w-[calc(100vw-2rem)] sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg sm:p-4">
          <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-muted-foreground/25 sm:hidden" />
          <div className="flex items-center justify-between gap-3">
            <Dialog.Title className="flex items-center gap-2 text-sm font-black sm:text-base sm:font-semibold">
              <FolderInput className="h-4 w-4" /> 导入到 Mindbank
            </Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" className="nexus-button-utility hidden h-9 w-9 text-muted-foreground sm:inline-flex" aria-label="关闭">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="mt-3 space-y-2 sm:mt-4">
            <p className="text-xs text-muted-foreground">选择目标 Workspace，导入后将自动触发 AI 处理流水线</p>

            {workspacesLoading && (
              <p className="flex items-center gap-1.5 py-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> 加载 Workspace…
              </p>
            )}

            {!workspacesLoading && workspaces.length === 0 && (
              <div className="rounded-lg border border-border bg-muted/20 p-4 text-center">
                <p className="text-sm font-bold text-muted-foreground">暂无 Workspace</p>
                <p className="mt-1 text-xs text-muted-foreground">请先在 Mindbank 页面创建 Workspace</p>
              </div>
            )}

            {!workspacesLoading && workspaces.length > 0 && (
              <ul className="max-h-[40dvh] space-y-1.5 overflow-y-auto">
                {workspaces.map((ws) => (
                  <li key={ws.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(ws.id)}
                      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                        selectedId === ws.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border bg-muted/20 hover:border-primary/40'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-foreground">{ws.name}</p>
                        {ws.domainTag && (
                          <p className="mt-0.5 text-xs text-muted-foreground">{ws.domainTag}</p>
                        )}
                      </div>
                      {selectedId === ws.id && (
                        <span className="shrink-0 text-xs font-black text-primary">✓</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 border-t pt-3 sm:mt-5 sm:flex sm:flex-row sm:items-center sm:justify-end sm:pt-4">
            <Dialog.Close asChild>
              <button type="button" className="nexus-button-utility h-10 px-3 text-sm">取消</button>
            </Dialog.Close>
            <button
              type="button"
              disabled={selectedId == null || importing || workspacesLoading}
              onClick={handleConfirm}
              className="nexus-button-primary inline-flex items-center justify-center gap-1.5 h-10 px-4 text-sm disabled:opacity-50"
            >
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderInput className="h-4 w-4" />}
              {importing ? '导入中…' : '确认导入'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
