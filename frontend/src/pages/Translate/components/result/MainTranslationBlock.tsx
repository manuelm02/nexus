import type { TranslationResult } from '../../../../types/domain.types'

type MainTranslationBlockProps = {
  result: TranslationResult
  resultStage: 'idle' | 'waiting-draft' | 'draft' | 'streaming' | 'enhancing' | 'done' | 'error'
  mode: 'desktop' | 'mobile'
}

// 统一主译文展示区：draft/token/enhanced/done 四个阶段共用同一个区域，不区分来源。
export function MainTranslationBlock({ result, resultStage, mode }: MainTranslationBlockProps) {
  const isStreaming = resultStage === 'streaming'
  const text = result.translatedText

  if (!text) return null

  return (
    <p
      className={`whitespace-pre-wrap font-semibold leading-8 text-foreground ${
        mode === 'mobile' ? 'text-base leading-7' : 'text-lg md:text-xl md:leading-9'
      }`}
    >
      {text}
      {/* 流式输出时在文本末尾显示闪烁光标 */}
      {isStreaming && (
        <span className="ml-0.5 inline-block h-[1.15em] w-[2px] bg-primary align-[-0.15em] nexus-animate-caret" />
      )}
    </p>
  )
}
