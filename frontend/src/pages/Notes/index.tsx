import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notesApi } from './notes.api'
import type { FileTreeNode } from './notes.types'
import { NotesDesktopView } from './NotesDesktopView'
import { NotesMobileView } from './NotesMobileView'
import * as ConfirmDialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'

type EditorMode = 'edit' | 'preview' | 'split'

// NotesPage 编排文件树加载、文件内容读写、文件操作和 isDirty 状态管理。
// 桌面端和移动端共用同一套 query/mutation，仅视图层拆分。
export default function NotesPage() {
  const qc = useQueryClient()

  // === 本地状态 ===
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [isDirty, setIsDirty] = useState(false)
  const [editorMode, setEditorMode] = useState<EditorMode>('edit')
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())
  // 删除确认弹窗
  const [deleteTarget, setDeleteTarget] = useState<FileTreeNode | null>(null)

  // === 文件树查询 ===
  const treeQuery = useQuery({
    queryKey: ['notes-tree'],
    queryFn: () => notesApi.getTree(),
  })
  const tree = treeQuery.data?.data?.data ?? []
  const treeError = treeQuery.data?.data?.success === false
    ? (treeQuery.data.data.message ?? '加载失败')
    : treeQuery.isError ? '加载文件树失败' : null

  // === 读取文件内容 ===
  const loadFileMutation = useMutation({
    mutationFn: (path: string) => notesApi.readFile(path),
    onSuccess: (res) => {
      const data = res.data?.data
      if (data) {
        setContent(data.content)
        setIsDirty(false)
      }
    },
  })

  // === 保存文件 ===
  const saveMutation = useMutation({
    mutationFn: ({ path, content }: { path: string; content: string }) =>
      notesApi.saveFile(path, content),
    onSuccess: () => {
      setIsDirty(false)
      qc.invalidateQueries({ queryKey: ['notes-tree'] })
    },
  })

  // === 新建文件 ===
  const createFileMutation = useMutation({
    mutationFn: (path: string) => notesApi.createFile(path),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes-tree'] }),
  })

  // === 新建文件夹 ===
  const createFolderMutation = useMutation({
    mutationFn: (path: string) => notesApi.createFolder(path),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes-tree'] }),
  })

  // === 重命名 ===
  const renameMutation = useMutation({
    mutationFn: ({ oldPath, newPath }: { oldPath: string; newPath: string }) =>
      notesApi.rename(oldPath, newPath),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes-tree'] }),
  })

  // === 删除文件/文件夹 ===
  const deleteMutation = useMutation({
    mutationFn: (node: FileTreeNode) =>
      node.type === 'folder' ? notesApi.deleteFolder(node.path) : notesApi.deleteFile(node.path),
    onSuccess: () => {
      // 删除的是当前选中文件时清空编辑器
      if (deleteTarget && selectedPath === deleteTarget.path) {
        setSelectedPath(null)
        setContent('')
        setIsDirty(false)
      }
      setDeleteTarget(null)
      qc.invalidateQueries({ queryKey: ['notes-tree'] })
    },
  })

  // === 事件处理 ===

  /** 选中文件：加载内容到编辑器 */
  const handleSelectFile = useCallback((node: FileTreeNode) => {
    if (node.path === selectedPath) return
    setSelectedPath(node.path)
    loadFileMutation.mutate(node.path)
  }, [selectedPath, loadFileMutation])

  /** 文件夹展开/折叠切换 */
  const handleToggleFolder = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  /** 内容修改：标记为 dirty */
  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent)
    setIsDirty(true)
  }, [])

  /** 保存当前文件 */
  const handleSave = useCallback(() => {
    if (!selectedPath) return
    saveMutation.mutate({ path: selectedPath, content })
  }, [selectedPath, content, saveMutation])

  /** 新建文件：在 vault 根或当前选中目录下创建 */
  const handleCreateFile = useCallback((name: string) => {
    // 基于 selectedPath 推断父目录：选中文件时在其同级创建，否则在根目录创建
    const parentDir = selectedPath ? selectedPath.substring(0, selectedPath.lastIndexOf('/')) : ''
    const fullPath = parentDir ? `${parentDir}/${name}` : name
    createFileMutation.mutate(fullPath)
  }, [selectedPath, createFileMutation])

  /** 新建文件夹 */
  const handleCreateFolder = useCallback((name: string) => {
    const parentDir = selectedPath ? selectedPath.substring(0, selectedPath.lastIndexOf('/')) : ''
    const fullPath = parentDir ? `${parentDir}/${name}` : name
    createFolderMutation.mutate(fullPath)
  }, [selectedPath, createFolderMutation])

  /** 重命名：基于原路径替换最后一段 */
  const handleRename = useCallback((node: FileTreeNode, newName: string) => {
    const lastSlash = node.path.lastIndexOf('/')
    const parentDir = lastSlash > 0 ? node.path.substring(0, lastSlash) : ''
    const newPath = parentDir ? `${parentDir}/${newName}` : newName
    renameMutation.mutate({ oldPath: node.path, newPath })
    // 重命名的是当前选中文件时更新 selectedPath
    if (node.path === selectedPath) {
      setSelectedPath(newPath)
    }
  }, [selectedPath, renameMutation])

  /** 触发删除确认弹窗 */
  const handleDelete = useCallback((node: FileTreeNode) => {
    setDeleteTarget(node)
  }, [])

  /** 确认删除 */
  const handleConfirmDelete = useCallback(() => {
    if (deleteTarget) deleteMutation.mutate(deleteTarget)
  }, [deleteTarget, deleteMutation])

  // === 共享视图 Props ===
  const sharedProps = {
    tree,
    selectedPath,
    content,
    isDirty,
    isSaving: saveMutation.isPending,
    editorMode,
    expandedPaths,
    treeLoading: treeQuery.isLoading,
    treeError,
    onContentChange: handleContentChange,
    onSave: handleSave,
    onModeChange: setEditorMode,
    onToggleFolder: handleToggleFolder,
    onSelectFile: handleSelectFile,
    onCreateFile: handleCreateFile,
    onCreateFolder: handleCreateFolder,
    onRename: handleRename,
    onDelete: handleDelete,
  }

  return (
    <>
      <NotesDesktopView {...sharedProps} />
      <NotesMobileView {...sharedProps} />

      {/* 删除二次确认弹窗 */}
      <ConfirmDialog.Root open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <ConfirmDialog.Portal>
          <ConfirmDialog.Overlay className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" />
          <ConfirmDialog.Content className="nexus-surface fixed inset-x-0 bottom-0 top-auto z-50 w-full rounded-b-none rounded-t-2xl p-3 sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:w-[calc(100vw-2rem)] sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg sm:p-4">
            <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-muted-foreground/25 sm:hidden" />
            <div className="flex items-center justify-between gap-3">
              <ConfirmDialog.Title className="text-sm font-black sm:text-base sm:font-semibold">
                确认删除
              </ConfirmDialog.Title>
              <ConfirmDialog.Close asChild>
                <button type="button" className="nexus-button-utility hidden h-9 w-9 text-muted-foreground sm:inline-flex" aria-label="关闭">
                  <X className="h-4 w-4" />
                </button>
              </ConfirmDialog.Close>
            </div>
            <div className="mt-3 space-y-2 sm:mt-4">
              <p className="text-sm text-foreground">
                确定要删除 <span className="font-bold">{deleteTarget?.name}</span> 吗？
              </p>
              {deleteTarget?.type === 'folder' && (
                <p className="rounded-lg border border-destructive/30 bg-destructive-soft px-3 py-2 text-xs text-destructive">
                  ⚠️ 此操作将删除文件夹内的所有文件和子文件夹，且不可恢复。
                </p>
              )}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 border-t pt-3 sm:mt-5 sm:flex sm:flex-row sm:items-center sm:justify-end sm:pt-4">
              <ConfirmDialog.Close asChild>
                <button type="button" className="nexus-button-utility h-10 px-3 text-sm">取消</button>
              </ConfirmDialog.Close>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleteMutation.isPending}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-destructive px-4 text-sm font-bold text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50"
              >
                {deleteMutation.isPending ? '删除中…' : '确认删除'}
              </button>
            </div>
          </ConfirmDialog.Content>
        </ConfirmDialog.Portal>
      </ConfirmDialog.Root>
    </>
  )
}
