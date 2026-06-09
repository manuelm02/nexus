import { apiClient } from './client'
import type { InboxItem } from '../types/domain.types'
import type { ApiResponse } from '../types/api.types'

export const inboxApi = {
  list: () =>
    apiClient.get<ApiResponse<InboxItem[]>>('/inbox'),

  create: (data: { title?: string; content: string; tags?: string[] }) =>
    apiClient.post<ApiResponse<InboxItem>>('/inbox', data),

  delete: (id: string) =>
    apiClient.delete(`/inbox/${id}`),
}
