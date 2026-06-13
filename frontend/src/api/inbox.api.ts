import { apiClient } from './client'
import type { ApiResponse } from '../types/api.types'
import type {
  InboxItem,
  Bookmark,
  InboxDocument,
  QuickNoteRequest,
  QuickNoteResponse,
  Paginated,
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
  },

  // ==================== 笔记（Obsidian） ====================

  notes: {
    /** 写入 Quick Note / Memo 到 Obsidian Vault */
    create: (data: QuickNoteRequest) =>
      apiClient.post<ApiResponse<QuickNoteResponse>>('/inbox/notes', data),
  },
}
