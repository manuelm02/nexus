import { useAuthStore } from '../stores/authStore'
import { authApi } from '../api/auth.api'

export function useAuth() {
  const { user, accessToken, clear, setTokens } = useAuthStore()

  const login = async (username: string, password: string) => {
    const { data: res } = await authApi.login(username, password)
    if (!res.success || !res.data) throw new Error(res.message ?? '登录失败')
    setTokens(res.data.accessToken, res.data.refreshToken, res.data.user)
    return res.data
  }

  const logout = async () => {
    const refreshToken = useAuthStore.getState().refreshToken
    if (refreshToken) {
      try { await authApi.logout(refreshToken) } catch { /* ignore */ }
    }
    clear()
  }

  return { user, isAuthenticated: !!accessToken, login, logout }
}
