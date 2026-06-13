import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

type AlternativeListProps = {
  alternatives: string[]
  mode: 'desktop' | 'mobile'
}

// 备选译文列表，enhanced 到达后逐条延迟渐显，每条保留复制按钮。移动端最多先展示 2 条。
export function AlternativeList({ alternatives, mode }: AlternativeListProps) {
  const [copiedAlternative, setCopiedAlternative] = useState<string | null>(null)
  // 移动端折叠：默认 2 条，超过则显示展开按钮
  const [mobileExpanded, setMobileExpanded] = useState(false)
  const visibleCount = mode === 'mobile' && !mobileExpanded ? 2 : alternatives.length
  const visibleAlternatives = alternatives.slice(0, visibleCount)
  const hasMore = alternatives.length > 2

  return (
    <div className="space-y-1.5">
      {visibleAlternatives.map((alternative, index) => {
        const isAltCopied = copiedAlternative === alternative
        // 每条延迟渐显：第 1 条 80ms，第 2 条 180ms，第 3 条 280ms，之后每条 +100ms
        const delay = 80 + index * 100

        return (
          <div
            key={alternative}
            className="nexus-animate-stagger group flex items-center gap-2 rounded-lg border border-border bg-card transition-colors hover:border-input hover:bg-accent"
            style={{ animationDelay: `${delay}ms` }}
          >
            <p className="min-w-0 flex-1 px-3 py-2 text-left text-sm leading-6 text-foreground">
              {alternative}
            </p>
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
      {mode === 'mobile' && hasMore && (
        <button
          type="button"
          onClick={() => setMobileExpanded(!mobileExpanded)}
          className="mt-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          {mobileExpanded ? '收起' : `查看全部 ${alternatives.length} 条备选表达`}
        </button>
      )}
    </div>
  )
}
