import { apiClient } from './client'
import type { ApiResponse } from '../types/api.types'
import type { InboxSettings, InboxSettingsUpdateRequest, PaperlessGatewayStatusResponse, MindBankSettings, MindBankSettingsUpdateRequest } from '../types/domain.types'

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

  /** 获取 Mindbank 配置（API Key 类字段脱敏） */
  getMindBankSettings: () =>
    apiClient.get<ApiResponse<MindBankSettings>>('/settings/mindbank'),

  /** 更新 Mindbank 配置（Key 类字段加密存储） */
  updateMindBankSettings: (data: MindBankSettingsUpdateRequest) =>
    apiClient.put<ApiResponse<MindBankSettings>>('/settings/mindbank', data),

  /** 获取 Crawl 服务地址配置 */
  getCrawlSettings: () =>
    apiClient.get<ApiResponse<Record<string, string>>>('/settings/crawl'),

  /** 保存 Crawl 服务地址配置 */
  saveCrawlSettings: (data: Record<string, string>) =>
    apiClient.put<ApiResponse<void>>('/settings/crawl', data),

  /** 获取 Notes 配置 */
  getNotesSettings: () =>
    apiClient.get<ApiResponse<Record<string, string>>>('/settings/notes'),

  /** 保存 Notes 配置 */
  saveNotesSettings: (data: Record<string, string>) =>
    apiClient.put<ApiResponse<void>>('/settings/notes', data),
}
