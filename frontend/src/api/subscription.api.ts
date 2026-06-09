import { apiClient } from './client'
import type { Subscription } from '../types/domain.types'
import type { ApiResponse } from '../types/api.types'

export const subscriptionApi = {
  list: () =>
    apiClient.get<ApiResponse<Subscription[]>>('/subscriptions'),

  create: (data: Partial<Subscription>) =>
    apiClient.post<ApiResponse<Subscription>>('/subscriptions', data),

  update: (id: string, data: Partial<Subscription>) =>
    apiClient.patch<ApiResponse<Subscription>>(`/subscriptions/${id}`, data),

  delete: (id: string) =>
    apiClient.delete(`/subscriptions/${id}`),

  updateUsage: (id: string, usageUsed: number) =>
    apiClient.patch<ApiResponse<Subscription>>(`/subscriptions/${id}/usage`, { usageUsed }),
}
