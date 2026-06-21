import { Loader2, FileText, Globe, Trash2, Eye, FolderInput } from 'lucide-react'
import type { MindBankDocument } from '../crawl.types'

type MinioFileListProps = {
  files: MindBankDocument[]
  isLoading: boolean
  deletingId: number | null
  onDelete: (docId: number) => void
  onImport: (docId: number) => void
  onPreview: (doc: MindBankDocument) => void
}

// MinioFileList 展示未导入到 Workspace 的文件列表，每行支持预览、导入和删除操作。
export function MinioFileList({ files, isLoading, deletingId, onDelete, onImport, onPreview }: MinioFileListProps) {
  return (
    <section className="nexus-surface space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-extrabold text-foreground">文件列表</h2>
        <span className="text-xs text-muted-foreground">{files.length} 个未导入</span>
      </div>

      {isLoading && (
        <p className="flex items-center gap-1.5 py-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> 加载中…
        </p>
      )}

      {!isLoading && files.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          暂无文件，爬取或上传后将显示在此处
        </p>
      )}

      {!isLoading && files.length > 0 && (
        <ul className="space-y-2">
          {files.map((doc) => (
            <li
              key={doc.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-muted/20 px-3 py-2.5"
            >
              {/* 文件类型图标 */}
              {doc.sourceType === 'crawl_web' ? (
                <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
              ) : (
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}

              {/* 文件信息 */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-foreground">{doc.fileName}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {doc.sourceType === 'crawl_web' ? '网页爬取' : '文件上传'} · {formatDate(doc.createdAt)}
                </p>
              </div>

              {/* 操作按钮组：桌面端显示文字，移动端仅图标 */}
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => onPreview(doc)}
                  title="查看 Markdown"
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-bold text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">预览</span>
                </button>
                <button
                  type="button"
                  onClick={() => onImport(doc.id)}
                  title="导入 Mindbank"
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-bold text-primary hover:bg-primary/10"
                >
                  <FolderInput className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">导入</span>
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(doc.id)}
                  disabled={deletingId === doc.id}
                  title="删除文件"
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-bold text-destructive hover:bg-destructive/10 disabled:opacity-50"
                >
                  {deletingId === doc.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  <span className="hidden sm:inline">删除</span>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
