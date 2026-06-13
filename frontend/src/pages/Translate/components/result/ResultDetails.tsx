import { AlternativeList } from './AlternativeList'
import type { TranslationResult } from '../../../../types/domain.types'

type ResultDetailsProps = {
  result: TranslationResult
  resultStage: 'idle' | 'waiting-draft' | 'draft' | 'streaming' | 'enhancing' | 'done' | 'error'
  mode: 'desktop' | 'mobile'
}

// enhanced 事件到达后按顺序展示解释、关键词、备选表达，每部分带轻量入场动画。
export function ResultDetails({ result, resultStage, mode }: ResultDetailsProps) {
  const show = resultStage === 'enhancing' || resultStage === 'done'
  if (!show) return null

  const keywords = result.keywords ?? []
  const alternatives = result.alternatives ?? []
  const hasAny = result.explanation || keywords.length > 0 || alternatives.length > 0
  if (!hasAny) return null

  return (
    <div className="space-y-4">
      {result.explanation && (
        <div className="nexus-animate-fade-in-up border-t border-border pt-4">
          <h3 className="text-sm font-extrabold text-foreground">解释</h3>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">{result.explanation}</p>
        </div>
      )}
      {keywords.length > 0 && (
        <div className="nexus-animate-fade-in-up border-t border-border pt-4" style={{ animationDelay: '60ms' }}>
          <h3 className="text-sm font-extrabold text-foreground">关键词</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {keywords.map((keyword) => (
              <span
                key={keyword}
                className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-bold text-muted-foreground"
              >
                {keyword}
              </span>
            ))}
          </div>
        </div>
      )}
      {alternatives.length > 0 && (
        <div className="nexus-animate-fade-in-up border-t border-border pt-4" style={{ animationDelay: '100ms' }}>
          <h3 className="text-sm font-extrabold text-foreground">备选表达</h3>
          <div className="mt-2">
            <AlternativeList alternatives={alternatives} mode={mode} />
          </div>
        </div>
      )}
    </div>
  )
}
