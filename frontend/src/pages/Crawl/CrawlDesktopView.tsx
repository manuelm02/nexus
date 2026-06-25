import { FileText } from 'lucide-react'
import type { MindBankDocument } from './crawl.types'
import { WebCrawlTab } from './components/WebCrawlTab'
import { FileUploadTab } from './components/FileUploadTab'
import { MinioFileList } from './components/MinioFileList'
import { ImportToMindbank } from './components/ImportToMindbank'
import type { MindBankWorkspace } from './crawl.types'
import { PageShell, PageHeader, Tabs } from '@/components/shell'

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

// CrawlDesktopView 桌面端两列布局：主内容 + 右侧文件列表面板，使用 PageShell with-panel 布局。
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
    <div className="hidden md:block">
      {/* 单栏布局：顶部紧凑 intake（输入/上传），下方文件列表占满 —— 取代原来「宽输入卡 + 右侧面板」的失衡布局 */}
      <PageShell
        variant="full"
        header={
          <PageHeader
            eyebrow="INTAKE"
            title="Crawl"
            subtitle="网页爬取、文件上传与转换。"
            actions={
              <Tabs<CrawlTab>
                value={activeTab}
                onChange={onTabChange}
                items={[
                  { value: 'web', label: '网页爬取' },
                  { value: 'file', label: '文件上传' },
                ]}
              />
            }
          />
        }
      >
        <div className="space-y-4">
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
        </div>
      </PageShell>

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
