import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { inboxApi } from '../../api/inbox.api'
import type { Bookmark, QuickNoteResponse } from '../../types/domain.types'
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

  // ==================== 文档状态 ====================
  const docListQuery = useQuery({
    queryKey: ['inbox', 'documents'],
    queryFn: () => inboxApi.documents.list(1, 50),
    enabled: activeTab === 'documents',
  })

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

  // ==================== 数据提取 ====================
  const bookmarkData = bookmarkListQuery.data?.data?.data
  const docData = docListQuery.data?.data?.data ?? []
  const docErrorCode = (docListQuery.data?.data as { errorCode?: string } | undefined)?.errorCode

  // paperless 配置状态：通过接口错误码判断
  const paperlessConfigured = docErrorCode !== 'PAPERLESS_NOT_CONFIGURED'

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
    bookmarks: bookmarkData,
    isLoading: bookmarkListQuery.isLoading,
    isError: bookmarkError,
    queryParams: bookmarkQuery,
    onQueryChange: (partial: Partial<typeof bookmarkQuery>) =>
      setBookmarkQuery((prev) => ({ ...prev, ...partial })),
    onCreate: (data: Parameters<typeof inboxApi.bookmarks.create>[0]) => createBookmarkMutation.mutate(data),
    onUpdate: (id: string, data: Partial<Bookmark>) => updateBookmarkMutation.mutate({ id, data }),
    onDelete: (id: string) => deleteBookmarkMutation.mutate(id),
    isCreating: createBookmarkMutation.isPending,
    createError,
  }

  const documentProps = {
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
    obsidianConfigured,
    onSave: (data: Parameters<typeof inboxApi.notes.create>[0]) => {
      setLastNoteResult(null)
      saveNoteMutation.mutate(data)
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
