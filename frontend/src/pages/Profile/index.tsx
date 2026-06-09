import { LogOut, User } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

// ProfilePage 展示当前登录用户信息，并提供主动退出登录入口。
export default function ProfilePage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-5">
      <div>
        <h1 className="text-xl font-semibold">User</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">当前登录身份和会话操作。</p>
      </div>

      <section className="rounded-md border bg-card p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
            <User className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{user?.nickname || user?.username || 'Unknown'}</p>
            <p className="text-xs text-muted-foreground">{user?.username} · {user?.role}</p>
          </div>
        </div>
      </section>

      <button
        type="button"
        onClick={handleLogout}
        className="inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm text-destructive transition-colors hover:bg-destructive/10"
      >
        <LogOut className="h-4 w-4" /> 退出登录
      </button>
    </div>
  )
}
