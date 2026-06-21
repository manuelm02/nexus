import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Menu, X } from 'lucide-react'
import type { FileTreeNode } from './notes.types'
import { NotesFileTree } from './components/NotesFileTree'
import { NotesEditor } from './components/NotesEditor'
import { FileNameDialog, type FileNameDialogMode } from './components/FileNameDialog'

type EditorMode = 'edit' | 'preview' | 'split'

type NotesMobileViewProps = {
  tree: FileTreeNode[]
  selectedPath: string | null
  content: string
  isDirty: boolean
  isSaving: boolean
  editorMode: EditorMode
  expandedPaths: Set<string>
  treeLoading: boolean
  treeError: string | null
  onContentChange: (content: string) => void
  onSave: () => void
  onModeChange: (mode: EditorMode) => void
  onToggleFolder: (path: string) => void
  onSelectFile: (node: FileTreeNode) => void
  onCreateFile: (name: string) => void
  onCreateFolder: (name: string) => void
  onRename: (node: FileTreeNode, newName: string) => void
  onDelete: (node: FileTreeNode) => void
}

// NotesMobileView 移动端：编辑器全屏，顶部 Hamburger 按钮展开文件树底部 Sheet。
// 选中文件后自动关闭 Sheet，编辑器默认 preview 模式（由外部 editorMode 控制）。
export function NotesMobileView(props: NotesMobileViewProps) {
  const {
    tree, selectedPath, content, isDirty, isSaving, editorMode, expandedPaths,
    treeLoading, treeError,
    onContentChange, onSave, onModeChange, onToggleFolder, onSelectFile,
    onCreateFile, onCreateFolder, onRename, onDelete,
  } = props

  const [sheetOpen, setSheetOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<FileNameDialogMode | null>(null)
  const [renameNode, setRenameNode] = useState<FileTreeNode | null>(null)

  const handleCreateFile = () => {
    setRenameNode(null)
    setDialogMode('createFile')
  }
  const handleCreateFolder = () => {
    setRenameNode(null)
    setDialogMode('createFolder')
  }
  const handleRename = (node: FileTreeNode) => {
    setRenameNode(node)
    setDialogMode('rename')
  }

  const handleDialogConfirm = (name: string) => {
    if (dialogMode === 'createFile') onCreateFile(name)
    else if (dialogMode === 'createFolder') onCreateFolder(name)
    else if (dialogMode === 'rename' && renameNode) onRename(renameNode, name)
    setDialogMode(null)
    setRenameNode(null)
  }

  // 选中文件后关闭文件树 Sheet
  const handleSelectFile = (node: FileTreeNode) => {
    onSelectFile(node)
    setSheetOpen(false)
  }

  return (
    <div className="flex h-[calc(100vh-120px)] w-full flex-col md:hidden">
      {/* 顶部栏：Hamburger + 文件路径 */}
      <div className="flex h-10 shrink-0 items-center gap-2 border-b px-2">
        <Dialog.Root open={sheetOpen} onOpenChange={setSheetOpen}>
          <Dialog.Trigger asChild>
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
              aria-label="文件树"
            >
              <Menu className="h-4 w-4" />
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" />
            <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[70dvh] overflow-y-auto rounded-t-2xl border bg-card p-3">
              <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-muted-foreground/25" />
              <div className="flex items-center justify-between">
                <Dialog.Title className="text-sm font-black">文件树</Dialog.Title>
                <Dialog.Close asChild>
                  <button type="button" className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </Dialog.Close>
              </div>
              <div className="mt-2 max-h-[55dvh] overflow-y-auto">
                {treeLoading && <p className="p-4 text-sm text-muted-foreground">加载中…</p>}
                {treeError && <p className="p-4 text-sm text-destructive">{treeError}</p>}
                {!treeLoading && !treeError && (
                  <NotesFileTree
                    tree={tree}
                    selectedPath={selectedPath}
                    expandedPaths={expandedPaths}
                    onToggleFolder={onToggleFolder}
                    onSelectFile={handleSelectFile}
                    onRename={handleRename}
                    onDelete={onDelete}
                    onCreateFile={handleCreateFile}
                    onCreateFolder={handleCreateFolder}
                  />
                )}
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{selectedPath ?? '未选择文件'}</span>
      </div>

      {/* 编辑器 */}
      <div className="min-h-0 flex-1 overflow-hidden">
        <NotesEditor
          selectedPath={selectedPath}
          content={content}
          isDirty={isDirty}
          isSaving={isSaving}
          mode={editorMode}
          onContentChange={onContentChange}
          onSave={onSave}
          onModeChange={onModeChange}
        />
      </div>

      {/* 文件操作弹窗 */}
      <FileNameDialog
        open={dialogMode !== null}
        mode={dialogMode ?? 'createFile'}
        initialName={renameNode?.name}
        onOpenChange={(open) => { if (!open) { setDialogMode(null); setRenameNode(null) } }}
        onConfirm={handleDialogConfirm}
      />
    </div>
  )
}
