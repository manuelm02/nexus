import { apiClient } from './client'
import type { ApiResponse, TokenResponse } from '../types/api.types'

export const authApi = {
  login: (username: string, password: string) =>
    apiClient.post<ApiResponse<TokenResponse>>('/auth/login', { username, password }),

  refresh: (refreshToken: string) =>
    apiClient.post<ApiResponse<TokenResponse>>('/auth/refresh', { refreshToken }),

  logout: (refreshToken: string) =>
    apiClient.post('/auth/logout', { refreshToken }),
}
