import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { crawlApi } from './crawl.api'
import type { MindBankDocument } from './crawl.types'
import { CrawlDesktopView } from './CrawlDesktopView'
import { CrawlMobileView } from './CrawlMobileView'

type CrawlTab = 'web' | 'file'

// CrawlPage 编排网页爬取、文件上传、MinIO 文件列表和导入 Mindbank 的全流程业务逻辑。
// 桌面端和移动端共用同一套 query/mutation，仅视图层拆分。
export default function CrawlPage() {
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<CrawlTab>('web')
  const [crawlResult, setCrawlResult] = useState<string | null>(null)
  const [crawlError, setCrawlError] = useState<string | null>(null)
  const [uploadResult, setUploadResult] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [importDocId, setImportDocId] = useState<number | null>(null)
  const [previewDoc, setPreviewDoc] = useState<MindBankDocument | null>(null)
  const [previewContent, setPreviewContent] = useState<string | null>(null)

  // --- 文件列表查询 ---
  const filesQuery = useQuery({
    queryKey: ['crawl-files'],
    queryFn: () => crawlApi.listFiles(),
  })
  const files = filesQuery.data?.data?.data ?? []

  // --- Workspace 列表查询（导入弹窗用，按需加载） ---
  const workspacesQuery = useQuery({
    queryKey: ['mindbank-workspaces'],
    queryFn: () => crawlApi.listWorkspaces(),
    enabled: importOpen,
  })
  const workspaces = workspacesQuery.data?.data?.data ?? []

  // --- 网页爬取 mutation ---
  const crawlMutation = useMutation({
    mutationFn: (url: string) => crawlApi.crawlWeb(url),
    onSuccess: (res) => {
      const data = res.data?.data
      if (data) {
        setCrawlResult(data.markdownPreview)
        setCrawlError(null)
        qc.invalidateQueries({ queryKey: ['crawl-files'] })
      }
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : '爬取失败'
      // axios 错误可能包含后端错误信息
      const axiosErr = err as { response?: { data?: { message?: string } } }
      setCrawlError(axiosErr.response?.data?.message ?? msg)
    },
  })

  // --- 文件上传 mutation ---
  const uploadMutation = useMutation({
    mutationFn: (file: File) => crawlApi.uploadFile(file),
    onSuccess: (res) => {
      const data = res.data?.data
      if (data) {
        setUploadResult(data.markdownPreview)
        setUploadError(null)
        qc.invalidateQueries({ queryKey: ['crawl-files'] })
      }
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { message?: string } } }
      setUploadError(axiosErr.response?.data?.message ?? '上传失败')
    },
  })

  // --- 删除文件 mutation ---
  const deleteMutation = useMutation({
    mutationFn: (docId: number) => crawlApi.deleteFile(docId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['crawl-files'] }),
  })

  // --- 导入 Mindbank mutation ---
  const importMutation = useMutation({
    mutationFn: (workspaceId: number) => {
      if (importDocId == null) throw new Error('未选择文档')
      return crawlApi.importToMindbank({ docId: importDocId, workspaceId })
    },
    onSuccess: () => {
      setImportOpen(false)
      setImportDocId(null)
      qc.invalidateQueries({ queryKey: ['crawl-files'] })
    },
  })

  // --- 预览 Markdown ---
  // 后端未提供按 docId 读取完整 Markdown 的接口，这里展示文件元信息。
  // 完整 Markdown 预览待后续 Phase 补充读取接口。
  const handlePreview = (doc: MindBankDocument) => {
    setPreviewDoc(doc)
    setPreviewContent(
      `文件名：${doc.fileName}\n来源：${doc.sourceType === 'crawl_web' ? '网页爬取' : '文件上传'}\nMinIO Key：${doc.processedMinioKey ?? '未处理'}\n创建时间：${doc.createdAt}\n\n（完整 Markdown 内容预览待后续接口支持）`
    )
  }

  // --- 触发导入弹窗 ---
  const handleImportClick = (docId: number) => {
    setImportDocId(docId)
    setImportOpen(true)
  }

  // --- 共享视图 Props ---
  const sharedProps = {
    activeTab,
    onTabChange: setActiveTab,
    crawlResult,
    crawlPending: crawlMutation.isPending,
    crawlError,
    onCrawl: (url: string) => {
      setCrawlResult(null)
      setCrawlError(null)
      crawlMutation.mutate(url)
    },
    uploadResult,
    uploadPending: uploadMutation.isPending,
    uploadError,
    onUpload: (file: File) => {
      setUploadResult(null)
      setUploadError(null)
      uploadMutation.mutate(file)
    },
    files,
    filesLoading: filesQuery.isLoading,
    deletingId: deleteMutation.isPending ? (deleteMutation.variables as number) ?? null : null,
    onDelete: (docId: number) => deleteMutation.mutate(docId),
    onPreview: handlePreview,
    importOpen,
    onImportOpenChange: setImportOpen,
    onImportClick: handleImportClick,
    workspaces,
    workspacesLoading: workspacesQuery.isLoading,
    importing: importMutation.isPending,
    onImportConfirm: (workspaceId: number) => importMutation.mutate(workspaceId),
    previewDoc,
    onPreviewClose: () => { setPreviewDoc(null); setPreviewContent(null) },
    previewContent,
    previewLoading: false,
  }

  return (
    <div className="nexus-page-enter mx-auto w-full max-w-[1180px] p-4 md:p-6">
      <CrawlDesktopView {...sharedProps} />
      <CrawlMobileView {...sharedProps} />
    </div>
  )
}
