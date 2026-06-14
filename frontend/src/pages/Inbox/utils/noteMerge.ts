/** 归一化文本用于比较：合并连续空白、去除首尾空白、转小写。 */
function normalizeForCompare(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase()
}

/** 计算两段归一化文本按词的 Jaccard 相似度，用于判断段落是否重复。 */
function jaccardSimilarity(a: string, b: string): number {
  const tokensA = new Set(a.split(' ').filter(Boolean))
  const tokensB = new Set(b.split(' ').filter(Boolean))
  if (tokensA.size === 0 && tokensB.size === 0) return 1
  let intersection = 0
  for (const t of tokensA) if (tokensB.has(t)) intersection++
  const union = new Set([...tokensA, ...tokensB]).size
  return union === 0 ? 0 : intersection / union
}

/**
 * 合并 AI 整理结果到当前笔记正文，采用保守策略。
 * 原因：AI 建议应用后若当前笔记已有类似原文，重复追加会导致笔记内容不断膨胀重复，
 * 因此只在建议内容明显不同于现有段落时才追加，宁可漏合并也不重复。
 */
export function mergeNoteContent(current: string, suggested?: string): string {
  if (!suggested || !suggested.trim()) return current

  const normCurrent = normalizeForCompare(current)
  const normSuggested = normalizeForCompare(suggested)
  if (!normCurrent) return suggested
  // 建议文本已包含当前全部内容（如 AI 重新整理了全文）：直接采用建议文本
  if (normSuggested.includes(normCurrent)) return suggested
  // 当前内容已包含建议文本：保持当前内容不变
  if (normCurrent.includes(normSuggested)) return current

  const currentParagraphs = current.split(/\n\s*\n/).map((p) => normalizeForCompare(p)).filter(Boolean)
  const suggestedParagraphs = suggested.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)

  const newParagraphs = suggestedParagraphs.filter((p) => {
    const normP = normalizeForCompare(p)
    return !currentParagraphs.some((cp) => jaccardSimilarity(cp, normP) >= 0.75)
  })

  if (newParagraphs.length === 0) return current
  return [current.trimEnd(), ...newParagraphs].join('\n\n')
}
