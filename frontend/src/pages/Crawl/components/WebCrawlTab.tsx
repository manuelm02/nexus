import { useState } from 'react'
import { Loader2, Globe, ChevronDown, ChevronUp } from 'lucide-react'

type WebCrawlTabProps = {
  onCrawl: (url: string) => void
  isPending: boolean
  error: string | null
  result: string | null
}

// WebCrawlTab 提供 URL 输入、爬取触发和 Markdown 预览，桌面端和移动端共用。
export function WebCrawlTab({ onCrawl, isPending, error, result }: WebCrawlTabProps) {
  const [url, setUrl] = useState('')
  const [previewExpanded, setPreviewExpanded] = useState(false)

  const handleSubmit = () => {
    if (!url.trim() || isPending) return
    onCrawl(url.trim())
  }

  return (
    <section className="nexus-surface space-y-4 p-4">
      <div className="flex items-center gap-2">
        <Globe className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-extrabold text-foreground">网页爬取</h2>
      </div>

      {/* URL 输入区 */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="url"
          value={url}
          placeholder="https://example.com/article"
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          disabled={isPending}
          className="nexus-input h-10 flex-1 px-3 text-sm"
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!url.trim() || isPending}
          className="nexus-button-primary inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs disabled:opacity-50"
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
          {isPending ? '爬取中…' : '爬取'}
        </button>
      </div>

      {/* 错误提示 */}
      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive-soft px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}

      {/* Markdown 预览 */}
      {result && (
        <div className="rounded-xl border border-border bg-muted/30 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">Markdown 预览</span>
            <button
              type="button"
              onClick={() => setPreviewExpanded((v) => !v)}
              className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
            >
              {previewExpanded ? (
                <>收起 <ChevronUp className="h-3.5 w-3.5" /></>
              ) : (
                <>展开 <ChevronDown className="h-3.5 w-3.5" /></>
              )}
            </button>
          </div>
          <pre className={`whitespace-pre-wrap break-words text-xs leading-6 text-foreground ${previewExpanded ? '' : 'line-clamp-[10]'}`}>
            {result}
          </pre>
        </div>
      )}
    </section>
  )
}
