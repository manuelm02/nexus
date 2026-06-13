import { useState } from 'react'
import { Save, Sparkles, AlertTriangle, CheckCircle2, XCircle, Tag, Plus, X, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '../../../../lib/utils'
import type { BookmarkAnalyzeResponse } from '../../../../types/domain.types'

export type BookmarkAiReviewPanelProps = {
  analyzeResponse: BookmarkAnalyzeResponse | null
  editedTitle: string
  editedDescription: string
  editedTags: string[]
  onTitleChange: (title: string) => void
  onDescriptionChange: (desc: string) => void
  onAddTag: (tag: string) => void
  onRemoveTag: (tag: string) => void
  onConfirmSave: () => void
  onSaveRaw: () => void
  isSaving: boolean
}

// AI 分析结果面板：展示归一化 URL、建议标题/描述/标签/分组、冲突状态及最终操作。
export function BookmarkAiReviewPanel({
  analyzeResponse,
  editedTitle,
  editedDescription,
  editedTags,
  onTitleChange,
  onDescriptionChange,
  onAddTag,
  onRemoveTag,
  onConfirmSave,
  onSaveRaw,
  isSaving,
}: BookmarkAiReviewPanelProps) {
  const [tagInput, setTagInput] = useState('')
  const [showTracking, setShowTracking] = useState(false)

  if (!analyzeResponse) return null

  const r = analyzeResponse

  const handleAddTag = () => {
    const t = tagInput.trim()
    if (t && !editedTags.includes(t)) {
      onAddTag(t)
    }
    setTagInput('')
  }

  return (
    <div className="rounded-lg border bg-card p-3 shadow-[var(--shadow-xs)] space-y-3">
      {/* 头部：来自 AI */}
      <div className="flex items-center gap-1.5">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-xs font-bold text-primary">AI 分析结果</span>
        {r.confidence && (
          <span className={cn(
            'rounded px-1.5 py-0.5 text-[10px] font-semibold',
            r.confidence === 'high' ? 'bg-success-soft/50 text-success' :
            r.confidence === 'medium' ? 'bg-primary/10 text-primary' :
            'bg-muted text-muted-foreground',
          )}>
            {r.confidence === 'high' ? '高置信度' : r.confidence === 'medium' ? '中置信度' : '低置信度'}
          </span>
        )}
      </div>

      {/* 冲突警告 */}
      {r.duplicateStatus !== 'none' && (
        <div className={cn(
          'flex items-start gap-2 rounded-md px-3 py-2 text-xs',
          r.duplicateStatus === 'exact_duplicate'
            ? 'bg-destructive/10 text-destructive'
            : 'bg-yellow-500/10 text-yellow-600',
        )}>
          {r.duplicateStatus === 'exact_duplicate' ? (
            <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          )}
          <div className="min-w-0">
            <p className="font-semibold">
              {r.duplicateStatus === 'exact_duplicate' ? '已存在相同书签' : '可能存在相似书签'}
            </p>
            {r.conflictCandidate && (
              <a
                href={r.conflictCandidate.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-0.5 inline-flex items-center gap-1 text-inherit underline underline-offset-2 hover:opacity-80"
              >
                {r.conflictCandidate.title || r.conflictCandidate.domain || r.conflictCandidate.url}
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* 归一化 URL 对比 */}
      {r.normalizedUrl !== r.originalUrl && (
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => setShowTracking(!showTracking)}
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            {showTracking ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            归一化 URL（已移除追踪参数）
          </button>
          {showTracking && (
            <div className="space-y-1 pl-1">
              <div className="rounded-md bg-muted/50 px-2 py-1 text-[11px] text-muted-foreground break-all line-through">
                {r.originalUrl}
              </div>
              <div className="rounded-md bg-success-soft/30 px-2 py-1 text-[11px] text-foreground break-all">
                {r.normalizedUrl}
              </div>
              {r.trackingParamsRemoved.length > 0 && (
                <p className="text-[10px] text-muted-foreground pl-1">
                  已移除：{r.trackingParamsRemoved.join(', ')}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* 建议标题 */}
      <div className="space-y-1">
        <label className="text-[11px] font-semibold text-muted-foreground">标题</label>
        <input
          value={editedTitle}
          onChange={(e) => onTitleChange(e.target.value)}
          className="nexus-input w-full px-3 py-1.5 text-sm"
          placeholder={r.suggestedTitle || '输入标题'}
        />
        {r.suggestedTitle && editedTitle !== r.suggestedTitle && (
          <button
            type="button"
            onClick={() => onTitleChange(r.suggestedTitle!)}
            className="text-[10px] text-primary hover:underline"
          >
            使用建议标题
          </button>
        )}
      </div>

      {/* 建议描述 */}
      <div className="space-y-1">
        <label className="text-[11px] font-semibold text-muted-foreground">描述</label>
        <textarea
          value={editedDescription}
          onChange={(e) => onDescriptionChange(e.target.value)}
          rows={2}
          className="nexus-input w-full px-3 py-2 text-sm resize-none"
          placeholder={r.suggestedDescription || '输入描述'}
        />
        {r.suggestedDescription && editedDescription !== r.suggestedDescription && (
          <button
            type="button"
            onClick={() => onDescriptionChange(r.suggestedDescription!)}
            className="text-[10px] text-primary hover:underline"
          >
            使用建议描述
          </button>
        )}
      </div>

      {/* 建议标签 */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-muted-foreground">标签</label>
        <div className="flex flex-wrap gap-1">
          {editedTags.map((t) => (
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
          {r.suggestedTags?.filter((t) => !editedTags.includes(t)).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onAddTag(t)}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-primary/30 px-2 py-0.5 text-[11px] text-primary hover:bg-primary/5"
            >
              <Plus className="h-2.5 w-2.5" />
              {t}
            </button>
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

      {/* 智能分组建议 */}
      {r.matchedGroups.length > 0 && (
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-muted-foreground">匹配分组</label>
          <div className="flex flex-wrap gap-1.5">
            {r.matchedGroups.map((g) => (
              <span key={g.groupId} className="inline-flex items-center gap-1 rounded bg-primary/5 px-2 py-0.5 text-[11px] text-primary">
                <CheckCircle2 className="h-2.5 w-2.5" />
                {g.groupName}
                <span className="text-[10px] opacity-60">{g.matchReason}</span>
              </span>
            ))}
          </div>
        </div>
      )}
      {r.suggestedGroupName && (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Sparkles className="h-3 w-3 text-primary" />
          建议分组：<span className="font-semibold text-foreground">{r.suggestedGroupName}</span>
        </div>
      )}

      {/* 最终操作 */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
        <button
          type="button"
          onClick={onSaveRaw}
          disabled={isSaving}
          className="nexus-button-utility px-3 py-1.5 text-xs"
        >
          忽略建议直接保存
        </button>
        <button
          type="button"
          onClick={onConfirmSave}
          disabled={isSaving}
          className="nexus-button-primary flex items-center gap-1.5 px-3 py-1.5 text-xs"
        >
          {isSaving ? null : <Save className="h-3.5 w-3.5" />}
          确认保存
        </button>
      </div>
    </div>
  )
}
