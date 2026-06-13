import { useState } from 'react'
import { Sparkles, Circle, FileText, Tag, Folder, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '../../../../lib/utils'
import type { NoteAnalyzeResponse } from '../../../../types/domain.types'

export type NoteAiSuggestionPanelProps = {
  suggestion: NoteAnalyzeResponse
  onApply: () => void
  onDismiss: () => void
}

// 笔记 AI 建议面板：展示 AI 分析的标题/类型/标签/分类/清洗预览/行动项。
export function NoteAiSuggestionPanel({
  suggestion,
  onApply,
  onDismiss,
}: NoteAiSuggestionPanelProps) {
  const [showCleaned, setShowCleaned] = useState(false)

  const s = suggestion

  return (
    <div className="rounded-lg border bg-card p-3 shadow-[var(--shadow-xs)] space-y-3">
      {/* 头部 */}
      <div className="flex items-center gap-1.5">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-xs font-bold text-primary">AI 建议</span>
        {s.confidence && (
          <span className={cn(
            'rounded px-1.5 py-0.5 text-[10px] font-semibold',
            s.confidence === 'high' ? 'bg-success-soft/50 text-success' :
            s.confidence === 'medium' ? 'bg-primary/10 text-primary' :
            'bg-muted text-muted-foreground',
          )}>
            {s.confidence === 'high' ? '高置信度' : s.confidence === 'medium' ? '中置信度' : '低置信度'}
          </span>
        )}
      </div>

      {/* 建议标题 */}
      {s.suggestedTitle && (
        <div className="flex items-center gap-2 text-sm">
          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground">标题：</span>
          <span className="text-sm font-semibold text-foreground">{s.suggestedTitle}</span>
        </div>
      )}

      {/* 建议类型 */}
      {s.suggestedKind && (
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground">类型：</span>
          <span className="rounded bg-accent px-1.5 py-0.5 text-xs font-medium">
            {s.suggestedKind === 'quick_note' ? 'Quick Note' : 'Memo'}
          </span>
        </div>
      )}

      {/* 建议标签 */}
      {s.suggestedTags && s.suggestedTags.length > 0 && (
        <div className="flex items-start gap-2">
          <Tag className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <span className="text-xs text-muted-foreground shrink-0">标签：</span>
          <div className="flex flex-wrap gap-1">
            {s.suggestedTags.map((t) => (
              <span key={t} className="inline-flex items-center gap-0.5 rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 建议分类 / 文件夹 */}
      {(s.suggestedCategory || s.suggestedFolder) && (
        <div className="flex items-center gap-2">
          <Folder className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground">分类：</span>
          <span className="text-xs font-medium text-foreground">
            {[s.suggestedCategory, s.suggestedFolder].filter(Boolean).join(' / ')}
          </span>
        </div>
      )}

      {/* 清洗后 Markdown 预览 */}
      {s.cleanedMarkdown && (
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => setShowCleaned(!showCleaned)}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            {showCleaned ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            清洗后预览
          </button>
          {showCleaned && (
            <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-foreground whitespace-pre-wrap font-mono max-h-40 overflow-y-auto">
              {s.cleanedMarkdown}
            </div>
          )}
        </div>
      )}

      {/* 行动项 */}
      {s.actionItems && s.actionItems.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold text-muted-foreground">行动项</p>
          <div className="space-y-1">
            {s.actionItems.map((item, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <Circle className={cn(
                  'h-3.5 w-3.5 shrink-0 mt-0.5',
                  item.priority === 'high' ? 'text-destructive' :
                  item.priority === 'medium' ? 'text-yellow-600' :
                  'text-muted-foreground',
                )} />
                <span>{item.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
        <button
          type="button"
          onClick={onDismiss}
          className="nexus-button-utility px-3 py-1.5 text-xs"
        >
          忽略
        </button>
        <button
          type="button"
          onClick={onApply}
          className="nexus-button-primary flex items-center gap-1.5 px-3 py-1.5 text-xs"
        >
          <Sparkles className="h-3.5 w-3.5" />
          应用建议
        </button>
      </div>
    </div>
  )
}
