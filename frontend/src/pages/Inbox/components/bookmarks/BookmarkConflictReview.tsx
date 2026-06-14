import { ExternalLink, Sparkles } from 'lucide-react'
import { cn } from '../../../../lib/utils'
import type { ConflictPreviewItem } from '../../../../types/domain.types'

export type BookmarkConflictReviewProps = {
  conflictItem: ConflictPreviewItem
  onDecision: (action: 'update' | 'create' | 'skip') => void
}

// 冲突审阅组件：新书签 vs 已有书签对比卡片 + AI 裁决 + 用户决策按钮。
export function BookmarkConflictReview({
  conflictItem: item,
  onDecision,
}: BookmarkConflictReviewProps) {
  return (
    <div className="rounded-lg border bg-card p-3 shadow-[var(--shadow-xs)] space-y-3">
      {/* 双栏对比 */}
      <div className="grid grid-cols-2 gap-3">
        {/* 新书签 */}
        <div className="rounded-md border bg-muted/20 px-3 py-2.5 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">新书签</p>
          <p className="text-sm font-semibold text-foreground truncate">
            {item.title || '未命名'}
          </p>
          <p className="text-[11px] text-muted-foreground break-all line-clamp-2">
            {item.url}
          </p>
        </div>

        {/* 已有书签 */}
        <div className="rounded-md border bg-muted/20 px-3 py-2.5 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">已有</p>
          <a
            href={item.existingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-foreground hover:text-primary truncate inline-flex items-center gap-1"
          >
            {item.existingTitle || item.existingUrl}
            <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
          <p className="text-[11px] text-muted-foreground break-all line-clamp-2">
            {item.existingUrl}
          </p>
        </div>
      </div>

      {/* AI 裁决 */}
      {item.aiVerdict && (
        <div className={cn(
          'flex items-center gap-2 rounded-md px-3 py-2 text-xs',
          item.aiVerdict === 'same' && 'bg-yellow-500/10 text-yellow-600',
          item.aiVerdict === 'different' && 'bg-success-soft/50 text-success',
          item.aiVerdict === 'low_confidence' && 'bg-muted text-muted-foreground',
        )}>
          <Sparkles className="h-3.5 w-3.5 shrink-0" />
          <span className="font-semibold">
            {item.aiVerdict === 'same'
              ? 'AI 判断为相同内容，建议更新旧记录'
              : item.aiVerdict === 'different'
                ? 'AI 判断为不同内容，建议作为新书签'
                : 'AI 无法确定，请手动选择'}
          </span>
        </div>
      )}

      {/* 用户决策按钮 */}
      <div className="grid grid-cols-3 gap-2">
        {([
          { key: 'update', label: '更新旧记录', desc: '用新 URL/标题更新已有书签' },
          { key: 'create', label: '作为新书签', desc: '创建独立的新书签' },
          { key: 'skip', label: '跳过', desc: '不导入此项' },
        ] as const).map(({ key, label, desc }) => (
          <button
            key={key}
            type="button"
            onClick={() => onDecision(key)}
            className={cn(
              'rounded-md border px-3 py-2 text-center transition-colors',
              key === 'update' && 'hover:border-primary/40 hover:bg-primary/5',
              key === 'create' && 'hover:border-success/40 hover:bg-success-soft/30',
              key === 'skip' && 'hover:border-muted-foreground/30 hover:bg-muted',
            )}
          >
            <p className="text-xs font-bold text-foreground">{label}</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">{desc}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
