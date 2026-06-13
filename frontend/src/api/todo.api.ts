import { apiClient } from './client'
import type { Todo, TodoBoardResponse } from '../types/domain.types'
import type { ApiResponse } from '../types/api.types'

type TodoPriority = Todo['priority']

export const todoApi = {
  /** 看板分组查询，后端保证 today/future/overdue/tasks 四个分组互斥 */
  board: () =>
    apiClient.get<ApiResponse<TodoBoardResponse>>('/todo/board'),

  /** 历史查询，按 status 筛选 done/cancelled */
  list: (params?: { status?: string }) =>
    apiClient.get<ApiResponse<Todo[]>>('/todo', { params }),

  /** 创建 ToDo，含计划日期和截止日期 */
  create: (data: {
    title: string
    priority?: TodoPriority
    scheduledDate?: string | null
    dueDate?: string | null
  }) =>
    apiClient.post<ApiResponse<Todo>>('/todo', data),

  updateStatus: (id: string, status: string) =>
    apiClient.patch<ApiResponse<Todo>>(`/todo/${id}/status`, { status }),

  /** 更新 ToDo，支持显式清空日期 */
  update: (id: string, data: Partial<Todo> & {
    clearScheduledDate?: boolean
    clearDueDate?: boolean
  }) =>
    apiClient.patch<ApiResponse<Todo>>(`/todo/${id}`, data),

  delete: (id: string) =>
    apiClient.delete(`/todo/${id}`),
}
