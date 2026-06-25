import { useState } from 'react'
import { Check, X, Loader2, CheckCircle } from 'lucide-react'
import type { AgentSuggestion, SuggestionType, SuggestionStatus, SuggestionExecuteResult } from '../../../types/mindbank.types'
import { SUGGESTION_TYPE_LABELS, SUGGESTION_TYPE_COLORS } from '../../../types/mindbank.types'

// SuggestionCard 展示 Agent 巡检建议卡片，包含类型标签、问题描述、涉及笔记、建议操作及采纳/忽略按钮。
// Phase 6-8：采纳按钮接入 MindBankSuggestionExecutor，支持执行中 loading、结果展示、错误重试和危险操作确认。
export function SuggestionCard({
  suggestion,
  onApprove,
  onIgnore,
  isIgnoring,
}: {
  suggestion: AgentSuggestion
  /** 异步采纳回调，返回执行结果 */
  onApprove: (id: number) => Promise<SuggestionExecuteResult>
  onIgnore: (id: number) => void
  isIgnoring: boolean
}) {
  const type = suggestion.suggestionType as SuggestionType
  const status = suggestion.status as SuggestionStatus
  const affected = parseStringArray(suggestion.affectedNotes)
  const action = parseJsonString(suggestion.proposedAction)
  const isAccepted = status === 'accepted'

  // 执行状态（本卡片自治）
  const [executing, setExecuting] = useState(false)
  const [executeResult, setExecuteResult] = useState<string | null>(null)
  const [executeError, setExecuteError] = useState<string | null>(null)

  const handleApprove = async () => {
    // split_note / merge_workspace / resplit_workspace 需要二次确认
    if (['split_note', 'merge_workspace', 'resplit_workspace'].includes(suggestion.suggestionType)) {
      const confirmed = window.confirm(
        '确认执行此操作？这将创建新 Workspace 并迁移内容。源 Workspace 将保留，需手动确认删除。')
      if (!confirmed) return
    }

    setExecuting(true)
    setExecuteError(null)
    try {
      const result = await onApprove(suggestion.id)
      setExecuteResult(result.message)
    } catch (err: any) {
      setExecuteError(err.response?.data?.message || err.message || '执行失败')
    } finally {
      setExecuting(false)
    }
  }

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

      {/* 采纳成功结果展示 */}
      {isAccepted && executeResult && (
        <div className="flex items-center gap-1.5 text-xs text-success">
          <CheckCircle className="h-3.5 w-3.5 shrink-0" />
          <span>已采纳</span>
          <span className="text-muted-foreground">— {executeResult}</span>
        </div>
      )}

      {/* 执行错误提示（可重试） */}
      {executeError && (
        <p className="text-xs text-destructive">
          {executeError}（可重试）
        </p>
      )}

      {/* 操作按钮 */}
      {/* pending 状态：展示采纳/忽略按钮 */}
      {status === 'pending' && (
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={handleApprove}
            disabled={executing || isIgnoring}
            className="nexus-button-primary inline-flex h-8 items-center gap-1.5 px-3 text-xs font-bold disabled:opacity-50"
          >
            {executing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                执行中…
              </>
            ) : (
              <>
                <Check className="h-3.5 w-3.5" />
                采纳
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => onIgnore(suggestion.id)}
            disabled={executing || isIgnoring}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-card px-3 text-xs font-bold text-muted-foreground hover:bg-accent disabled:opacity-50"
          >
            {isIgnoring ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                忽略中…
              </>
            ) : (
              <>
                <X className="h-3.5 w-3.5" />
                忽略
              </>
            )}
          </button>
        </div>
      )}

      {/* accepted 状态（未记录本地执行结果时兜底展示） */}
      {isAccepted && !executeResult && (
        <div className="flex items-center gap-1.5 pt-1 text-xs text-success">
          <CheckCircle className="h-3.5 w-3.5" />
          <span>已采纳</span>
        </div>
      )}
    </div>
  )
}

/** 状态 badge 组件 */
function StatusBadge({ status }: { status: SuggestionStatus }) {
  const styles: Record<SuggestionStatus, string> = {
    pending: 'bg-muted text-muted-foreground',
    accepted: 'bg-success-soft text-success',
    ignored: 'bg-muted text-muted-foreground line-through',
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
