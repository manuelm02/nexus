import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, Loader2, Save, Server } from 'lucide-react'
import { settingsApi } from '../../../api/settings.api'

const K_CRAWL4AI_URL = 'crawl.crawl4ai.url'
const K_MARKITDOWN_URL = 'crawl.markitdown.url'

// CrawlSettingsPanel 提供 Crawl 页面所需的外部服务地址配置。
export function CrawlSettingsPanel() {
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'crawl'],
    queryFn: () => settingsApi.getCrawlSettings(),
    select: (res) => res.data?.data ?? {},
  })

  const [draft, setDraft] = useState({
    [K_CRAWL4AI_URL]: '',
    [K_MARKITDOWN_URL]: '',
  })

  useEffect(() => {
    if (data) {
      setDraft({
        [K_CRAWL4AI_URL]: data[K_CRAWL4AI_URL] ?? '',
        [K_MARKITDOWN_URL]: data[K_MARKITDOWN_URL] ?? '',
      })
    }
  }, [data])

  const dirty = data
    ? draft[K_CRAWL4AI_URL] !== (data[K_CRAWL4AI_URL] ?? '') ||
      draft[K_MARKITDOWN_URL] !== (data[K_MARKITDOWN_URL] ?? '')
    : false

  const saveMutation = useMutation({
    mutationFn: () => settingsApi.saveCrawlSettings(draft),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', 'crawl'] }),
  })

  const handleCancel = () => {
    if (data) {
      setDraft({
        [K_CRAWL4AI_URL]: data[K_CRAWL4AI_URL] ?? '',
        [K_MARKITDOWN_URL]: data[K_MARKITDOWN_URL] ?? '',
      })
    }
  }

  if (isLoading) {
    return (
      <section className="nexus-surface space-y-4 p-4">
        <p className="text-sm text-muted-foreground">加载中…</p>
      </section>
    )
  }

  return (
    <section className="nexus-surface space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-foreground">Crawl 设置</h2>
          <p className="mt-1 text-xs text-muted-foreground">配置网页爬取和文件格式转换服务地址。</p>
        </div>
        {dirty && (
          <span className="rounded-md bg-warning-soft px-2 py-1 text-xs font-bold text-warning">
            有未保存更改
          </span>
        )}
      </div>

      <div className="rounded-xl border border-border bg-muted/30 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Server className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-extrabold text-foreground">服务地址</h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-bold text-muted-foreground">Crawl4AI URL</label>
            <input
              type="text"
              value={draft[K_CRAWL4AI_URL]}
              placeholder="http://192.168.110.10:3003"
              onChange={(e) => setDraft((p) => ({ ...p, [K_CRAWL4AI_URL]: e.target.value }))}
              className="nexus-input h-9 w-full px-3 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-muted-foreground">MarkItDown URL</label>
            <input
              type="text"
              value={draft[K_MARKITDOWN_URL]}
              placeholder="http://192.168.110.10:3004"
              onChange={(e) => setDraft((p) => ({ ...p, [K_MARKITDOWN_URL]: e.target.value }))}
              className="nexus-input h-9 w-full px-3 text-sm"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card/95 p-3 shadow-[var(--shadow-xs)]">
        <button
          type="button"
          onClick={() => saveMutation.mutate()}
          disabled={!dirty || saveMutation.isPending}
          className="nexus-button-primary inline-flex items-center gap-1.5 px-4 text-xs disabled:opacity-50"
        >
          {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saveMutation.isPending ? '保存中…' : '保存设置'}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={!dirty || saveMutation.isPending}
          className="nexus-button-utility px-4 text-xs disabled:opacity-50"
        >
          取消更改
        </button>
        {saveMutation.isError && (
          <span className="flex items-center gap-1 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5" /> 保存失败
          </span>
        )}
      </div>
    </section>
  )
}
