import { apiClient } from './client'
import type { ApiResponse } from '../types/api.types'
import type {
  InboxItem,
  Bookmark,
  InboxDocument,
  QuickNoteRequest,
  QuickNoteResponse,
  Paginated,
  BookmarkAnalyzeRequest,
  BookmarkAnalyzeResponse,
  BookmarkImportPreviewRequest,
  BookmarkImportPreviewResponse,
  BookmarkImportCommitRequest,
  BookmarkImportCommitResponse,
  BookmarkTagSummaryResponse,
  BookmarkSmartGroup,
  BookmarkSmartGroupRequest,
  BookmarkGroupPreviewRequest,
  BookmarkGroupPreviewResponse,
  BookmarkGroupApplyRequest,
  PaperlessGatewayStatusResponse,
  NoteAnalyzeRequest,
  NoteAnalyzeResponse,
  NoteTagEntry,
  NoteSummarizeRequest,
  NoteSummarizeResponse,
  NoteReorganizeRequest,
  NoteReorganizeResponse,
} from '../types/domain.types'

export const inboxApi = {
  // ==================== 旧 inbox_items（兼容） ====================

  list: () =>
    apiClient.get<ApiResponse<InboxItem[]>>('/inbox'),

  create: (data: { title?: string; content: string; tags?: string[] }) =>
    apiClient.post<ApiResponse<InboxItem>>('/inbox', data),

  delete: (id: string) =>
    apiClient.delete(`/inbox/${id}`),

  // ==================== 书签 ====================

  bookmarks: {
    /** 分页查询书签列表，支持关键词搜索、标签筛选、未读/归档过滤 */
    list: (params?: {
      q?: string
      tag?: string
      archived?: boolean
      unread?: boolean
      page?: number
      size?: number
    }) =>
      apiClient.get<ApiResponse<Paginated<Bookmark>>>('/inbox/bookmarks', { params }),

    /** 创建书签 */
    create: (data: { url: string; title?: string; description?: string; notes?: string; tags?: string[] }) =>
      apiClient.post<ApiResponse<Bookmark>>('/inbox/bookmarks', data),

    /** 局部更新书签 */
    update: (id: string, data: {
      title?: string
      description?: string
      notes?: string
      tags?: string[]
      unread?: boolean
      archived?: boolean
    }) =>
      apiClient.patch<ApiResponse<Bookmark>>(`/inbox/bookmarks/${id}`, data),

    /** 删除书签 */
    delete: (id: string) =>
      apiClient.delete(`/inbox/bookmarks/${id}`),

    /** AI 分析书签 URL */
    analyze: (data: BookmarkAnalyzeRequest) =>
      apiClient.post<ApiResponse<BookmarkAnalyzeResponse>>('/inbox/bookmarks/analyze', data),

    /** 批量导入预览 */
    importPreview: (data: BookmarkImportPreviewRequest) =>
      apiClient.post<ApiResponse<BookmarkImportPreviewResponse>>('/inbox/bookmarks/import/preview', data),

    /** 批量导入提交 */
    importCommit: (data: BookmarkImportCommitRequest) =>
      apiClient.post<ApiResponse<BookmarkImportCommitResponse>>('/inbox/bookmarks/import/commit', data),

    /** 获取标签汇总 */
    tags: () =>
      apiClient.get<ApiResponse<BookmarkTagSummaryResponse>>('/inbox/bookmarks/tags'),

    /** AI 标签建议 */
    suggestTags: () =>
      apiClient.post<ApiResponse<BookmarkTagSummaryResponse>>('/inbox/bookmarks/tags/suggest'),

    /** 获取智能分组列表 */
    listGroups: () =>
      apiClient.get<ApiResponse<BookmarkSmartGroup[]>>('/inbox/bookmarks/groups'),

    /** 创建智能分组 */
    createGroup: (data: BookmarkSmartGroupRequest) =>
      apiClient.post<ApiResponse<BookmarkSmartGroup>>('/inbox/bookmarks/groups', data),

    /** 更新智能分组 */
    updateGroup: (id: string, data: BookmarkSmartGroupRequest) =>
      apiClient.patch<ApiResponse<BookmarkSmartGroup>>(`/inbox/bookmarks/groups/${id}`, data),

    /** 删除智能分组 */
    deleteGroup: (id: string) =>
      apiClient.delete(`/inbox/bookmarks/groups/${id}`),

    /** 预览分组匹配 */
    previewGroups: (data: BookmarkGroupPreviewRequest) =>
      apiClient.post<ApiResponse<BookmarkGroupPreviewResponse>>('/inbox/bookmarks/groups/preview', data),

    /** 应用分组分配 */
    applyGroups: (data: BookmarkGroupApplyRequest) =>
      apiClient.post<ApiResponse<void>>('/inbox/bookmarks/groups/apply', data),
  },

  // ==================== 文档（paperless-ngx） ====================

  documents: {
    /** 获取文档列表 */
    list: (page = 1, size = 20) =>
      apiClient.get<ApiResponse<InboxDocument[]>>('/inbox/documents', { params: { page, size } }),

    /** 上传文件到 paperless-ngx */
    upload: (file: File, title?: string, tags?: string[]) => {
      const form = new FormData()
      form.append('file', file)
      if (title) form.append('title', title)
      if (tags && tags.length > 0) tags.forEach((t) => form.append('tags', t))
      return apiClient.post<ApiResponse<InboxDocument>>('/inbox/documents', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    },

    /** 获取文档详情 */
    detail: (id: string) =>
      apiClient.get<ApiResponse<InboxDocument>>(`/inbox/documents/${id}`),

    /** 获取 paperless 网关状态 */
    status: () =>
      apiClient.get<ApiResponse<PaperlessGatewayStatusResponse>>('/inbox/documents/status'),
  },

  // ==================== 笔记（Obsidian） ====================

  notes: {
    /** 写入 Quick Note / Memo 到 Obsidian Vault */
    create: (data: QuickNoteRequest) =>
      apiClient.post<ApiResponse<QuickNoteResponse>>('/inbox/notes', data),

    /** AI 分析笔记 */
    analyze: (data: NoteAnalyzeRequest) =>
      apiClient.post<ApiResponse<NoteAnalyzeResponse>>('/inbox/notes/analyze', data),

    /** 获取指定类型（quick_note/memo）的标签索引列表 */
    tags: (kind: 'quick_note' | 'memo') =>
      apiClient.get<ApiResponse<NoteTagEntry[]>>('/inbox/notes/tags', { params: { kind } }),

    /** 按标题关键词 + 标签筛选笔记，生成 AI 汇总 Markdown */
    summarize: (data: NoteSummarizeRequest) =>
      apiClient.post<ApiResponse<NoteSummarizeResponse>>('/inbox/notes/summarize', data),

    /** 手动触发：AI 重新评估并归位指定类型下所有笔记的标签 */
    reorganizeTags: (data: NoteReorganizeRequest) =>
      apiClient.post<ApiResponse<NoteReorganizeResponse>>('/inbox/notes/reorganize-tags', data),
  },
}
