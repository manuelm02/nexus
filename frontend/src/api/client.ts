import axios from 'axios'
import { useAuthStore } from '../stores/authStore'

// 开发环境通过 Vite proxy 转发到后端（见 vite.config.ts）；生产环境由 Caddy 反代
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'

/** 全局 Axios 实例，所有 API 调用统一使用此实例 */
export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

// 请求拦截器：自动从 Zustand store 读取当前 access token 并附加到 Authorization header
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

/**
 * 响应拦截器：统一处理 401 Token 过期
 *
 * 流程：
 *   1. 请求返回 401 且未标记 _retry（防止死循环）
 *   2. 用 refresh token 换取新的 access token（使用裸 axios，不触发此拦截器）
 *   3. 更新 store 中的 access token，重新发起原始请求
 *   4. refresh 失败（token 过期 / 已撤销）→ 清除认证状态 → 跳转登录页
 *
 * 注意：data.data.accessToken 中，第一个 .data 是 Axios response body，
 * 第二个 .data 是后端 ApiResponse<TokenResponse> 的 data 字段（见 ApiResponse.java）。
 */
apiClient.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401 && !err.config._retry) {
      err.config._retry = true  // 标记已重试，防止 refresh 本身返回 401 时无限循环
      const refreshToken = useAuthStore.getState().refreshToken
      if (!refreshToken) {
        useAuthStore.getState().clear()
        window.location.href = '/login'
        return Promise.reject(err)
      }
      try {
        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken })
        const newToken = data.data.accessToken  // ApiResponse<TokenResponse>.data.accessToken
        useAuthStore.getState().setAccessToken(newToken)
        err.config.headers.Authorization = `Bearer ${newToken}`
        return apiClient(err.config)  // 用新 token 重发原始请求
      } catch {
        // refresh token 无效或过期，强制重新登录
        useAuthStore.getState().clear()
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  },
)
