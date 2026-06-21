import { Globe, Upload, FileText } from 'lucide-react'
import type { MindBankDocument } from './crawl.types'
import { WebCrawlTab } from './components/WebCrawlTab'
import { FileUploadTab } from './components/FileUploadTab'
import { MinioFileList } from './components/MinioFileList'
import { ImportToMindbank } from './components/ImportToMindbank'
import type { MindBankWorkspace } from './crawl.types'

type CrawlTab = 'web' | 'file'

type CrawlDesktopViewProps = {
  activeTab: CrawlTab
  onTabChange: (tab: CrawlTab) => void
  // Web Crawl
  crawlResult: string | null
  crawlPending: boolean
  crawlError: string | null
  onCrawl: (url: string) => void
  // File Upload
  uploadResult: string | null
  uploadPending: boolean
  uploadError: string | null
  onUpload: (file: File) => void
  // File List
  files: MindBankDocument[]
  filesLoading: boolean
  deletingId: number | null
  onDelete: (docId: number) => void
  onPreview: (doc: MindBankDocument) => void
  // Import
  importOpen: boolean
  onImportOpenChange: (open: boolean) => void
  onImportClick: (docId: number) => void
  workspaces: MindBankWorkspace[]
  workspacesLoading: boolean
  importing: boolean
  onImportConfirm: (workspaceId: number) => void
  // Preview Modal
  previewDoc: MindBankDocument | null
  onPreviewClose: () => void
  previewContent: string | null
  previewLoading: boolean
}

// CrawlDesktopView 桌面端两列布局：左侧爬取/上传操作区，右侧文件列表。
export function CrawlDesktopView(props: CrawlDesktopViewProps) {
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
    <div className="hidden space-y-4 md:block">
      {/* 页面头部 */}
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground">Web intake</p>
        <h1 className="mt-1 text-[28px] font-black leading-tight text-foreground">Crawl</h1>
        <p className="mt-2 text-sm font-medium text-muted-foreground">网页爬取、文件上传转换和 MinIO 文件管理</p>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* 左列：操作区 */}
        <div className="space-y-4">
          {/* Tab 切换 */}
          <div className="flex gap-1 rounded-lg border bg-muted/40 p-1">
            <TabButton active={activeTab === 'web'} onClick={() => onTabChange('web')} icon={<Globe className="h-4 w-4" />} label="网页爬取" />
            <TabButton active={activeTab === 'file'} onClick={() => onTabChange('file')} icon={<Upload className="h-4 w-4" />} label="文件上传" />
          </div>

          {activeTab === 'web' && (
            <WebCrawlTab onCrawl={onCrawl} isPending={crawlPending} error={crawlError} result={crawlResult} />
          )}
          {activeTab === 'file' && (
            <FileUploadTab onUpload={onUpload} isPending={uploadPending} error={uploadError} result={uploadResult} />
          )}
        </div>

        {/* 右列：文件列表 */}
        <div>
          <MinioFileList
            files={files}
            isLoading={filesLoading}
            deletingId={deletingId}
            onDelete={onDelete}
            onImport={onImportClick}
            onPreview={onPreview}
          />
        </div>
      </div>

      {/* 导入弹窗 */}
      <ImportToMindbank
        open={importOpen}
        onOpenChange={onImportOpenChange}
        workspaces={workspaces}
        workspacesLoading={workspacesLoading}
        importing={importing}
        onConfirm={onImportConfirm}
      />

      {/* 预览弹窗（桌面端复用 Dialog） */}
      {previewDoc && (
        <PreviewDialog
          doc={previewDoc}
          content={previewContent}
          loading={previewLoading}
          onClose={onPreviewClose}
        />
      )}
    </div>
  )
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-bold transition-colors ${
        active ? 'bg-card text-foreground shadow-[var(--shadow-xs)]' : 'text-muted-foreground'
      }`}
    >
      {icon} {label}
    </button>
  )
}

// Markdown 预览弹窗（桌面端居中）
function PreviewDialog({ doc, content, loading, onClose }: {
  doc: MindBankDocument
  content: string | null
  loading: boolean
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="nexus-surface max-h-[80vh] w-full max-w-3xl overflow-y-auto p-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-black text-foreground">{doc.fileName}</h3>
          </div>
          <button type="button" onClick={onClose} className="nexus-button-utility h-9 w-9 text-muted-foreground">✕</button>
        </div>
        <div className="mt-3">
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">加载中…</p>
          ) : content ? (
            <pre className="whitespace-pre-wrap break-words text-xs leading-6 text-foreground">{content}</pre>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">无内容</p>
          )}
        </div>
      </div>
    </div>
  )
}
