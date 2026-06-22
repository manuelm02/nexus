import { apiClient } from './client'
import type { ApiResponse } from '../types/api.types'
import type {
  MindBankDocument,
  Workspace,
  CreateWorkspaceRequest,
  UpdateWorkspaceRequest,
  PromptTemplate,
  CreatePromptTemplateRequest,
  UpdatePromptTemplateRequest,
} from '../types/mindbank.types'

/**
 * Mindbank 模块 API 调用层。
 * 路径前缀 /mindbank/...（BASE_URL 已在 client.ts 配置为 /api/v1）。
 */
export const mindbankApi = {
  // ==================== Workspace ====================

  listWorkspaces: () =>
    apiClient.get<ApiResponse<Workspace[]>>('/mindbank/workspaces'),

  createWorkspace: (data: CreateWorkspaceRequest) =>
    apiClient.post<ApiResponse<Workspace>>('/mindbank/workspaces', data),

  updateWorkspace: (id: number, data: UpdateWorkspaceRequest) =>
    apiClient.put<ApiResponse<void>>(`/mindbank/workspaces/${id}`, data),

  deleteWorkspace: (id: number) =>
    apiClient.delete<ApiResponse<void>>(`/mindbank/workspaces/${id}`),

  // ==================== Document ====================

  listDocuments: (workspaceId: number) =>
    apiClient.get<ApiResponse<MindBankDocument[]>>('/mindbank/documents', { params: { workspaceId } }),

  getDocumentStatus: (id: number) =>
    apiClient.get<ApiResponse<MindBankDocument>>(`/mindbank/documents/${id}/status`),

  retryStep: (id: number, step: number) =>
    apiClient.post<ApiResponse<void>>(`/mindbank/documents/${id}/retry-step`, { step }),

  // ==================== Q&A ====================

  /** 基于 Workspace 知识库问答（AnythingLLM 同步返回，非流式） */
  qaChat: (workspaceId: number, question: string) =>
    apiClient.post<ApiResponse<{ answer: string; sources: string[] }>>(
      `/mindbank/qa/${workspaceId}/chat`,
      { question },
    ),

  // ==================== Notes ====================

  /** 读取 Workspace 的 Master Note 内容 */
  getMasterNote: (workspaceId: number) =>
    apiClient.get<ApiResponse<{ content: string | null; path: string | null; message: string | null }>>(
      `/mindbank/workspaces/${workspaceId}/master-note`,
    ),

  /** 读取 Workspace 下所有 Session Note */
  getSessionNotes: (workspaceId: number) =>
    apiClient.get<ApiResponse<{ content: string; path: string; date: string }[]>>(
      `/mindbank/workspaces/${workspaceId}/session-notes`,
    ),

  // ==================== Prompt Templates ====================

  /** 查询 Prompt 模板列表，可按 type 过滤 */
  listPromptTemplates: (type?: string) =>
    apiClient.get<ApiResponse<PromptTemplate[]>>('/mindbank/prompt-templates', {
      params: type ? { type } : {},
    }),

  /** 创建自定义 Prompt 模板 */
  createPromptTemplate: (data: CreatePromptTemplateRequest) =>
    apiClient.post<ApiResponse<PromptTemplate>>('/mindbank/prompt-templates', data),

  /** 更新 Prompt 模板（内置模板不可编辑） */
  updatePromptTemplate: (id: number, data: UpdatePromptTemplateRequest) =>
    apiClient.put<ApiResponse<void>>(`/mindbank/prompt-templates/${id}`, data),

  /** 删除 Prompt 模板（内置模板不可删除） */
  deletePromptTemplate: (id: number) =>
    apiClient.delete<ApiResponse<void>>(`/mindbank/prompt-templates/${id}`),
}
