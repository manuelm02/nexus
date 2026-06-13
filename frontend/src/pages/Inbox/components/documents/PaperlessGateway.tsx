import { useState, useRef } from 'react'
import { Upload, FileText, Wifi, WifiOff, AlertCircle, Clock, ExternalLink, Loader2, Tag } from 'lucide-react'
import { cn, formatRelative } from '../../../../lib/utils'
import { IntegrationEmptyState } from '../IntegrationEmptyState'
import type { EntryLink, InboxDocument } from '../../../../types/domain.types'

export type PaperlessGatewayProps = {
  status: 'connected' | 'not_configured' | 'unauthorized' | 'unreachable'
  lastChecked?: string
  entryLinks: EntryLink[]
  recentDocuments: InboxDocument[]
  onUpload: (file: File, title?: string, tags?: string[]) => void
  isUploading: boolean
  uploadError?: string
}

// paperless 网关面板：状态栏 + 上传 + 入口卡片网格 + 最近文档列表。
export function PaperlessGateway({
  status,
  lastChecked,
  entryLinks,
  recentDocuments,
  onUpload,
  isUploading,
  uploadError,
}: PaperlessGatewayProps) {
  const [showUpload, setShowUpload] = useState(false)
  const [title, setTitle] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  if (status === 'not_configured') {
    return (
      <IntegrationEmptyState
        serviceName="paperless-ngx"
        description="请在设置中配置 paperless-ngx 连接信息"
        actionLabel="去配置 Inbox 设置"
        actionHref="/settings?tab=inbox"
      />
    )
  }

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return
    const tags = tagInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    onUpload(file, title.trim() || undefined, tags.length > 0 ? tags : undefined)
    setTitle('')
    setTagInput('')
    setFile(null)
    setShowUpload(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="space-y-3">
      {/* 状态栏 */}
      <div className={cn(
        'flex items-center gap-2 rounded-lg border px-3 py-2',
        status === 'connected' ? 'bg-success-soft/30 border-success/20' :
        status === 'unauthorized' ? 'bg-destructive/5 border-destructive/20' :
        'bg-yellow-500/5 border-yellow-500/20',
      )}>
        {status === 'connected' ? (
          <Wifi className="h-4 w-4 text-success" />
        ) : status === 'unauthorized' ? (
          <AlertCircle className="h-4 w-4 text-destructive" />
        ) : (
          <WifiOff className="h-4 w-4 text-yellow-600" />
        )}
        <span className={cn(
          'text-xs font-semibold',
          status === 'connected' ? 'text-success' :
          status === 'unauthorized' ? 'text-destructive' :
          'text-yellow-600',
        )}>
          {status === 'connected' ? '已连接' :
           status === 'unauthorized' ? '认证失败' :
           '无法连接'}
        </span>
        {lastChecked && (
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground ml-auto">
            <Clock className="h-2.5 w-2.5" />
            {formatRelative(lastChecked)}
          </span>
        )}
      </div>

      {/* 上传区域 */}
      <div className="rounded-lg border bg-card p-3 shadow-[var(--shadow-xs)]">
        {!showUpload ? (
          <button
            type="button"
            onClick={() => setShowUpload(true)}
            disabled={status !== 'connected'}
            className="flex w-full items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            上传文档到 paperless
          </button>
        ) : (
          <form onSubmit={handleUploadSubmit} className="space-y-2">
            <input
              ref={fileRef}
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="nexus-input w-full px-3 py-1.5 text-sm"
            />
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="标题（可选）"
              className="nexus-input w-full px-3 py-1.5 text-sm"
            />
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="标签，逗号分隔"
              className="nexus-input w-full px-3 py-1.5 text-sm"
            />
            {uploadError && (
              <p className="text-xs text-destructive">{uploadError}</p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowUpload(false)}
                className="nexus-button-utility px-3 py-1.5 text-xs"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={!file || isUploading}
                className="nexus-button-primary flex items-center gap-1.5 px-3 py-1.5 text-xs"
              >
                {isUploading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                上传
              </button>
            </div>
          </form>
        )}
      </div>

      {/* 入口卡片网格 */}
      {entryLinks.length > 0 && <PaperlessEntryGrid entryLinks={entryLinks} />}

      {/* 最近文档列表 */}
      <div className="space-y-1.5">
        <p className="text-xs font-semibold text-muted-foreground">最近文档</p>
        {recentDocuments.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">暂无文档</p>
        ) : (
          <div className="space-y-1">
            {recentDocuments.map((doc) => (
              <div
                key={doc.id}
                className="flex items-start gap-3 rounded-lg border bg-card p-2.5"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-muted">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-foreground truncate">
                    {doc.title || doc.originalFileName || '未命名文档'}
                  </p>
                  {doc.tags.length > 0 && (
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {doc.tags.slice(0, 3).map((t) => (
                        <span key={t} className="inline-flex items-center gap-0.5 rounded-full bg-accent px-1.5 py-0.5 text-[10px] text-accent-foreground">
                          <Tag className="h-2 w-2" />{t}
                        </span>
                      ))}
                      {doc.tags.length > 3 && (
                        <span className="text-[10px] text-muted-foreground">+{doc.tags.length - 3}</span>
                      )}
                    </div>
                  )}
                  {doc.createdAt && (
                    <p className="mt-0.5 text-[10px] text-muted-foreground">{formatRelative(doc.createdAt)}</p>
                  )}
                </div>
                {doc.downloadUrl && (
                  <a
                    href={doc.downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/** paperless 入口网格：8 个入口卡片 2x4 或响应式 4x2 */
export function PaperlessEntryGrid({ entryLinks }: { entryLinks: EntryLink[] }) {
  const handleOpen = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      {entryLinks.map((link) => (
        <button
          key={link.key}
          type="button"
          onClick={() => handleOpen(link.url)}
          className="flex flex-col items-center gap-1.5 rounded-lg border bg-card p-3 shadow-[var(--shadow-xs)] text-center transition-colors hover:border-primary/30 hover:bg-accent"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded bg-primary/10">
            <FileText className="h-4 w-4 text-primary" />
          </div>
          <span className="text-xs font-bold text-foreground truncate w-full">{link.label}</span>
          {link.description && (
            <span className="text-[10px] text-muted-foreground leading-tight line-clamp-2">
              {link.description}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
