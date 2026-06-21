import { apiClient } from './client'
import type { ApiResponse } from '../types/api.types'
import type { MindBankDocument, Workspace, CreateWorkspaceRequest, UpdateWorkspaceRequest } from '../types/mindbank.types'

/**
 * Mindbank 模块 API 调用层。
 * 路径前缀 /mindbank/...（BASE_URL 已在 client.ts 配置为 /api/v1）。
 */
export const mindbankApi = {
  // ==================== Workspace ====================

  /** 查询所有 Workspace（含 documentCount） */
  listWorkspaces: () =>
    apiClient.get<ApiResponse<Workspace[]>>('/mindbank/workspaces'),

  /** 新建 Workspace：联动 AnythingLLM 创建工作空间，失败不阻断 */
  createWorkspace: (data: CreateWorkspaceRequest) =>
    apiClient.post<ApiResponse<Workspace>>('/mindbank/workspaces', data),

  /** 更新 Workspace 基础信息（name/domainTag/description） */
  updateWorkspace: (id: number, data: UpdateWorkspaceRequest) =>
    apiClient.put<ApiResponse<void>>(`/mindbank/workspaces/${id}`, data),

  /** 删除 Workspace：仅删 DB 记录，AnythingLLM workspace 保留便于恢复 */
  deleteWorkspace: (id: number) =>
    apiClient.delete<ApiResponse<void>>(`/mindbank/workspaces/${id}`),

  // ==================== Document ====================

  /** 查询指定 workspace 的文档列表 */
  listDocuments: (workspaceId: number) =>
    apiClient.get<ApiResponse<MindBankDocument[]>>('/mindbank/documents', { params: { workspaceId } }),

  /** 查询单个文档的 5 步流水线状态，用于轮询 */
  getDocumentStatus: (id: number) =>
    apiClient.get<ApiResponse<MindBankDocument>>(`/mindbank/documents/${id}/status`),

  /** 重置指定步骤及后续步骤状态为 pending（Phase 6.6 接入 Pipeline 后会触发实际重跑） */
  retryStep: (id: number, step: number) =>
    apiClient.post<ApiResponse<void>>(`/mindbank/documents/${id}/retry-step`, { step }),
}
