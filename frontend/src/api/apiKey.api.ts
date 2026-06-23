import { apiClient } from './client'
import type { ApiKey, ApiKeyLedgerEntry, ApiKeyBalanceSnapshot } from '../types/domain.types'
import type { ApiResponse } from '../types/api.types'

/** API Key 保险箱接口：管理各平台 API 密钥的存储、余额同步、充消记录 */
export const apiKeyApi = {
  list: () =>
    apiClient.get<ApiResponse<ApiKey[]>>('/api-keys'),

  create: (data: {
    label: string
    provider: string
    apiKey: string
    baseUrl?: string
    planName?: string
    planExpireDate?: string
    subscriptionId?: string
    lowBalanceNotify?: boolean
    lowBalanceThreshold?: number
    notes?: string
  }) =>
    apiClient.post<ApiResponse<ApiKey>>('/api-keys', data),

  update: (id: string, data: Record<string, unknown>) =>
    apiClient.patch<ApiResponse<ApiKey>>(`/api-keys/${id}`, data),

  remove: (id: string) =>
    apiClient.delete(`/api-keys/${id}`),

  recharge: (id: string, data: { amount: number; date?: string; note?: string }) =>
    apiClient.post<ApiResponse<ApiKey>>(`/api-keys/${id}/recharge`, data),

  consume: (id: string, data: { amount: number; note?: string }) =>
    apiClient.post<ApiResponse<ApiKey>>(`/api-keys/${id}/consume`, data),

  syncBalance: (id: string) =>
    apiClient.post<ApiResponse<ApiKey>>(`/api-keys/${id}/sync-balance`),

  ledger: (id: string, limit = 20) =>
    apiClient.get<ApiResponse<ApiKeyLedgerEntry[]>>(`/api-keys/${id}/ledger`, { params: { limit } }),

  balanceHistory: (id: string, days = 30) =>
    apiClient.get<ApiResponse<ApiKeyBalanceSnapshot[]>>(`/api-keys/${id}/balance-history`, { params: { days } }),

  /** 解密返回明文 API Key，用 POST 防止浏览器缓存 */
  revealKey: (id: string) =>
    apiClient.post<ApiResponse<string>>(`/api-keys/${id}/reveal-key`),
}
