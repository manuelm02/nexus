import type { TranslationResult } from '../../../types/domain.types'
import { ProviderEmptyState } from './ProviderEmptyState'
import { ResultHeader } from './result/ResultHeader'
import { MainTranslationBlock } from './result/MainTranslationBlock'
import { ResultDetails } from './result/ResultDetails'
import { getResultStatus } from './result/ResultStatusLine'

type TranslateResultPanelProps = {
  result: TranslationResult | null
  resultStage: 'idle' | 'waiting-draft' | 'draft' | 'streaming' | 'enhancing' | 'done' | 'error'
  copied: boolean
  pending: boolean
  providerMissing: boolean
  providerChecking: boolean
  errorMessage?: string
  onCopy: () => void
  mode: 'desktop' | 'mobile'
}

// TranslateResultPanel 编排统一的翻译结果展示：状态检测 → 译文区 → 状态提示 → 补充信息。
// 用户只感知"译文正在变完整"，不暴露翻译 API/LLM 等来源。
export function TranslateResultPanel({
  result, resultStage, copied, pending,
  providerMissing, providerChecking, errorMessage, onCopy, mode,
}: TranslateResultPanelProps) {
  if (providerMissing) return <ProviderEmptyState />

  if (providerChecking && !result) {
    return (
      <section className="nexus-surface p-4 md:p-5">
        <div className="mt-8 max-w-md">
          <h2 className="text-xl font-extrabold text-foreground">正在检查翻译能力</h2>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            如果可用翻译能力已配置，结果会在这里显示；如果未配置，也只会在这里提示。
          </p>
        </div>
      </section>
    )
  }

  if (pending && !result) {
    return (
      <section className="nexus-surface min-h-[200px] p-4 md:p-5">
        <div className="mt-8 max-w-md">
          <h2 className="text-xl font-extrabold text-foreground">正在生成译文</h2>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            译文生成后，还会补充解释、关键词和备选表达。
          </p>
        </div>
      </section>
    )
  }

  if (!result) {
    return (
      <section className="nexus-surface min-h-[200px] p-4 md:p-5">
        <div className="mt-8 max-w-md">
          <h2 className="text-xl font-extrabold text-foreground">翻译结果将显示在这里</h2>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            主译文、解释、关键词和备选表达会分层展示。
          </p>
        </div>
        {errorMessage && (
          <p className="mt-5 rounded-xl bg-destructive-soft p-3 text-sm font-semibold text-destructive">
            {errorMessage}
          </p>
        )}
      </section>
    )
  }

  const statusText = getResultStatus(resultStage, Boolean(result.translatedText))

  return (
    <section className="nexus-surface p-4 md:p-5">
      <ResultHeader onCopy={onCopy} copied={copied} resultStage={resultStage} />

      <div className="mt-3">
        <MainTranslationBlock result={result} resultStage={resultStage} mode={mode} />
      </div>

      {statusText && (
        <p className="mt-2 text-xs font-semibold text-muted-foreground/60">{statusText}</p>
      )}

      <div className="mt-3">
        <ResultDetails result={result} resultStage={resultStage} mode={mode} />
      </div>
    </section>
  )
}
