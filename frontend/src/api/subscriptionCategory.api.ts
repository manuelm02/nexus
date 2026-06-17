import { apiClient } from './client'
import type { SubscriptionCategory } from '../types/domain.types'
import type { ApiResponse } from '../types/api.types'

export const subscriptionCategoryApi = {
  list: () =>
    apiClient.get<ApiResponse<SubscriptionCategory[]>>('/subscription-categories'),

  create: (name: string) =>
    apiClient.post<ApiResponse<SubscriptionCategory>>('/subscription-categories', { name }),

  delete: (id: string) =>
    apiClient.delete(`/subscription-categories/${id}`),
}
