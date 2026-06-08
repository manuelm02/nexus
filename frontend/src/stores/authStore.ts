import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthUser {
  id: string
  username: string
  nickname?: string
  avatarUrl?: string
  role: string
}

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: AuthUser | null
  setTokens: (accessToken: string, refreshToken: string, user: AuthUser) => void
  /** 仅更新 access token（refresh 后调用，保留 refreshToken 和 user 不变） */
  setAccessToken: (token: string) => void
  /** 清除所有认证状态，用于登出或 token 失效场景 */
  clear: () => void
  /** 以 accessToken 是否存在作为认证标志（不做 JWT 有效性校验，由拦截器处理过期） */
  isAuthenticated: () => boolean
}

/**
 * 认证状态 store，通过 zustand/persist 持久化到 localStorage（key: nexus-auth）。
 *
 * 只持久化 token 和 user 信息，不持久化衍生状态。
 * 页面刷新后 accessToken 可能已过期，由 client.ts 的 401 拦截器自动 refresh。
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setTokens: (accessToken, refreshToken, user) =>
        set({ accessToken, refreshToken, user }),
      setAccessToken: (token) =>
        set({ accessToken: token }),
      clear: () =>
        set({ accessToken: null, refreshToken: null, user: null }),
      isAuthenticated: () => !!get().accessToken,
    }),
    {
      name: 'nexus-auth',
      // partialize：只持久化 token 相关字段，排除方法引用
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
      }),
    },
  ),
)
