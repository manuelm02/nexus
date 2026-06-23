import type { AgentSuggestion, SuggestionExecuteResult } from '../../../types/mindbank.types'
import { SuggestionCard } from './SuggestionCard'

// InspectionReport 巡检报告组件：展示 Agent 建议卡片列表，支持逐条采纳或忽略。
// Phase 6-8：onApprove 改为异步，返回 SuggestionExecuteResult 供 SuggestionCard 展示执行结果。
export function InspectionReport({
  suggestions,
  onApprove,
  onIgnore,
  ignoringId,
}: {
  suggestions: AgentSuggestion[]
  onApprove: (id: number) => Promise<SuggestionExecuteResult>
  onIgnore: (id: number) => void
  ignoringId: number | null
}) {
  if (suggestions.length === 0) {
    return (
      <div className="nexus-surface p-6 text-center">
        <p className="text-sm text-muted-foreground">巡检完成，未发现体系性问题</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {suggestions.map((s) => (
        <SuggestionCard
          key={s.id}
          suggestion={s}
          onApprove={onApprove}
          onIgnore={onIgnore}
          isIgnoring={ignoringId === s.id}
        />
      ))}
    </div>
  )
}
