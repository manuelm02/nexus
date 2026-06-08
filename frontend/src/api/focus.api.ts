import { apiClient } from './client'
import type { Focus } from '../types/domain.types'
import type { ApiResponse } from '../types/api.types'

export const focusApi = {
  list: (params?: { status?: string; date?: string }) =>
    apiClient.get<ApiResponse<Focus[]>>('/focus', { params }),

  create: (data: { title: string; description?: string; priority?: string; scheduledDate?: string; dueDate?: string }) =>
    apiClient.post<ApiResponse<Focus>>('/focus', data),

  updateStatus: (id: string, status: string) =>
    apiClient.patch<ApiResponse<Focus>>(`/focus/${id}/status`, { status }),

  update: (id: string, data: Partial<Focus>) =>
    apiClient.patch<ApiResponse<Focus>>(`/focus/${id}`, data),

  delete: (id: string) =>
    apiClient.delete(`/focus/${id}`),
}
