import { useState } from 'react'
import { Save, Loader2, Sparkles, EyeOff, Trash2, FileText, ChevronDown } from 'lucide-react'
import { cn, formatLocalDateTimeForTitle } from '../../../../lib/utils'
import { TagPicker } from './TagPicker'
import type { NoteAnalyzeResponse, NoteTagEntry } from '../../../../types/domain.types'

export type NoteComposerProps = {
  title: string
  content: string
  selectedTags: string[]
  onTagsChange: (tags: string[]) => void
  availableTags: NoteTagEntry[]
  onTitleChange: (title: string) => void
  onContentChange: (content: string) => void
  onSave: () => void
  onAnalyze: () => void
  aiSuggestion: NoteAnalyzeResponse | null
  onApplySuggestion: () => void
  isSaving: boolean
  isAnalyzing: boolean
  aiAvailable: boolean
  onClearDraft: () => void
}

/** 标题模板：应用后只覆盖标题，不影响内容/标签 */
const TITLE_TEMPLATES = ['Quick Note', 'Memo', 'Meeting Notes', 'Idea'] as const

// 笔记编辑器：标题（含模板）+ 内容 + 标签选择（TagPicker，上限 1 个）+ AI 整理 + 保存。
// kind 已由外层二级 Tab 固定，不再提供类型切换控件。
export function NoteComposer({
  title,
  content,
  selectedTags,
  onTagsChange,
  availableTags,
  onTitleChange,
  onContentChange,
  onSave,
  onAnalyze,
  aiSuggestion,
  onApplySuggestion,
  isSaving,
  isAnalyzing,
  aiAvailable,
  onClearDraft,
}: NoteComposerProps) {
  const [showTemplates, setShowTemplates] = useState(false)

  const handleApplyTemplate = (label: string) => {
    onTitleChange(`${label} - ${formatLocalDateTimeForTitle()}`)
    setShowTemplates(false)
  }

  const handleClear = () => {
    if (title.trim() || content.trim() || selectedTags.length > 0) {
      if (!window.confirm('清空当前草稿？')) return
    }
    onClearDraft()
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSave() }}
      className="space-y-3"
    >
      {/* 编辑区 */}
      <div className="rounded-lg border bg-card p-3 shadow-[var(--shadow-xs)] space-y-2">
        <div className="flex items-center gap-1.5">
          <input
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="标题（可选）"
            className="nexus-input w-full px-3 py-1.5 text-sm"
          />
          {/* 标题模板：应用后用「模板名 - 可读日期时间」覆盖标题，不影响正文/标签 */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setShowTemplates((v) => !v)}
              className="nexus-button-utility flex items-center gap-1 px-2.5 py-1.5 text-xs"
              title="使用标题模板"
            >
              <FileText className="h-3.5 w-3.5" />
              模板
              <ChevronDown className="h-3 w-3" />
            </button>
            {showTemplates && (
              <div className="absolute right-0 top-full z-10 mt-1 w-44 rounded-lg border bg-card p-1 shadow-[var(--shadow-xs)]">
                {TITLE_TEMPLATES.map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => handleApplyTemplate(label)}
                    className="block w-full rounded-md px-2 py-1.5 text-left text-xs text-foreground hover:bg-accent"
                  >
                    {label} - {formatLocalDateTimeForTitle()}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <textarea
          value={content}
          onChange={(e) => onContentChange(e.target.value)}
          placeholder="记下你的想法..."
          rows={6}
          className="nexus-input w-full px-3 py-2 text-sm resize-none"
        />

        {/* 标签区：从标签索引中选择，最多 1 个；留空时保存时由后端 AI 自动打标签；新标签只能通过 AI 建议引入 */}
        <div className="space-y-1">
          <p className="text-[11px] text-muted-foreground">标签（最多 1 个，留空时 AI 自动打标签）</p>
          <TagPicker availableTags={availableTags} selectedTags={selectedTags} onChange={onTagsChange} maxTags={1} />
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={handleClear}
            className="nexus-button-utility flex items-center gap-1.5 px-2.5 text-xs mr-auto"
          >
            <Trash2 className="h-3.5 w-3.5" />
            清空
          </button>

          {aiAvailable && (
            <button
              type="button"
              onClick={onAnalyze}
              disabled={!content.trim() || isAnalyzing}
              title="根据当前内容生成标题、标签和整理后的 Markdown"
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
              AI 整理
            </button>
          )}

          {!aiAvailable && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
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
              合并到当前笔记
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
