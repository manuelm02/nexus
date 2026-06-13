import { useState, useRef } from 'react'
import { Upload, FileText, ExternalLink, Tag, Loader2 } from 'lucide-react'
import { formatRelative } from '../../../lib/utils'
import type { InboxDocument } from '../../../types/domain.types'
import { IntegrationEmptyState } from './IntegrationEmptyState'

export type DocumentPanelProps = {
  documents: InboxDocument[]
  isLoading: boolean
  isError: boolean
  errorCode?: string
  paperlessConfigured: boolean
  onUpload: (file: File, title?: string, tags?: string[]) => void
  isUploading: boolean
  uploadError?: string
}

// 文档面板：paperless-ngx 上传和文档列表。未配置时显示 scoped empty state。
export function DocumentPanel({
  documents,
  isLoading,
  isError,
  errorCode,
  paperlessConfigured,
  onUpload,
  isUploading,
  uploadError,
}: DocumentPanelProps) {
  const [title, setTitle] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [showUpload, setShowUpload] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)

  if (!paperlessConfigured) {
    return (
      <IntegrationEmptyState
        serviceName="paperless-ngx"
        description="请设置 PAPERLESS_BASE_URL 和 PAPERLESS_TOKEN 环境变量"
      />
    )
  }

  const handleUpload = (e: React.FormEvent) => {
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
      {/* 上传区域 */}
      <div className="rounded-lg border bg-card p-3 shadow-[var(--shadow-xs)]">
        {!showUpload ? (
          <button
            type="button"
            onClick={() => setShowUpload(true)}
            className="flex w-full items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Upload className="h-4 w-4" />
            上传文档
          </button>
        ) : (
          <form onSubmit={handleUpload} className="space-y-2">
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
                {isUploading && <Loader2 className="h-3 w-3 animate-spin" />}
                上传
              </button>
            </div>
          </form>
        )}
      </div>

      {/* 文档列表 */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground py-4">加载中…</p>
      ) : isError ? (
        <p className="text-sm text-destructive py-4">
          {errorCode === 'PAPERLESS_NOT_CONFIGURED'
            ? 'paperless-ngx 未配置'
            : '文档加载失败'}
        </p>
      ) : documents.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">暂无文档</p>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-start gap-3 rounded-lg border bg-card p-3 shadow-[var(--shadow-xs)]"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-muted">
                <FileText className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground truncate">
                  {doc.title || doc.originalFileName || '未命名文档'}
                </p>
                {doc.originalFileName && (
                  <p className="mt-0.5 text-xs text-muted-foreground truncate">{doc.originalFileName}</p>
                )}
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {doc.correspondent && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {doc.correspondent}
                    </span>
                  )}
                  {doc.documentType && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {doc.documentType}
                    </span>
                  )}
                  {doc.tags.map((t) => (
                    <span key={t} className="inline-flex items-center gap-0.5 rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-accent-foreground">
                      <Tag className="h-2.5 w-2.5" />
                      {t}
                    </span>
                  ))}
                </div>
                {doc.createdAt && (
                  <p className="mt-1 text-[11px] text-muted-foreground">{formatRelative(doc.createdAt)}</p>
                )}
              </div>
              {doc.downloadUrl && (
                <a
                  href={doc.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                  title="下载"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
