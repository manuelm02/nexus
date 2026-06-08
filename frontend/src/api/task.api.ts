import { apiClient } from './client'
import type { TaskResponse } from '../types/api.types'
import type { ApiResponse } from '../types/api.types'

export const taskApi = {
  list: (params?: { type?: string; status?: string }) =>
    apiClient.get<ApiResponse<TaskResponse[]>>('/tasks', { params }),

  getById: (id: string) =>
    apiClient.get<ApiResponse<TaskResponse>>(`/tasks/${id}`),

  toggleKeep: (id: string) =>
    apiClient.patch<ApiResponse<TaskResponse>>(`/tasks/${id}/keep`),

  delete: (id: string) =>
    apiClient.delete(`/tasks/${id}`),
}
