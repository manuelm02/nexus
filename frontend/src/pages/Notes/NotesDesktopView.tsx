import { useState } from 'react'
import { FileText } from 'lucide-react'
import type { FileTreeNode } from './notes.types'
import { NotesFileTree } from './components/NotesFileTree'
import { NotesEditor } from './components/NotesEditor'
import { FileNameDialog, type FileNameDialogMode } from './components/FileNameDialog'
import { PageShell, PageHeader, EmptyState } from '@/components/shell'

type EditorMode = 'edit' | 'preview' | 'split'

type NotesDesktopViewProps = {
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

// NotesDesktopView 桌面端两列布局：左侧 280px 文件树 + 右侧编辑器，使用 PageShell list-detail。
export function NotesDesktopView(props: NotesDesktopViewProps) {
  const {
    tree, selectedPath, content, isDirty, isSaving, editorMode, expandedPaths,
    treeLoading, treeError,
    onContentChange, onSave, onModeChange, onToggleFolder, onSelectFile,
    onCreateFile, onCreateFolder, onRename, onDelete,
  } = props

  // 弹窗状态
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

  return (
    // wrapper 提供高度，使 PageShell list-detail 的两栏撑满视口（布局纪律：list-detail 必须有高度链）
    <div className="hidden h-full md:flex md:flex-col">
      <PageShell
        variant="list-detail"
        header={<PageHeader eyebrow="NOTES" title="Notes" subtitle="Markdown 文件树与本地笔记" />}
        list={
          // 文件树在框定面板内独立滚动；外框由 PageShell 统一提供，此处不再套 surface
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {treeLoading && <p className="p-2 text-sm text-muted-foreground">加载中…</p>}
            {treeError && <p className="p-2 text-sm text-destructive">{treeError}</p>}
            {!treeLoading && !treeError && (
              <NotesFileTree
                tree={tree}
                selectedPath={selectedPath}
                expandedPaths={expandedPaths}
                onToggleFolder={onToggleFolder}
                onSelectFile={onSelectFile}
                onRename={handleRename}
                onDelete={onDelete}
                onCreateFile={handleCreateFile}
                onCreateFolder={handleCreateFolder}
              />
            )}
          </div>
        }
      >
        {selectedPath ? (
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
        ) : (
          <EmptyState
            icon={FileText}
            title="选择左侧文件开始编辑"
            hint="从左侧文件树选择一个文件即可开始。"
          />
        )}
      </PageShell>

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
