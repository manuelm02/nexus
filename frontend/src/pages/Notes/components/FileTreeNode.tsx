import { useState } from 'react'
import { ChevronRight, ChevronDown, FileText, Folder, FolderOpen, Pencil, Trash2 } from 'lucide-react'
import type { FileTreeNode } from '../notes.types'
import { cn } from '../../../lib/utils'

type FileTreeNodeProps = {
  node: FileTreeNode
  level: number
  selectedPath: string | null
  expandedPaths: Set<string>
  onToggleFolder: (path: string) => void
  onSelectFile: (node: FileTreeNode) => void
  onRename: (node: FileTreeNode) => void
  onDelete: (node: FileTreeNode) => void
}

// FileTreeNode 递归渲染单个文件树节点：文件夹可展开/折叠，文件可选中加载到编辑器。
// 操作按钮 hover 时显示，点击触发重命名/删除，兼容桌面和移动端点击交互。
export function FileTreeNodeComponent({
  node,
  level,
  selectedPath,
  expandedPaths,
  onToggleFolder,
  onSelectFile,
  onRename,
  onDelete,
}: FileTreeNodeProps) {
  const [showActions, setShowActions] = useState(false)
  const isFolder = node.type === 'folder'
  const isExpanded = expandedPaths.has(node.path)
  const isSelected = selectedPath === node.path

  const handleClick = () => {
    if (isFolder) {
      onToggleFolder(node.path)
    } else {
      onSelectFile(node)
    }
  }

  return (
    <div>
      <div
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
        onClick={handleClick}
        className={cn(
          'group flex min-h-8 cursor-pointer items-center gap-1 rounded-md pr-1 text-sm transition-colors',
          isSelected ? 'bg-primary/10 text-primary font-bold' : 'text-foreground hover:bg-accent',
        )}
        style={{ paddingLeft: level * 12 + 8 }}
      >
        {/* 展开/折叠图标（文件夹才有） */}
        {isFolder ? (
          isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          )
        ) : (
          <span className="w-3.5 shrink-0" />
        )}

        {/* 文件/文件夹图标 */}
        {isFolder ? (
          isExpanded ? (
            <FolderOpen className="h-4 w-4 shrink-0 text-primary/70" />
          ) : (
            <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
          )
        ) : (
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}

        {/* 名称 */}
        <span className="min-w-0 flex-1 truncate">{node.name}</span>

        {/* 操作按钮（hover 显示） */}
        {showActions && (
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRename(node) }}
              className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
              title="重命名"
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDelete(node) }}
              className="flex h-6 w-6 items-center justify-center rounded text-destructive hover:bg-destructive/10"
              title="删除"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {/* 递归渲染子节点 */}
      {isFolder && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeNodeComponent
              key={child.path}
              node={child}
              level={level + 1}
              selectedPath={selectedPath}
              expandedPaths={expandedPaths}
              onToggleFolder={onToggleFolder}
              onSelectFile={onSelectFile}
              onRename={onRename}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}
