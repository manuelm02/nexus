import { apiClient } from './client'
import type { Todo } from '../types/domain.types'
import type { ApiResponse } from '../types/api.types'

export const todoApi = {
  // list 查询 ToDo 列表；overdue=true 时由后端按 today 计算已过期分组。
  list: (params?: { status?: string; date?: string; overdue?: boolean }) =>
    apiClient.get<ApiResponse<Todo[]>>('/todo', { params }),

  // create 只创建待分配池任务，scheduledDate/dueDate 由选入今日或后续调整写入。
  create: (data: { title: string; priority?: string }) =>
    apiClient.post<ApiResponse<Todo>>('/todo', data),

  updateStatus: (id: string, status: string) =>
    apiClient.patch<ApiResponse<Todo>>(`/todo/${id}/status`, { status }),

  scheduleToday: (id: string, dueDate?: string) =>
    apiClient.patch<ApiResponse<Todo>>(`/todo/${id}/schedule-today`, { dueDate }),

  update: (id: string, data: Partial<Todo>) =>
    apiClient.patch<ApiResponse<Todo>>(`/todo/${id}`, data),

  delete: (id: string) =>
    apiClient.delete(`/todo/${id}`),
}
