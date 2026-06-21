import { apiClient } from '../../api/client'
import type { ApiResponse } from '../../types/api.types'
import type { CrawlResult, MindBankDocument, MindBankWorkspace, ImportToMindbankRequest } from './crawl.types'

// Crawl 页面 API 调用，所有接口路径前缀 /crawl（apiClient baseURL 已含 /api/v1）
export const crawlApi = {
  /** 爬取网页（同步等待，最长 60s），返回 Markdown 预览 */
  crawlWeb: (url: string) =>
    apiClient.post<ApiResponse<CrawlResult>>('/crawl/web', null, {
      params: { url },
      timeout: 90000,
    }),

  /** 上传文件转 Markdown（multipart/form-data） */
  uploadFile: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return apiClient.post<ApiResponse<CrawlResult>>('/crawl/file', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    })
  },

  /** 查询未导入到 Workspace 的文件列表 */
  listFiles: () =>
    apiClient.get<ApiResponse<MindBankDocument[]>>('/crawl/files'),

  /** 删除文件（MinIO + DB） */
  deleteFile: (docId: number) =>
    apiClient.delete<ApiResponse<void>>(`/crawl/files/${docId}`),

  /** 导入文件到 Mindbank Workspace */
  importToMindbank: (data: ImportToMindbankRequest) =>
    apiClient.post<ApiResponse<void>>('/crawl/import', data),

  /** 查询所有 Workspace（导入弹窗用） */
  listWorkspaces: () =>
    apiClient.get<ApiResponse<MindBankWorkspace[]>>('/mindbank/workspaces'),
}
