import { apiClient } from './client'
import type { Credential } from '../types/domain.types'
import type { ApiResponse } from '../types/api.types'

/** 账号凭据管理接口：管理各平台登录账号、密码和 TOTP 密钥的加密存储 */
export const credentialApi = {
  list: () =>
    apiClient.get<ApiResponse<Credential[]>>('/credentials'),

  create: (data: {
    platform: string
    label?: string
    category?: string
    username?: string
    password?: string
    totpSecret?: string
    url?: string
    expireDate?: string
    subscriptionId?: string
    notes?: string
  }) =>
    apiClient.post<ApiResponse<Credential>>('/credentials', data),

  update: (id: string, data: Record<string, unknown>) =>
    apiClient.patch<ApiResponse<Credential>>(`/credentials/${id}`, data),

  remove: (id: string) =>
    apiClient.delete(`/credentials/${id}`),

  /** 解密返回明文密码，用 POST 防止浏览器缓存 */
  revealPassword: (id: string) =>
    apiClient.post<ApiResponse<string>>(`/credentials/${id}/reveal-password`),

  /** 解密返回明文 TOTP 密钥，用 POST 防止浏览器缓存 */
  revealTotp: (id: string) =>
    apiClient.post<ApiResponse<string>>(`/credentials/${id}/reveal-totp`),
}
