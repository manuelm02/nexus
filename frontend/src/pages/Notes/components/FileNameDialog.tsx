import { useState, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'

export type FileNameDialogMode = 'createFile' | 'createFolder' | 'rename'

type FileNameDialogProps = {
  open: boolean
  mode: FileNameDialogMode
  /** 重命名时预填的当前名称 */
  initialName?: string
  onOpenChange: (open: boolean) => void
  onConfirm: (name: string) => void
}

// FileNameDialog 用于新建文件/文件夹和重命名操作。
// 新建文件时自动补全 .md 后缀（若用户未输入）；重命名时预填当前名称。
export function FileNameDialog({ open, mode, initialName, onOpenChange, onConfirm }: FileNameDialogProps) {
  const [name, setName] = useState('')

  // 弹窗打开时设置初始值：重命名预填当前名，新建时清空
  useEffect(() => {
    if (open) {
      setName(initialName ?? '')
    }
  }, [open, initialName])

  const titleMap: Record<FileNameDialogMode, string> = {
    createFile: '新建文件',
    createFolder: '新建文件夹',
    rename: '重命名',
  }

  const placeholderMap: Record<FileNameDialogMode, string> = {
    createFile: '文件名（无需 .md 后缀）',
    createFolder: '文件夹名',
    rename: '新名称',
  }

  const handleConfirm = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    // 新建文件时自动补全 .md 后缀，保持 vault 内文件一致性
    const finalName = mode === 'createFile' && !trimmed.endsWith('.md') ? trimmed + '.md' : trimmed
    onConfirm(finalName)
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" />
        <Dialog.Content className="nexus-surface fixed inset-x-0 bottom-0 top-auto z-50 w-full translate-x-0 translate-y-0 rounded-b-none rounded-t-2xl p-3 sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:w-[calc(100vw-2rem)] sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg sm:p-4">
          <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-muted-foreground/25 sm:hidden" />
          <div className="flex items-center justify-between gap-3">
            <Dialog.Title className="text-sm font-black sm:text-base sm:font-semibold">
              {titleMap[mode]}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" className="nexus-button-utility hidden h-9 w-9 text-muted-foreground sm:inline-flex" aria-label="关闭">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="mt-3 space-y-2 sm:mt-4">
            <input
              type="text"
              value={name}
              placeholder={placeholderMap[mode]}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
              autoFocus
              className="nexus-input h-10 w-full px-3 text-sm"
            />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 border-t pt-3 sm:mt-5 sm:flex sm:flex-row sm:items-center sm:justify-end sm:pt-4">
            <Dialog.Close asChild>
              <button type="button" className="nexus-button-utility h-10 px-3 text-sm">取消</button>
            </Dialog.Close>
            <button
              type="button"
              disabled={!name.trim()}
              onClick={handleConfirm}
              className="nexus-button-primary h-10 px-4 text-sm disabled:opacity-50"
            >
              确认
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
