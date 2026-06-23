import { apiClient } from './client'
import type { BalanceSnapshot, ExchangeRates, LedgerEntry, Subscription, SubscriptionStats } from '../types/domain.types'
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

  recharge: (id: string, data: { amount: number; date?: string; note?: string }) =>
    apiClient.post<ApiResponse<Subscription>>(`/subscriptions/${id}/recharge`, data),

  consume: (id: string, data: { amount: number; note?: string }) =>
    apiClient.post<ApiResponse<Subscription>>(`/subscriptions/${id}/consume`, data),

  stats: () =>
    apiClient.get<ApiResponse<SubscriptionStats>>('/subscriptions/stats'),

  suggestCategory: (data: { name: string; notes?: string }) =>
    apiClient.post<ApiResponse<{ category: string; isNew: boolean }>>('/subscriptions/category-suggest', data),

  ledger: (id: string, limit = 10) =>
    apiClient.get<ApiResponse<LedgerEntry[]>>(`/subscriptions/${id}/ledger`, { params: { limit } }),

  syncBalance: (id: string) =>
    apiClient.post<ApiResponse<Subscription>>(`/subscriptions/${id}/sync-balance`),

  balanceHistory: (id: string, days = 30) =>
    apiClient.get<ApiResponse<BalanceSnapshot[]>>(`/subscriptions/${id}/balance-history`, { params: { days } }),

  createUsageAccount: (data: {
    name: string
    category?: string
    apiProvider: string
    apiKey: string
    lowBalanceNotify?: boolean
    lowBalanceThreshold?: number
    notes?: string
  }) =>
    apiClient.post<ApiResponse<Subscription>>('/subscriptions', { ...data, billingType: 'per_token' }),

  /** 各币种兑 CNY 实时汇率，后端每日缓存刷新一次 */
  exchangeRates: () =>
    apiClient.get<ApiResponse<ExchangeRates>>('/subscriptions/exchange-rates'),
}
