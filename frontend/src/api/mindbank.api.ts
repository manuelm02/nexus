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
  AgentTask,
  AgentTaskDetail,
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

  /**
   * 基于 Workspace 知识库问答。
   * agentMode=false（默认）：简单 RAG，AnythingLLM 同步返回
   * agentMode=true：Agent C agentic 检索，自主查多个 Workspace，返回 agentTaskId 供轨迹展示
   */
  qaChat: (workspaceId: number, question: string, agentMode: boolean = false) =>
    apiClient.post<ApiResponse<{ answer: string; sources?: string[]; agentTaskId?: number; mode: string }>>(
      `/mindbank/qa/${workspaceId}/chat`,
      { question, agentMode },
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

  // ==================== Agent ====================

  /** 触发知识库巡检，异步执行，返回 taskId 供轮询 */
  triggerInspection: () =>
    apiClient.post<ApiResponse<{ taskId: number }>>('/mindbank/agent/inspect'),

  /** 查询巡检历史列表 */
  listAgentTasks: () =>
    apiClient.get<ApiResponse<AgentTask[]>>('/mindbank/agent/tasks'),

  /** 查询单次巡检详情（含步骤轨迹 + 建议列表） */
  getAgentTaskDetail: (taskId: number) =>
    apiClient.get<ApiResponse<AgentTaskDetail>>(`/mindbank/agent/tasks/${taskId}`),

  /** 采纳建议 */
  approveSuggestion: (id: number) =>
    apiClient.post<ApiResponse<void>>(`/mindbank/agent/suggestions/${id}/approve`),

  /** 忽略建议 */
  ignoreSuggestion: (id: number) =>
    apiClient.post<ApiResponse<void>>(`/mindbank/agent/suggestions/${id}/ignore`),
}
