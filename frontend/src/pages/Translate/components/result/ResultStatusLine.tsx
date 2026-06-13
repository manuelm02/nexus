// 根据翻译管线阶段输出短状态文案，不暴露任何技术来源（API/LLM/provider）。
export function getResultStatus(
  resultStage: 'idle' | 'waiting-draft' | 'draft' | 'streaming' | 'enhancing' | 'done' | 'error',
  hasTranslatedText: boolean,
): string | null {
  switch (resultStage) {
    case 'waiting-draft':
      return '正在生成译文...'
    case 'draft':
      return '正在补全表达...'
    case 'streaming':
      return '正在补全译文...'
    case 'enhancing':
      return '正在整理细节...'
    case 'done':
      return null // 完成后不显示额外状态
    case 'error':
      return hasTranslatedText ? '补全过程中断，可重新尝试' : '生成失败，请重试'
    default:
      return null
  }
}
