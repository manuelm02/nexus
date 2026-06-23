import { Check, X } from 'lucide-react'
import type { AgentSuggestion, SuggestionType, SuggestionStatus } from '../../../types/mindbank.types'
import { SUGGESTION_TYPE_LABELS, SUGGESTION_TYPE_COLORS } from '../../../types/mindbank.types'

// SuggestionCard 展示 Agent 巡检建议卡片，包含类型标签、问题描述、涉及笔记、建议操作及采纳/忽略按钮。
export function SuggestionCard({
  suggestion,
  onApprove,
  onIgnore,
  isApproving,
  isIgnoring,
}: {
  suggestion: AgentSuggestion
  onApprove: () => void
  onIgnore: () => void
  isApproving: boolean
  isIgnoring: boolean
}) {
  const type = suggestion.suggestionType as SuggestionType
  const status = suggestion.status as SuggestionStatus
  const affected = parseStringArray(suggestion.affectedNotes)
  const action = parseJsonString(suggestion.proposedAction)

  return (
    <div className="nexus-surface p-4 space-y-2">
      {/* 顶行：类型 chip + 状态 badge */}
      <div className="flex items-center gap-2">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${SUGGESTION_TYPE_COLORS[type] ?? 'bg-muted text-muted-foreground'}`}>
          {SUGGESTION_TYPE_LABELS[type] ?? type}
        </span>
        <StatusBadge status={status} />
      </div>

      {/* 问题描述 */}
      <p className="text-sm leading-relaxed text-foreground">{suggestion.description}</p>

      {/* 涉及笔记列表 */}
      {affected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {affected.map((name, i) => (
            <span key={i} className="rounded border border-border bg-muted/30 px-2 py-0.5 text-xs text-muted-foreground">
              {name}
            </span>
          ))}
        </div>
      )}

      {/* 建议操作 */}
      {action && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          <span className="font-bold">建议操作：</span>
          {action}
        </p>
      )}

      {/* 操作按钮：仅 pending 状态展示 */}
      {status === 'pending' && (
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onApprove}
            disabled={isApproving || isIgnoring}
            className="nexus-button-primary inline-flex h-8 items-center gap-1 px-3 text-xs font-bold disabled:opacity-50"
          >
            <Check className="h-3.5 w-3.5" />
            采纳
          </button>
          <button
            type="button"
            onClick={onIgnore}
            disabled={isApproving || isIgnoring}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-card px-3 text-xs font-bold text-muted-foreground hover:bg-accent disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" />
            忽略
          </button>
        </div>
      )}
    </div>
  )
}

/** 状态 badge 组件 */
function StatusBadge({ status }: { status: SuggestionStatus }) {
  const styles: Record<SuggestionStatus, string> = {
    pending: 'bg-muted text-muted-foreground',
    accepted: 'bg-green-500/15 text-green-600 dark:text-green-500',
    ignored: 'bg-gray-500/10 text-gray-500 line-through',
  }
  const labels: Record<SuggestionStatus, string> = {
    pending: '待审批',
    accepted: '已采纳',
    ignored: '已忽略',
  }
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}

/** 解析 JSON 字符串为字符串数组，容错处理 */
function parseStringArray(json: string | null | undefined): string[] {
  if (!json) return []
  try {
    const parsed = JSON.parse(json)
    if (Array.isArray(parsed)) return parsed.map(String)
    return [String(parsed)]
  } catch {
    return []
  }
}

/** 解析 JSON 字符串为可读文本，容错处理 */
function parseJsonString(json: string | null | undefined): string {
  if (!json) return ''
  try {
    const parsed = JSON.parse(json)
    return typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2)
  } catch {
    return json
  }
}
