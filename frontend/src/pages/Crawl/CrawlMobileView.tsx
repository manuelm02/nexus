import { Globe, Upload, FileText } from 'lucide-react'
import type { MindBankDocument, MindBankWorkspace } from './crawl.types'
import { WebCrawlTab } from './components/WebCrawlTab'
import { FileUploadTab } from './components/FileUploadTab'
import { MinioFileList } from './components/MinioFileList'
import { ImportToMindbank } from './components/ImportToMindbank'

type CrawlTab = 'web' | 'file'

type CrawlMobileViewProps = {
  activeTab: CrawlTab
  onTabChange: (tab: CrawlTab) => void
  crawlResult: string | null
  crawlPending: boolean
  crawlError: string | null
  onCrawl: (url: string) => void
  uploadResult: string | null
  uploadPending: boolean
  uploadError: string | null
  onUpload: (file: File) => void
  files: MindBankDocument[]
  filesLoading: boolean
  deletingId: number | null
  onDelete: (docId: number) => void
  onPreview: (doc: MindBankDocument) => void
  importOpen: boolean
  onImportOpenChange: (open: boolean) => void
  onImportClick: (docId: number) => void
  workspaces: MindBankWorkspace[]
  workspacesLoading: boolean
  importing: boolean
  onImportConfirm: (workspaceId: number) => void
  previewDoc: MindBankDocument | null
  onPreviewClose: () => void
  previewContent: string | null
  previewLoading: boolean
}

// CrawlMobileView 移动端单列堆叠：Tab 切换 → 操作区 → 文件列表，操作按钮折叠为图标。
export function CrawlMobileView(props: CrawlMobileViewProps) {
  const {
    activeTab, onTabChange,
    crawlResult, crawlPending, crawlError, onCrawl,
    uploadResult, uploadPending, uploadError, onUpload,
    files, filesLoading, deletingId, onDelete, onPreview,
    importOpen, onImportOpenChange, onImportClick,
    workspaces, workspacesLoading, importing, onImportConfirm,
    previewDoc, onPreviewClose, previewContent, previewLoading,
  } = props

  return (
    <div className="space-y-4 md:hidden">
      {/* 页面头部 */}
      <section className="nexus-surface p-4">
        <p className="text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground">Web intake</p>
        <h1 className="mt-1 text-[24px] font-black leading-tight text-foreground">Crawl</h1>
        <p className="mt-1 text-xs text-muted-foreground">网页爬取、文件上传转换</p>
      </section>

      {/* Tab 切换 */}
      <div className="flex gap-1 rounded-lg border bg-muted/40 p-1">
        <button
          type="button"
          onClick={() => onTabChange('web')}
          className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-bold ${
            activeTab === 'web' ? 'bg-card text-foreground shadow-[var(--shadow-xs)]' : 'text-muted-foreground'
          }`}
        >
          <Globe className="h-4 w-4" /> 网页
        </button>
        <button
          type="button"
          onClick={() => onTabChange('file')}
          className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-bold ${
            activeTab === 'file' ? 'bg-card text-foreground shadow-[var(--shadow-xs)]' : 'text-muted-foreground'
          }`}
        >
          <Upload className="h-4 w-4" /> 文件
        </button>
      </div>

      {activeTab === 'web' && (
        <WebCrawlTab onCrawl={onCrawl} isPending={crawlPending} error={crawlError} result={crawlResult} />
      )}
      {activeTab === 'file' && (
        <FileUploadTab onUpload={onUpload} isPending={uploadPending} error={uploadError} result={uploadResult} />
      )}

      <MinioFileList
        files={files}
        isLoading={filesLoading}
        deletingId={deletingId}
        onDelete={onDelete}
        onImport={onImportClick}
        onPreview={onPreview}
      />

      {/* 导入弹窗 */}
      <ImportToMindbank
        open={importOpen}
        onOpenChange={onImportOpenChange}
        workspaces={workspaces}
        workspacesLoading={workspacesLoading}
        importing={importing}
        onConfirm={onImportConfirm}
      />

      {/* 预览弹窗（移动端全屏） */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-background p-3" onClick={onPreviewClose}>
          <div className="flex items-center justify-between gap-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-black text-foreground">{previewDoc.fileName}</h3>
            </div>
            <button type="button" onClick={onPreviewClose} className="nexus-button-utility h-9 w-9 text-muted-foreground">✕</button>
          </div>
          <div className="mt-3" onClick={(e) => e.stopPropagation()}>
            {previewLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">加载中…</p>
            ) : previewContent ? (
              <pre className="whitespace-pre-wrap break-words text-xs leading-6 text-foreground">{previewContent}</pre>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">无内容</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
