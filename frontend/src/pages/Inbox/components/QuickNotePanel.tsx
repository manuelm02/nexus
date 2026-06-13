import { useState } from 'react'
import { Send, Loader2, FileText, Check } from 'lucide-react'
import { cn } from '../../../lib/utils'
import type { QuickNoteResponse } from '../../../types/domain.types'
import { IntegrationEmptyState } from './IntegrationEmptyState'

export type QuickNotePanelProps = {
  obsidianConfigured: boolean
  onSave: (data: { content: string; title?: string; kind: 'quick_note' | 'memo'; tags?: string[] }) => void
  isSaving: boolean
  saveError?: string
  lastResult?: QuickNoteResponse | null
}

// 笔记面板：Quick Note / Memo 编辑器，写入 Obsidian Markdown。未配置时显示 scoped empty state。
export function QuickNotePanel({
  obsidianConfigured,
  onSave,
  isSaving,
  saveError,
  lastResult,
}: QuickNotePanelProps) {
  const [kind, setKind] = useState<'quick_note' | 'memo'>('quick_note')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [tagInput, setTagInput] = useState('')

  if (!obsidianConfigured) {
    return (
      <IntegrationEmptyState
        serviceName="Obsidian"
        description="请设置 OBSIDIAN_VAULT_PATH 环境变量以启用笔记功能"
      />
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return
    const tags = tagInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    onSave({
      content: content.trim(),
      title: title.trim() || undefined,
      kind,
      tags: tags.length > 0 ? tags : undefined,
    })
  }

  // 保存成功后清空输入
  if (lastResult && !isSaving) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 rounded-lg border bg-success-soft/50 px-4 py-3 text-sm">
          <Check className="h-4 w-4 text-success" />
          <span className="text-success font-medium">已保存</span>
        </div>
        <div className="rounded-lg border bg-card p-3 shadow-[var(--shadow-xs)]">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground break-all">{lastResult.relativePath}</span>
          </div>
        </div>
        <button
          onClick={() => {
            setContent('')
            setTitle('')
            setTagInput('')
            // parent should clear lastResult
          }}
          className="nexus-button-utility px-3 py-1.5 text-xs"
        >
          写新笔记
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {/* 类型切换 */}
      <div className="rounded-lg border bg-card p-3 shadow-[var(--shadow-xs)]">
        <div className="grid h-9 grid-cols-2 rounded-md bg-muted p-0.5">
          {([
            ['quick_note', 'Quick Note'],
            ['memo', 'Memo'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setKind(key)}
              className={cn(
                'rounded-sm text-xs font-medium transition-colors',
                kind === key
                  ? 'bg-card text-foreground shadow-[var(--shadow-xs)]'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 编辑器 */}
      <div className="rounded-lg border bg-card p-3 shadow-[var(--shadow-xs)] space-y-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="标题（可选）"
          className="nexus-input w-full px-3 py-1.5 text-sm"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="记下你的想法…"
          rows={4}
          className="nexus-input w-full px-3 py-2 text-sm resize-none"
        />
        <input
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          placeholder="标签，逗号分隔"
          className="nexus-input w-full px-3 py-1.5 text-sm"
        />
        {saveError && (
          <p className="text-xs text-destructive">{saveError}</p>
        )}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!content.trim() || isSaving}
            className="nexus-button-primary flex items-center gap-1.5 px-4 py-1.5 text-sm"
          >
            {isSaving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            保存到 Obsidian
          </button>
        </div>
      </div>
    </form>
  )
}
