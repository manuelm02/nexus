import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import type { TranslationResult } from '../../../types/domain.types'
import { styleLabel } from '../translate.shared'
import { ProviderEmptyState } from './ProviderEmptyState'

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

// TranslateResultPanel 集中处理 provider 状态和结果详情，provider 检测中和未配置只在结果语境中出现。
export function TranslateResultPanel({ result, resultStage, copied, pending, providerMissing, providerChecking, errorMessage, onCopy, mode }: TranslateResultPanelProps) {
  // 备选译文复制状态，必须在所有 early return 之前声明，避免 hooks 调用顺序不稳定
  const [copiedAlternative, setCopiedAlternative] = useState<string | null>(null)

  if (providerMissing) return <ProviderEmptyState />

  if (providerChecking && !result) {
    return (
      <section className="nexus-surface p-5">
        <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Result</p>
        <div className="mt-8 max-w-md">
          <h2 className="text-xl font-extrabold text-foreground">正在检查翻译能力</h2>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">如果可用 provider 已配置，结果会在这里显示；如果未配置，也只会在这里提示。</p>
        </div>
      </section>
    )
  }

  if (pending && !result) return (
    <section className="nexus-surface min-h-[200px] p-5">
      <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Result</p>
      <div className="mt-8 max-w-md">
        <h2 className="text-xl font-extrabold text-foreground">正在获取快速译文</h2>
        <p className="mt-2 text-sm leading-7 text-muted-foreground">后台会优先使用腾讯云机器翻译生成初稿；随后再补充解释、关键词和备选表达。</p>
      </div>
    </section>
  )

  if (!result) return (
    <section className="nexus-surface min-h-[200px] p-5">
      <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Result</p>
      <div className="mt-8 max-w-md">
        <h2 className="text-xl font-extrabold text-foreground">翻译结果将显示在这里</h2>
        <p className="mt-2 text-sm leading-7 text-muted-foreground">主译文、解释、关键词和备选表达会分层展示。</p>
      </div>
      {errorMessage && <p className="mt-5 rounded-xl bg-destructive-soft p-3 text-sm font-semibold text-destructive">{errorMessage}</p>}
    </section>
  )

  const keywords = result.keywords ?? []
  const alternatives = result.alternatives ?? []
  const isStreaming = resultStage === 'streaming'
  // 移动端备选表达默认只显示前 2 条，避免撑开页面
  const visibleAlternatives = mode === 'mobile' ? alternatives.slice(0, 2) : alternatives

  return (
    <section className="nexus-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Translated</p>
          <p className="mt-3 whitespace-pre-wrap text-lg font-semibold leading-8 text-foreground md:text-xl md:leading-9">
            {result.translatedText}
            {/* 流式生成时在文本末尾追加一个闪烁光标，实现 ChatGPT 逐字动画 */}
            {isStreaming && <span className="ml-0.5 inline-block h-[1.1em] w-[2px] animate-pulse bg-primary align-[-0.15em]" />}
          </p>
          {resultStage === 'draft' && (
            <p className="mt-2 text-xs font-bold text-muted-foreground">快速译文已生成，LLM 正在逐字润色...</p>
          )}
          {resultStage === 'streaming' && (
            <p className="mt-2 text-xs font-bold text-muted-foreground">LLM 正在逐字生成润色译文<span className="inline-block animate-pulse">...</span></p>
          )}
          {resultStage === 'enhancing' && (
            <p className="mt-2 text-xs font-bold text-muted-foreground">正在补充解释和上下文信息...</p>
          )}
        </div>
        <button type="button" onClick={onCopy} aria-label="复制主译文" className="nexus-button-utility inline-flex h-10 w-10 shrink-0 items-center justify-center">
          {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
      {result.explanation && (
        <div className="mt-5 border-t border-border pt-4">
          <h3 className="text-sm font-extrabold text-foreground">Explanation</h3>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">{result.explanation}</p>
        </div>
      )}
      {keywords.length > 0 && (
        <div className="mt-5 border-t border-border pt-4">
          <h3 className="text-sm font-extrabold text-foreground">Keywords</h3>
          <div className="mt-2 flex flex-wrap gap-2">{keywords.map((keyword) => <span key={keyword} className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-bold text-muted-foreground">{keyword}</span>)}</div>
        </div>
      )}
      {alternatives.length > 0 && (
        <div className="mt-5 border-t border-border pt-4">
          <h3 className="text-sm font-extrabold text-foreground">Alternatives</h3>
          <div className="mt-2 space-y-1.5">
            {visibleAlternatives.map((alternative) => {
              const isAltCopied = copiedAlternative === alternative
              return (
                <div key={alternative} className="group flex items-center gap-2 rounded-lg border border-border bg-muted/35 transition-colors hover:border-input hover:bg-muted/55">
                  <p className="min-w-0 flex-1 px-3 py-2 text-left text-sm leading-6 text-foreground">{alternative}</p>
                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(alternative)
                      setCopiedAlternative(alternative)
                      setTimeout(() => setCopiedAlternative(null), 2000)
                    }}
                    className="mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-all hover:bg-accent hover:text-foreground group-hover:opacity-100"
                    aria-label={`复制备选译文: ${alternative}`}
                  >
                    {isAltCopied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
      <p className="mt-5 border-t border-border pt-3 text-xs font-semibold text-muted-foreground">{result.targetLang} · {styleLabel(result.style)} · {result.provider ?? 'provider unknown'}</p>
    </section>
  )
}
