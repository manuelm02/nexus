import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { inboxApi } from '../../api/inbox.api'
import type {
  Bookmark, QuickNoteResponse,
  BookmarkAnalyzeResponse, BookmarkSmartGroup, BookmarkSmartGroupRequest,
  BookmarkImportPreviewResponse, BookmarkImportCommitRequest,
  NoteAnalyzeResponse,
  ImportAction, ImportDecision, BookmarkGroupPreviewResponse,
} from '../../types/domain.types'
import type { InboxTab } from './inbox.shared'
import { InboxDesktopView } from './InboxDesktopView'
import { InboxMobileView } from './InboxMobileView'

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
    mutationFn: (data: Parameters<typeof inboxApi.bookmarks.create>[0]) => inboxApi.bookmarks.create(data),
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
  const [lastNoteResult, setLastNoteResult] = useState<QuickNoteResponse | null>(null)

  const saveNoteMutation = useMutation({
    mutationFn: (data: Parameters<typeof inboxApi.notes.create>[0]) => inboxApi.notes.create(data),
    onSuccess: (res) => {
      const result = res.data?.data
      if (result) setLastNoteResult(result)
    },
  })

  // 笔记编辑器状态
  const [noteContent, setNoteContent] = useState('')
  const [noteKind, setNoteKind] = useState<'quick_note' | 'memo'>('quick_note')
  const [noteTitle, setNoteTitle] = useState('')
  const [noteTags, setNoteTags] = useState<string[]>([])

  // 笔记 AI 分析
  const [noteAiResult, setNoteAiResult] = useState<NoteAnalyzeResponse | null>(null)

  const analyzeNoteMutation = useMutation({
    mutationFn: (data: Parameters<typeof inboxApi.notes.analyze>[0]) =>
      inboxApi.notes.analyze(data),
    onSuccess: (res) => {
      const result = res.data?.data
      if (result) setNoteAiResult(result)
    },
  })

  const resetNoteAnalyze = () => {
    setNoteAiResult(null)
  }

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

  // Obsidian 配置状态：通过笔记保存错误判断
  const obsidianConfigured = saveNoteMutation.error
    ? (saveNoteMutation.error as { response?: { data?: { errorCode?: string } } })?.response?.data?.errorCode !== 'OBSIDIAN_NOT_CONFIGURED'
    : true

  // 错误信息提取
  const bookmarkError = bookmarkListQuery.isError
  const createError = createBookmarkMutation.isError
    ? (createBookmarkMutation.error as Error)?.message || '保存失败'
    : undefined
  const docError = docListQuery.isError
  const uploadError = uploadDocumentMutation.isError
    ? (uploadDocumentMutation.error as Error)?.message || '上传失败'
    : undefined
  const noteError = saveNoteMutation.isError
    ? (saveNoteMutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message
      || (saveNoteMutation.error as Error)?.message || '保存失败'
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
    },
    onImportPasteSubmit: (text: string) => {
      // 解析粘贴文本为 items
      try {
        const parsed = JSON.parse(text)
        if (Array.isArray(parsed)) {
          const items = parsed.map((p: Record<string, unknown>) => ({
            url: String(p.url || ''),
            title: p.title ? String(p.title) : undefined,
          })).filter((i: { url: string }) => i.url)
          if (items.length > 0) importPreviewMutation.mutate(items)
        }
      } catch {
        // 非 JSON 格式，尝试按行解析
      }
    },
    onImportCommit: () => {
      if (!importPreview) return
      const decisions: ImportDecision[] = importPreview.createItems
        .map((item) => ({
          sourceIndex: item.sourceIndex,
          action: importDecisions.get(item.sourceIndex) || 'create',
        }))
      importCommitMutation.mutate({ importSessionId: importPreview.importSessionId, decisions })
    },
    // 智能分组
    smartGroups,
    onGroupCreate: (data: BookmarkSmartGroupRequest) => createGroupMutation.mutate(data),
    onGroupUpdate: (id: string, data: Partial<BookmarkSmartGroupRequest>) =>
      updateGroupMutation.mutate({ id, data }),
    onGroupDelete: (id: string) => deleteGroupMutation.mutate(id),
    onGroupPreview: (groupId: string) => previewGroupMutation.mutate(groupId),
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

  const noteProps = {
    // 编辑器状态
    noteContent,
    noteTitle,
    noteTags,
    noteKind,
    onContentChange: setNoteContent,
    onTitleChange: setNoteTitle,
    onTagsChange: setNoteTags,
    onKindChange: setNoteKind,
    aiAvailable,
    // AI 分析
    onAnalyze: (data: Parameters<typeof inboxApi.notes.analyze>[0]) => analyzeNoteMutation.mutate(data),
    noteAiResult,
    isAnalyzing: analyzeNoteMutation.isPending,
    onApplySuggestion: (suggestion: NoteAnalyzeResponse) => {
      if (suggestion.suggestedTitle) setNoteTitle(suggestion.suggestedTitle)
      if (suggestion.suggestedKind) setNoteKind(suggestion.suggestedKind as 'quick_note' | 'memo')
      if (suggestion.suggestedTags) setNoteTags(suggestion.suggestedTags)
      setNoteAiResult(null)
    },
    resetAnalyze: resetNoteAnalyze,
    // 原有
    obsidianConfigured,
    onSave: () => {
      setLastNoteResult(null)
      saveNoteMutation.mutate({
        content: noteContent,
        title: noteTitle || undefined,
        kind: noteKind,
        tags: noteTags.length > 0 ? noteTags : undefined,
      })
    },
    isSaving: saveNoteMutation.isPending,
    saveError: noteError,
    lastResult: lastNoteResult,
    onClearResult: () => setLastNoteResult(null),
  }

  return (
    <>
      <InboxDesktopView
        activeTab={activeTab}
        onTabChange={setActiveTab}
        bookmarkProps={bookmarkProps}
        documentProps={documentProps}
        noteProps={noteProps}
      />
      <InboxMobileView
        activeTab={activeTab}
        onTabChange={setActiveTab}
        bookmarkProps={bookmarkProps}
        documentProps={documentProps}
        noteProps={noteProps}
      />
    </>
  )
}
