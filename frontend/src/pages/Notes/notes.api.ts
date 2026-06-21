import { apiClient } from '../../api/client'
import type { ApiResponse } from '../../types/api.types'
import type { FileTreeNode, NoteFileContent } from './notes.types'

// Notes 页面 API 调用，路径前缀 /notes（apiClient baseURL 已含 /api/v1）
export const notesApi = {
  /** 获取 vault 完整目录树 */
  getTree: () =>
    apiClient.get<ApiResponse<FileTreeNode[]>>('/notes/tree'),

  /** 读取 .md 文件内容 */
  readFile: (path: string) =>
    apiClient.get<ApiResponse<NoteFileContent>>('/notes/file', { params: { path } }),

  /** 保存文件内容 */
  saveFile: (path: string, content: string) =>
    apiClient.put<ApiResponse<void>>('/notes/file', { path, content }),

  /** 新建空 .md 文件 */
  createFile: (path: string) =>
    apiClient.post<ApiResponse<void>>('/notes/file', { path }),

  /** 新建文件夹 */
  createFolder: (path: string) =>
    apiClient.post<ApiResponse<void>>('/notes/folder', { path }),

  /** 重命名/移动 */
  rename: (oldPath: string, newPath: string) =>
    apiClient.put<ApiResponse<void>>('/notes/rename', { oldPath, newPath }),

  /** 删除文件 */
  deleteFile: (path: string) =>
    apiClient.delete<ApiResponse<void>>('/notes/file', { params: { path } }),

  /** 递归删除目录 */
  deleteFolder: (path: string) =>
    apiClient.delete<ApiResponse<void>>('/notes/folder', { params: { path } }),
}
