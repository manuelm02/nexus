import { apiClient } from './client'
import type { Ledger } from '../types/domain.types'
import type { ApiResponse } from '../types/api.types'

export const ledgerApi = {
  list: () =>
    apiClient.get<ApiResponse<Ledger[]>>('/ledger'),

  create: (data: Partial<Ledger>) =>
    apiClient.post<ApiResponse<Ledger>>('/ledger', data),

  update: (id: string, data: Partial<Ledger>) =>
    apiClient.patch<ApiResponse<Ledger>>(`/ledger/${id}`, data),

  delete: (id: string) =>
    apiClient.delete(`/ledger/${id}`),

  updateUsage: (id: string, usageUsed: number) =>
    apiClient.patch<ApiResponse<Ledger>>(`/ledger/${id}/usage`, { usageUsed }),
}
