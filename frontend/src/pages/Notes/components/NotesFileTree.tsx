import { useState, useMemo } from 'react'
import { FilePlus, FolderPlus, Search, FileText } from 'lucide-react'
import type { FileTreeNode } from '../notes.types'
import { FileTreeNodeComponent } from './FileTreeNode'
import { cn } from '../../../lib/utils'

type NotesFileTreeProps = {
  tree: FileTreeNode[]
  selectedPath: string | null
  expandedPaths: Set<string>
  onToggleFolder: (path: string) => void
  onSelectFile: (node: FileTreeNode) => void
  onRename: (node: FileTreeNode) => void
  onDelete: (node: FileTreeNode) => void
  onCreateFile: () => void
  onCreateFolder: () => void
}

// NotesFileTree 展示 vault 文件树，顶部含搜索框和新建按钮。
// 搜索时将树扁平化过滤（按文件名包含匹配），展示为无层级列表，更简单直观。
export function NotesFileTree({
  tree,
  selectedPath,
  expandedPaths,
  onToggleFolder,
  onSelectFile,
  onRename,
  onDelete,
  onCreateFile,
  onCreateFolder,
}: NotesFileTreeProps) {
  const [search, setSearch] = useState('')

  // 搜索时扁平化文件列表，只展示 .md 文件（不展示文件夹）
  const flatFiles = useMemo(() => {
    if (!search.trim()) return null
    const result: FileTreeNode[] = []
    const walk = (nodes: FileTreeNode[]) => {
      for (const n of nodes) {
        if (n.type === 'file' && n.name.toLowerCase().includes(search.toLowerCase())) {
          result.push(n)
        }
        if (n.children) walk(n.children)
      }
    }
    walk(tree)
    return result
  }, [tree, search])

  return (
    <div className="flex h-full flex-col">
      {/* 顶部工具栏：搜索 + 新建按钮 */}
      <div className="border-b p-2 space-y-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            placeholder="搜索文件…"
            onChange={(e) => setSearch(e.target.value)}
            className="nexus-input h-8 w-full pl-7 pr-2 text-xs"
          />
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={onCreateFile}
            className="nexus-button-utility inline-flex flex-1 items-center justify-center gap-1 px-2 py-1.5 text-xs"
          >
            <FilePlus className="h-3.5 w-3.5" /> 文件
          </button>
          <button
            type="button"
            onClick={onCreateFolder}
            className="nexus-button-utility inline-flex flex-1 items-center justify-center gap-1 px-2 py-1.5 text-xs"
          >
            <FolderPlus className="h-3.5 w-3.5" /> 文件夹
          </button>
        </div>
      </div>

      {/* 文件树/搜索结果 */}
      <div className="flex-1 overflow-y-auto py-1">
        {flatFiles ? (
          // 搜索模式：扁平化文件列表
          flatFiles.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">无匹配文件</p>
          ) : (
            flatFiles.map((node) => (
              <div
                key={node.path}
                onClick={() => onSelectFile(node)}
                className={cn(
                  'flex min-h-8 cursor-pointer items-center gap-1 rounded-md px-2 text-sm transition-colors',
                  selectedPath === node.path
                    ? 'bg-primary/10 text-primary font-bold'
                    : 'text-foreground hover:bg-accent',
                )}
              >
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{node.name}</span>
              </div>
            ))
          )
        ) : (
          // 正常模式：递归树
          tree.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">vault 为空</p>
          ) : (
            tree.map((node) => (
              <FileTreeNodeComponent
                key={node.path}
                node={node}
                level={0}
                selectedPath={selectedPath}
                expandedPaths={expandedPaths}
                onToggleFolder={onToggleFolder}
                onSelectFile={onSelectFile}
                onRename={onRename}
                onDelete={onDelete}
              />
            ))
          )
        )}
      </div>
    </div>
  )
}
