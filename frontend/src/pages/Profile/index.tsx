import { LogOut, User } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { PageHeader, PageShell } from '@/components/shell'

// ProfilePage 展示当前登录用户信息，并提供主动退出登录入口。
export default function ProfilePage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    // padding 由 PageShell 统一提供，此处不再自加外层 padding
    <PageShell variant="full" header={
      <PageHeader
        eyebrow="ACCOUNT"
        title={user?.nickname || user?.username || 'User'}
      />
    }>
      <section className="nexus-surface p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
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
        className="inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm text-destructive transition-colors hover:bg-destructive/10"
      >
        <LogOut className="h-4 w-4" /> 退出登录
      </button>
    </PageShell>
  )
}
