import { apiClient } from './client'
import type { ExchangeRates, Subscription, SubscriptionStats } from '../types/domain.types'
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

  stats: () =>
    apiClient.get<ApiResponse<SubscriptionStats>>('/subscriptions/stats'),

  suggestCategory: (data: { name: string; notes?: string }) =>
    apiClient.post<ApiResponse<{ category: string; isNew: boolean }>>('/subscriptions/category-suggest', data),

  /** 各币种兑 CNY 实时汇率，后端每日缓存刷新一次 */
  exchangeRates: () =>
    apiClient.get<ApiResponse<ExchangeRates>>('/subscriptions/exchange-rates'),
}
