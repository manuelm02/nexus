import { useState } from 'react'
import type { FileTreeNode } from './notes.types'
import { NotesFileTree } from './components/NotesFileTree'
import { NotesEditor } from './components/NotesEditor'
import { FileNameDialog, type FileNameDialogMode } from './components/FileNameDialog'

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

// NotesDesktopView 桌面端两列布局：左侧文件树（w-60），右侧编辑器填满剩余空间。
// 文件操作弹窗（新建/重命名）复用 FileNameDialog。
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
    <div className="hidden h-[calc(100vh-64px)] w-full md:flex">
      {/* 左侧文件树 */}
      <div className="w-60 shrink-0 border-r">
        {treeLoading && <p className="p-4 text-sm text-muted-foreground">加载中…</p>}
        {treeError && <p className="p-4 text-sm text-destructive">{treeError}</p>}
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

      {/* 右侧编辑器 */}
      <div className="min-w-0 flex-1 overflow-hidden">
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
