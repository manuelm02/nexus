import { useState } from 'react'
import { Link2, ChevronDown, ChevronUp, Sparkles, Save, Loader2, EyeOff } from 'lucide-react'
import { cn } from '../../../../lib/utils'

export type BookmarkCaptureBarProps = {
  url: string
  title: string
  onUrlChange: (url: string) => void
  onTitleChange: (title: string) => void
  onSave: () => void
  onAnalyze: () => void
  isAnalyzing: boolean
  aiAvailable: boolean
  isCreating: boolean
}

// 书签捕获栏：URL 输入 + 可选标题展开 + AI 整理按钮 + 保存按钮，紧凑工作台风格。
export function BookmarkCaptureBar({
  url,
  title,
  onUrlChange,
  onTitleChange,
  onSave,
  onAnalyze,
  isAnalyzing,
  aiAvailable,
  isCreating,
}: BookmarkCaptureBarProps) {
  const [showTitle, setShowTitle] = useState(false)

  return (
    <div className="rounded-lg border bg-card p-3 shadow-[var(--shadow-xs)] space-y-2">
      {/* 主 URL 输入行 */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Link2 className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            placeholder="输入或粘贴 URL…"
            className="nexus-input w-full pl-8 pr-3 py-1.5 text-sm"
            autoFocus
          />
        </div>
      </div>

      {/* 操作行：展开标题 + AI + 保存 */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowTitle(!showTitle)}
          className={cn(
            'flex items-center gap-1 h-9 md:h-8 rounded-lg border px-2.5 text-xs font-medium transition-colors',
            showTitle
              ? 'bg-accent text-accent-foreground border-input'
              : 'bg-card text-muted-foreground hover:text-foreground',
          )}
        >
          {showTitle ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          更多
        </button>

        {aiAvailable && (
          <button
            type="button"
            onClick={onAnalyze}
            disabled={!url.trim() || isAnalyzing}
            className={cn(
              'flex items-center gap-1.5 h-9 md:h-8 rounded-lg border px-2.5 text-xs font-medium transition-colors',
              'text-muted-foreground hover:text-primary hover:border-primary/30 disabled:opacity-50',
            )}
          >
            {isAnalyzing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            AI 整理
          </button>
        )}

        {!aiAvailable && (
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <EyeOff className="h-3 w-3" />
            AI 未启用
          </span>
        )}

        <div className="flex-1" />

        <button
          type="button"
          onClick={onSave}
          disabled={!url.trim() || isCreating}
          className="nexus-button-primary flex items-center gap-1.5 px-3 py-1.5 text-xs"
        >
          {isCreating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          保存
        </button>
      </div>

      {/* 可展开标题输入 */}
      {showTitle && (
        <div className="pt-1">
          <input
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="标题（可选，留空则根据 URL 自动生成）"
            className="nexus-input w-full px-3 py-1.5 text-sm"
          />
        </div>
      )}
    </div>
  )
}
