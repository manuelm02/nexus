import type { ChatSuggestion } from '../../../types/domain.types'

type SuggestionChipsProps = {
  suggestions: ChatSuggestion[]
  onSelect: (text: string) => void
}

// SuggestionChips 展示动态推荐词条，最多显示 4 条避免截断
export function SuggestionChips({ suggestions, onSelect }: SuggestionChipsProps) {
  if (suggestions.length === 0) return null
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {suggestions.slice(0, 4).map((s) => (
        <button
          key={s.text}
          type="button"
          onClick={() => onSelect(s.text)}
          className="inline-flex items-center rounded-full border border-border bg-card px-3.5 py-2 text-xs font-semibold text-muted-foreground transition-all hover:bg-accent hover:text-foreground hover:shadow-[var(--shadow-xs)]"
        >
          {s.text}
        </button>
      ))}
    </div>
  )
}
