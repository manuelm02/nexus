import { Copy, Check } from 'lucide-react'

type ResultHeaderProps = {
  /** 主复制回调 */
  onCopy: () => void
  copied: boolean
  resultStage: 'idle' | 'waiting-draft' | 'draft' | 'streaming' | 'enhancing' | 'done' | 'error'
}

const BADGE_MAP: Record<string, { label: string; pulse: boolean } | null> = {
  'waiting-draft': { label: '生成中', pulse: true },
  'draft': { label: '补全中', pulse: true },
  'streaming': { label: '补全中', pulse: true },
  'enhancing': { label: '补全中', pulse: true },
  'done': { label: '已完成', pulse: false },
  'error': { label: '失败', pulse: false },
}

// 结果面板顶部行：译文标题 + 状态徽章 + 复制按钮。
export function ResultHeader({ onCopy, copied, resultStage }: ResultHeaderProps) {
  const badge = BADGE_MAP[resultStage]

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <h3 className="text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground">
          译文
        </h3>
        {badge && (
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.06em] transition-colors duration-300 ${
              resultStage === 'error'
                ? 'border-destructive/30 bg-destructive-soft text-destructive'
                : resultStage === 'done'
                  ? 'border-success/30 bg-success-soft text-success'
                  : 'border-border bg-muted text-muted-foreground'
            }`}
          >
            {badge.pulse && (
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
            )}
            {badge.label}
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={onCopy}
        aria-label="复制译文"
        className="nexus-button-utility inline-flex h-9 w-9 shrink-0 items-center justify-center"
      >
        {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
      </button>
    </div>
  )
}
