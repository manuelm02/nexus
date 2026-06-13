import { useState } from 'react'
import { Save, Loader2, Sparkles, Tag, Plus, X, EyeOff } from 'lucide-react'
import { cn } from '../../../../lib/utils'
import type { NoteAnalyzeResponse } from '../../../../types/domain.types'

export type NoteComposerProps = {
  kind: 'quick_note' | 'memo'
  title: string
  content: string
  tags: string[]
  onKindChange: (kind: 'quick_note' | 'memo') => void
  onTitleChange: (title: string) => void
  onContentChange: (content: string) => void
  onAddTag: (tag: string) => void
  onRemoveTag: (tag: string) => void
  onSave: () => void
  onAnalyze: () => void
  aiSuggestion: NoteAnalyzeResponse | null
  onApplySuggestion: () => void
  isSaving: boolean
  isAnalyzing: boolean
  aiAvailable: boolean
}

// 笔记编辑器：类型分段控件 + 标题/内容 + 标签 + AI 建议按钮 + 保存操作。
export function NoteComposer({
  kind,
  title,
  content,
  tags,
  onKindChange,
  onTitleChange,
  onContentChange,
  onAddTag,
  onRemoveTag,
  onSave,
  onAnalyze,
  aiSuggestion,
  onApplySuggestion,
  isSaving,
  isAnalyzing,
  aiAvailable,
}: NoteComposerProps) {
  const [tagInput, setTagInput] = useState('')

  const handleAddTag = () => {
    const t = tagInput.trim()
    if (t && !tags.includes(t)) {
      onAddTag(t)
    }
    setTagInput('')
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSave() }}
      className="space-y-3"
    >
      {/* 类型切换分段控件 */}
      <div className="rounded-lg border bg-card p-3 shadow-[var(--shadow-xs)]">
        <div className="grid h-9 grid-cols-2 rounded-md bg-muted p-0.5">
          {([
            ['quick_note', 'Quick Note'],
            ['memo', 'Memo'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => onKindChange(key)}
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

      {/* 编辑区 */}
      <div className="rounded-lg border bg-card p-3 shadow-[var(--shadow-xs)] space-y-2">
        <input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="标题（可选）"
          className="nexus-input w-full px-3 py-1.5 text-sm"
        />
        <textarea
          value={content}
          onChange={(e) => onContentChange(e.target.value)}
          placeholder="记下你的想法…"
          rows={6}
          className="nexus-input w-full px-3 py-2 text-sm resize-none"
        />

        {/* 标签区 */}
        <div className="space-y-1.5">
          <div className="flex flex-wrap gap-1">
            {tags.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">
                <Tag className="h-2.5 w-2.5" />
                {t}
                <button
                  type="button"
                  onClick={() => onRemoveTag(t)}
                  className="ml-0.5 hover:text-destructive"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag() } }}
              placeholder="添加标签…"
              className="nexus-input flex-1 px-2.5 py-1 text-xs"
            />
            <button
              type="button"
              onClick={handleAddTag}
              disabled={!tagInput.trim()}
              className="flex h-8 w-8 items-center justify-center rounded-lg border text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center justify-end gap-2 pt-1">
          {aiAvailable && (
            <button
              type="button"
              onClick={onAnalyze}
              disabled={!content.trim() || isAnalyzing}
              className={cn(
                'flex items-center gap-1.5 h-9 md:h-8 rounded-lg border px-2.5 text-xs font-medium transition-colors',
                'text-muted-foreground hover:text-primary hover:border-primary/30 disabled:opacity-50',
              )}
            >
              {isAnalyzing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sparkles className="h-3.5 w-3.5" />
              )}
              AI 建议
            </button>
          )}

          {!aiAvailable && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground mr-auto">
              <EyeOff className="h-3 w-3" />
              AI 未启用
            </span>
          )}

          {aiSuggestion && (
            <button
              type="button"
              onClick={onApplySuggestion}
              className="nexus-button-primary flex items-center gap-1.5 px-3 py-1.5 text-xs"
            >
              <Sparkles className="h-3.5 w-3.5" />
              应用建议并保存
            </button>
          )}

          <button
            type="submit"
            disabled={!content.trim() || isSaving}
            className="nexus-button-primary flex items-center gap-1.5 px-3 py-1.5 text-xs"
          >
            {isSaving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            保存原文
          </button>
        </div>
      </div>
    </form>
  )
}
