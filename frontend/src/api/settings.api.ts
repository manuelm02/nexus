import { apiClient } from './client'
import type { ApiResponse } from '../types/api.types'
import type { InboxSettings, InboxSettingsUpdateRequest, PaperlessGatewayStatusResponse } from '../types/domain.types'

export const settingsApi = {
  /** 获取 Inbox 集成设置 */
  getInboxSettings: () =>
    apiClient.get<ApiResponse<InboxSettings>>('/settings/inbox'),

  /** 更新 Inbox 集成设置 */
  updateInboxSettings: (data: InboxSettingsUpdateRequest) =>
    apiClient.patch<ApiResponse<InboxSettings>>('/settings/inbox', data),

  /** 测试 paperless 连接 */
  testPaperless: () =>
    apiClient.post<ApiResponse<PaperlessGatewayStatusResponse>>('/settings/inbox/paperless/test'),

  /** 测试 Obsidian 连接 */
  testObsidian: () =>
    apiClient.post<ApiResponse<{ configured: boolean; status: string; message: string; vaultPath?: string; inboxDir?: string; memoDir?: string; fullPath?: string }>>('/settings/inbox/obsidian/test'),
}
