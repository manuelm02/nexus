import type { TranslationResult } from '../../types/domain.types'

export const LANGUAGES = ['中文', '英文', '日文', '法文', '德文', '西班牙文', '韩文'] as const

export const STYLES = [
  { value: '', label: '默认' },
  { value: 'formal', label: '正式' },
  { value: 'casual', label: '口语' },
  { value: 'technical', label: '技术' },
] as const

export function styleLabel(value?: string) {
  return STYLES.find((item) => item.value === (value ?? ''))?.label ?? value ?? '默认'
}

/** 按原文、译文和关键词本地过滤历史记录，不涉及后端接口。 */
export function filterTranslationHistory(history: TranslationResult[], query: string): TranslationResult[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return history
  return history.filter((item) =>
    item.sourceText.toLowerCase().includes(normalized) ||
    item.translatedText.toLowerCase().includes(normalized) ||
    (item.keywords ?? []).some((keyword) => keyword.toLowerCase().includes(normalized))
  )
}

export interface TranslateViewProps {
  sourceText: string
  targetLang: string
  style: string
  result: TranslationResult | null
  resultStage: 'idle' | 'waiting-draft' | 'draft' | 'streaming' | 'enhancing' | 'done' | 'error'
  history: TranslationResult[]
  pending: boolean
  copied: boolean
  providerMissing: boolean
  providerChecking: boolean
  errorMessage?: string
  onSourceTextChange: (value: string) => void
  onTargetLangChange: (value: string) => void
  onStyleChange: (value: string) => void
  onTranslate: () => void
  onCopy: () => void
  onReuseHistory: (item: TranslationResult) => void
}
