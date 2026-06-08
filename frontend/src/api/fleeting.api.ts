import { apiClient } from './client'
import type { Fleeting } from '../types/domain.types'
import type { ApiResponse } from '../types/api.types'

export const fleetingApi = {
  list: () =>
    apiClient.get<ApiResponse<Fleeting[]>>('/fleeting'),

  create: (data: { title?: string; content: string; tags?: string[] }) =>
    apiClient.post<ApiResponse<Fleeting>>('/fleeting', data),

  delete: (id: string) =>
    apiClient.delete(`/fleeting/${id}`),
}
