import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { inboxApi } from '../../api/inbox.api'
import type {
  Bookmark,
  BookmarkAnalyzeResponse, BookmarkSmartGroup, BookmarkSmartGroupRequest,
  BookmarkImportPreviewResponse, BookmarkImportCommitRequest,
  ImportAction, ImportDecision, BookmarkGroupPreviewResponse,
} from '../../types/domain.types'
import type { InboxTab } from './inbox.shared'
import { InboxDesktopView } from './InboxDesktopView'
import { InboxMobileView } from './InboxMobileView'
import { useNoteSection } from './hooks/useNoteSection'

/**
 * 解析批量导入粘贴文本，支持三种格式：
 * 1. JSON 数组：[{"url":"...","title":"..."}]
 * 2. YAML-like：- url: ... \n  title: ...
 * 3. 纯 URL 逐行（可在 URL 后跟一个空格分隔的标题）
 * 解析失败或没有有效 URL 时返回 error，调用方不应继续调用预览接口。
 */
function parseBookmarkImportText(text: string): { items: { url: string; title?: string }[]; error?: string } {
  const trimmed = text.trim()
  if (!trimmed) return { items: [], error: '请输入要导入的书签内容' }

  // JSON 数组格式
  if (trimmed.startsWith('[')) {
    let parsed: unknown
    try {
      parsed = JSON.parse(trimmed)
    } catch {
      return { items: [], error: 'JSON 格式解析失败，请检查语法' }
    }
    if (!Array.isArray(parsed)) {
      return { items: [], error: 'JSON 内容必须是数组' }
    }
    const items = parsed
      .map((p) => {
        const obj = p as Record<string, unknown>
        return {
          url: String(obj?.url || '').trim(),
          title: obj?.title ? String(obj.title) : undefined,
        }
      })
      .filter((i) => i.url)
    if (items.length === 0) return { items: [], error: 'JSON 中未找到有效的 url 字段' }
    return { items }
  }

  const lines = trimmed.split('\n')

  // YAML-like 格式："- url: ..." 后续行可带 "  title: ..."
  if (lines.some((l) => /^\s*-\s*url\s*:/i.test(l))) {
    const items: { url: string; title?: string }[] = []
    let current: { url?: string; title?: string } | null = null
    for (const line of lines) {
      const urlMatch = line.match(/^\s*-\s*url\s*:\s*(.+)$/i)
      const titleMatch = line.match(/^\s*title\s*:\s*(.+)$/i)
      if (urlMatch) {
        if (current?.url) items.push({ url: current.url, title: current.title })
        current = { url: urlMatch[1].trim() }
      } else if (titleMatch && current) {
        current.title = titleMatch[1].trim()
      }
    }
    if (current?.url) items.push({ url: current.url, title: current.title })
    const valid = items.filter((i) => i.url)
    if (valid.length === 0) return { items: [], error: 'YAML 格式中未找到有效的 url 字段' }
    return { items: valid }
  }

  // 纯 URL 逐行，URL 后可跟空格分隔的标题
  const items = lines
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const spaceIdx = line.search(/\s/)
      if (spaceIdx === -1) return { url: line }
      return { url: line.slice(0, spaceIdx), title: line.slice(spaceIdx + 1).trim() || undefined }
    })
    .filter((i) => /^https?:\/\//i.test(i.url))

  if (items.length === 0) return { items: [], error: '未识别到有效的 URL（需以 http:// 或 https:// 开头）' }
  return { items }
}

// InboxPage 承载 Inbox 三 tab（书签/文档/笔记）的数据编排，业务逻辑单写一套，视图拆分到 DesktopView / MobileView。
export default function InboxPage() {
  const [activeTab, setActiveTab] = useState<InboxTab>('bookmarks')
  const qc = useQueryClient()

  // ==================== 书签状态 ====================
  const [bookmarkQuery, setBookmarkQuery] = useState({
    page: 1,
    size: 20,
    q: undefined as string | undefined,
    tag: undefined as string | undefined,
    archived: undefined as boolean | undefined,
    unread: undefined as boolean | undefined,
  })

  const bookmarkListQuery = useQuery({
    queryKey: ['inbox', 'bookmarks', bookmarkQuery],
    queryFn: () => inboxApi.bookmarks.list(bookmarkQuery),
  })

  const createBookmarkMutation = useMutation({
    mutationFn: async (data: Parameters<typeof inboxApi.bookmarks.create>[0]) => {
      const res = await inboxApi.bookmarks.create(data)
      // 后端业务异常以 HTTP 200 + success:false 返回，需手动转为 mutation error 才能驱动 UI 错误态
      if (!res.data.success) {
        throw new Error(res.data.message || '保存失败')
      }
      return res
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inbox', 'bookmarks'] })
    },
  })

  const updateBookmarkMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Bookmark> }) => inboxApi.bookmarks.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inbox', 'bookmarks'] })
    },
  })

  const deleteBookmarkMutation = useMutation({
    mutationFn: (id: string) => inboxApi.bookmarks.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inbox', 'bookmarks'] })
    },
  })

  // ==================== 书签 AI 分析 ====================
  const [captureUrl, setCaptureUrl] = useState('')
  const [captureTitle, setCaptureTitle] = useState('')
  const [analyzeResult, setAnalyzeResult] = useState<BookmarkAnalyzeResponse | null>(null)
  const [editedTitle, setEditedTitle] = useState('')
  const [editedDescription, setEditedDescription] = useState('')
  const [editedTags, setEditedTags] = useState<string[]>([])

  const analyzeBookmarkMutation = useMutation({
    mutationFn: (data: { url: string; title?: string; existingTags?: string[] }) =>
      inboxApi.bookmarks.analyze(data),
    onSuccess: (res) => {
      const result = res.data?.data
      if (result) {
        setAnalyzeResult(result)
        setEditedTitle(result.suggestedTitle || captureTitle || '')
        setEditedDescription(result.suggestedDescription || '')
        setEditedTags(result.suggestedTags || [])
      }
    },
  })

  const resetBookmarkAnalyze = () => {
    setAnalyzeResult(null)
    setEditedTitle('')
    setEditedDescription('')
    setEditedTags([])
  }

  // ==================== 书签批量导入 ====================
  const [showImportDrawer, setShowImportDrawer] = useState(false)
  const [importPreview, setImportPreview] = useState<BookmarkImportPreviewResponse | null>(null)
  const [importDecisions, setImportDecisions] = useState<Map<number, ImportAction>>(new Map())
  const [importParseError, setImportParseError] = useState<string | undefined>(undefined)

  const importPreviewMutation = useMutation({
    mutationFn: (items: { url: string; title?: string }[]) =>
      inboxApi.bookmarks.importPreview({ items }),
    onSuccess: (res) => {
      const result = res.data?.data
      if (result) setImportPreview(result)
    },
  })

  const importCommitMutation = useMutation({
    mutationFn: (data: BookmarkImportCommitRequest) =>
      inboxApi.bookmarks.importCommit(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inbox', 'bookmarks'] })
      qc.invalidateQueries({ queryKey: ['inbox', 'bookmarks', 'groups'] })
      setImportPreview(null)
      setShowImportDrawer(false)
      setImportDecisions(new Map())
    },
  })

  // ==================== 书签智能分组 ====================
  const smartGroupsQuery = useQuery({
    queryKey: ['inbox', 'bookmarks', 'groups'],
    queryFn: () => inboxApi.bookmarks.listGroups(),
  })

  const smartGroups: BookmarkSmartGroup[] = smartGroupsQuery.data?.data?.data ?? []

  const createGroupMutation = useMutation({
    mutationFn: (data: BookmarkSmartGroupRequest) => inboxApi.bookmarks.createGroup(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inbox', 'bookmarks', 'groups'] }),
  })

  const updateGroupMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<BookmarkSmartGroupRequest> }) =>
      inboxApi.bookmarks.updateGroup(id, data as BookmarkSmartGroupRequest),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inbox', 'bookmarks', 'groups'] }),
  })

  const deleteGroupMutation = useMutation({
    mutationFn: (id: string) => inboxApi.bookmarks.deleteGroup(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inbox', 'bookmarks', 'groups'] }),
  })

  const [groupPreviewResult, setGroupPreviewResult] = useState<BookmarkGroupPreviewResponse | null>(null)

  const previewGroupMutation = useMutation({
    mutationFn: (groupId: string) =>
      inboxApi.bookmarks.previewGroups({ groupIds: [groupId] }),
    onSuccess: (res) => {
      const result = res.data?.data
      if (result) setGroupPreviewResult(result)
    },
  })

  const applyGroupMutation = useMutation({
    mutationFn: (data: { bookmarkIds: string[]; groupIds: string[] }) =>
      inboxApi.bookmarks.applyGroups(data),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['inbox', 'bookmarks'] })
      qc.invalidateQueries({ queryKey: ['inbox', 'bookmarks', 'groups'] })
      if (variables.groupIds[0]) {
        previewGroupMutation.mutate(variables.groupIds[0])
      }
    },
  })

  // ==================== 文档状态 ====================
  const docListQuery = useQuery({
    queryKey: ['inbox', 'documents'],
    queryFn: () => inboxApi.documents.list(1, 50),
    enabled: activeTab === 'documents',
  })

  const docStatusQuery = useQuery({
    queryKey: ['inbox', 'documents', 'status'],
    queryFn: () => inboxApi.documents.status(),
    staleTime: 30000,
  })

  const gatewayStatus = docStatusQuery.data?.data?.data

  const uploadDocumentMutation = useMutation({
    mutationFn: ({ file, title, tags }: { file: File; title?: string; tags?: string[] }) =>
      inboxApi.documents.upload(file, title, tags),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inbox', 'documents'] })
    },
  })

  // ==================== 笔记状态 ====================
  // 速记 / 备忘录状态完全隔离，分别由各自的 useNoteSection 实例管理
  const quickNoteSection = useNoteSection('quick_note')
  const memoSection = useNoteSection('memo')

  // ==================== 数据提取 ====================
  const bookmarkData = bookmarkListQuery.data?.data?.data
  const docData = docListQuery.data?.data?.data ?? []
  const docErrorCode = (docListQuery.data?.data as { errorCode?: string } | undefined)?.errorCode

  // paperless 配置状态：通过接口错误码判断
  const paperlessConfigured = docErrorCode !== 'PAPERLESS_NOT_CONFIGURED'

  // 网关状态字符串映射
  const gatewayStatusString: 'connected' | 'not_configured' | 'unauthorized' | 'unreachable' = !gatewayStatus
    ? 'not_configured'
    : !gatewayStatus.configured
      ? 'not_configured'
      : !gatewayStatus.reachable
        ? 'unreachable'
        : 'connected'

  // 网关入口链接
  const entryLinks = gatewayStatus?.entryLinks ?? []

  // AI 可用性：默认 true，具体可用性由后端接口判断
  const aiAvailable = true

  // 错误信息提取
  const bookmarkError = bookmarkListQuery.isError
  const createError = createBookmarkMutation.isError
    ? (createBookmarkMutation.error as Error)?.message || '保存失败'
    : undefined
  const docError = docListQuery.isError
  const uploadError = uploadDocumentMutation.isError
    ? (uploadDocumentMutation.error as Error)?.message || '上传失败'
    : undefined
  // ==================== Props 组装 ====================
  const bookmarkProps = {
    // 捕获奖态
    captureUrl,
    captureTitle,
    onCaptureUrlChange: setCaptureUrl,
    onCaptureTitleChange: setCaptureTitle,
    // AI 分析
    onAnalyze: (url: string, title?: string) => {
      setCaptureUrl(url)
      setCaptureTitle(title || '')
      analyzeBookmarkMutation.mutate({ url, title, existingTags: [] })
    },
    analyzeResult,
    isAnalyzing: analyzeBookmarkMutation.isPending,
    resetAnalyze: resetBookmarkAnalyze,
    editedTitle,
    editedDescription,
    editedTags,
    onEditedTitleChange: setEditedTitle,
    onEditedDescriptionChange: setEditedDescription,
    onEditedTagsChange: setEditedTags,
    aiAvailable,
    // 批量导入
    showImportDrawer,
    importPreview,
    isPreViewImporting: importPreviewMutation.isPending,
    isImportCommitting: importCommitMutation.isPending,
    importDecisions,
    onImportDecisionChange: (sourceIndex: number, action: ImportAction) => {
      setImportDecisions((prev) => {
        const next = new Map(prev)
        next.set(sourceIndex, action)
        return next
      })
    },
    onOpenImport: () => setShowImportDrawer(true),
    onCloseImport: () => {
      setShowImportDrawer(false)
      setImportPreview(null)
      setImportDecisions(new Map())
      setImportParseError(undefined)
    },
    onImportPasteSubmit: (text: string) => {
      // 解析粘贴文本为 items：支持 JSON 数组 / YAML-like / 纯 URL 逐行
      const { items, error } = parseBookmarkImportText(text)
      if (error) {
        setImportParseError(error)
        return
      }
      setImportParseError(undefined)
      importPreviewMutation.mutate(items)
    },
    previewError: importParseError,
    commitError: importCommitMutation.isError
      ? (importCommitMutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message
        || (importCommitMutation.error as Error)?.message || '导入提交失败'
      : undefined,
    onImportCommit: () => {
      if (!importPreview) return
      const decisions: ImportDecision[] = [
        // 将创建项：默认 action 为 create，并带上 AI 建议字段供后端落库
        ...importPreview.createItems.map((item) => ({
          sourceIndex: item.sourceIndex,
          action: 'create' as ImportAction,
          finalTitle: item.suggestedTitle,
          finalDescription: item.suggestedDescription,
          finalTags: item.suggestedTags,
          acceptSuggestedGroup: Boolean(item.suggestedGroupId),
        })),
        // 冲突项：按用户决策提交，未决策默认跳过
        ...importPreview.conflictItems.map((item) => ({
          sourceIndex: item.sourceIndex,
          action: importDecisions.get(item.sourceIndex) || 'skip',
        })),
      ]
      importCommitMutation.mutate({ importSessionId: importPreview.importSessionId, decisions })
    },
    // 智能分组
    smartGroups,
    onGroupCreate: (data: BookmarkSmartGroupRequest) => createGroupMutation.mutate(data),
    onGroupUpdate: (id: string, data: Partial<BookmarkSmartGroupRequest>) =>
      updateGroupMutation.mutate({ id, data }),
    onGroupDelete: (id: string) => deleteGroupMutation.mutate(id),
    onGroupPreview: (groupId: string) => previewGroupMutation.mutate(groupId),
    onGroupApply: (bookmarkIds: string[], groupIds: string[]) => {
      if (bookmarkIds.length === 0 || groupIds.length === 0) return
      applyGroupMutation.mutate({ bookmarkIds, groupIds })
    },
    isApplyingGroup: applyGroupMutation.isPending,
    groupApplyError: applyGroupMutation.isError
      ? (applyGroupMutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message
        || (applyGroupMutation.error as Error)?.message || '分组应用失败'
      : undefined,
    groupPreviewResult: groupPreviewResult
      ? {
          groupId: groupPreviewResult.groups[0]?.groupId || '',
          matchedBookmarks: groupPreviewResult.groups[0]?.matchedBookmarks || [],
        }
      : null,
    isPreviewingGroup: previewGroupMutation.isPending,
    // 原有
    bookmarks: bookmarkData,
    isLoading: bookmarkListQuery.isLoading,
    isError: bookmarkError,
    queryParams: bookmarkQuery,
    onQueryChange: (partial: Partial<typeof bookmarkQuery>) =>
      setBookmarkQuery((prev) => ({ ...prev, ...partial })),
    onCreate: (data: Parameters<typeof inboxApi.bookmarks.create>[0]) => {
      createBookmarkMutation.mutate(data)
      setCaptureUrl('')
      setCaptureTitle('')
    },
    onUpdate: (id: string, data: Partial<Bookmark>) => updateBookmarkMutation.mutate({ id, data }),
    onDelete: (id: string) => deleteBookmarkMutation.mutate(id),
    isCreating: createBookmarkMutation.isPending,
    createError,
  }

  const documentProps = {
    // 网关状态
    gatewayStatus: gatewayStatusString,
    lastChecked: gatewayStatus ? new Date().toISOString() : undefined,
    entryLinks,
    // 原有
    documents: docData,
    isLoading: docListQuery.isLoading,
    isError: docError,
    errorCode: docErrorCode,
    paperlessConfigured,
    onUpload: (file: File, title?: string, tags?: string[]) =>
      uploadDocumentMutation.mutate({ file, title, tags }),
    isUploading: uploadDocumentMutation.isPending,
    uploadError,
  }

  return (
    <div className="nexus-page-enter p-4 md:p-0">
      <div className="hidden md:block">
        <InboxDesktopView
          activeTab={activeTab}
          onTabChange={setActiveTab}
          bookmarkProps={bookmarkProps}
          documentProps={documentProps}
          quickNoteProps={quickNoteSection}
          memoProps={memoSection}
        />
      </div>
      <div className="md:hidden">
        <InboxMobileView
          activeTab={activeTab}
          onTabChange={setActiveTab}
          bookmarkProps={bookmarkProps}
          documentProps={documentProps}
          quickNoteProps={quickNoteSection}
          memoProps={memoSection}
        />
      </div>
    </div>
  )
}
