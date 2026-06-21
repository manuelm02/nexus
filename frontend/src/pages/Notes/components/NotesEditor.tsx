import { useEffect, useCallback } from 'react'
import MDEditor from '@uiw/react-md-editor'
import { Save, Eye, Pencil, Columns } from 'lucide-react'
import { cn } from '../../../lib/utils'

type EditorMode = 'edit' | 'preview' | 'split'

type NotesEditorProps = {
  selectedPath: string | null
  content: string
  isDirty: boolean
  isSaving: boolean
  mode: EditorMode
  onContentChange: (content: string) => void
  onSave: () => void
  onModeChange: (mode: EditorMode) => void
}

// NotesEditor 工具栏含文件路径面包屑、保存状态 chip、模式切换按钮，编辑区使用 @uiw/react-md-editor。
// Ctrl+S / Cmd+S 快捷键监听触发保存；未选中文件时居中展示空状态。
export function NotesEditor({
  selectedPath,
  content,
  isDirty,
  isSaving,
  mode,
  onContentChange,
  onSave,
  onModeChange,
}: NotesEditorProps) {
  // Ctrl+S / Cmd+S 快捷键触发保存，preventDefault 阻止浏览器默认保存对话框
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault()
      if (selectedPath && isDirty && !isSaving) {
        onSave()
      }
    }
  }, [selectedPath, isDirty, isSaving, onSave])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // 未选中文件时的空状态
  if (!selectedPath) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">选择左侧文件开始阅读或编辑</p>
      </div>
    )
  }

  // @uiw/react-md-editor 用 preview prop 控制模式：edit / preview / live（分栏）
  // 参考 Context.d.ts: PreviewType = 'live' | 'edit' | 'preview'
  const editorPreview = mode === 'split' ? 'live' : mode

  return (
    <div className="flex h-full flex-col">
      {/* 工具栏 */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b px-3">
        {/* 左侧：文件路径面包屑 */}
        <div className="min-w-0 flex-1">
          <span className="truncate text-xs text-muted-foreground">{selectedPath}</span>
        </div>

        {/* 右侧：保存状态 + 模式切换 + 保存按钮 */}
        <div className="flex shrink-0 items-center gap-2">
          {/* 保存状态 chip */}
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-bold',
              isDirty ? 'bg-warning-soft text-warning' : 'bg-success-soft text-success',
            )}
          >
            {isSaving ? '保存中…' : isDirty ? '未保存' : '已保存'}
          </span>

          {/* 模式切换按钮组 */}
          <div className="hidden items-center gap-0.5 rounded-md border bg-muted/30 p-0.5 sm:flex">
            <ModeButton active={mode === 'edit'} onClick={() => onModeChange('edit')} icon={<Pencil className="h-3.5 w-3.5" />} label="编辑" />
            <ModeButton active={mode === 'preview'} onClick={() => onModeChange('preview')} icon={<Eye className="h-3.5 w-3.5" />} label="预览" />
            <ModeButton active={mode === 'split'} onClick={() => onModeChange('split')} icon={<Columns className="h-3.5 w-3.5" />} label="分栏" />
          </div>

          {/* 保存按钮 */}
          <button
            type="button"
            onClick={onSave}
            disabled={!isDirty || isSaving}
            className="nexus-button-primary inline-flex items-center gap-1 px-2.5 py-1 text-xs disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            保存
          </button>
        </div>
      </div>

      {/* 编辑器区 */}
      <div className="min-h-0 flex-1" data-color-mode="light">
        <MDEditor
          value={content}
          onChange={(val) => onContentChange(val ?? '')}
          preview={editorPreview}
          height="100%"
          hideToolbar={mode === 'preview'}
        />
      </div>
    </div>
  )
}

/** 模式切换按钮 */
function ModeButton({ active, onClick, icon, label }: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-bold transition-colors',
        active ? 'bg-card text-foreground shadow-[var(--shadow-xs)]' : 'text-muted-foreground',
      )}
      title={label}
    >
      {icon}
    </button>
  )
}
