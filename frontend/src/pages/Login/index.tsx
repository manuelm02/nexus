import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

// LoginPage 提供 Nexus 前台的账号登录入口。
export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(username, password)
      navigate('/', { replace: true })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-[1.5rem] border bg-card shadow-[var(--shadow-lg)] md:grid-cols-[1fr_0.9fr]">
        <div className="hidden bg-primary p-8 text-primary-foreground md:flex md:flex-col md:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.12em] text-secondary-foreground/70">Personal Knowledge OS</p>
            <h1 className="mt-3 text-4xl font-black">Nexus</h1>
            <p className="mt-4 max-w-sm text-sm leading-7 text-secondary-foreground/75">
              统一管理个人输入、AI 处理、知识沉淀与多端输出。
            </p>
          </div>
          <div className="grid gap-2 text-xs text-secondary-foreground/65">
            <span>ToDo · Translate · Inbox</span>
            <span>Subscriptions · Chat · Mindbank</span>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5 p-6 sm:p-8">
          <div className="space-y-1">
            <p className="text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground">Sign in</p>
            <h2 className="text-3xl font-black">Nexus</h2>
            <p className="text-sm text-muted-foreground">个人 AI 工作台</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold">用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="nexus-input w-full px-3 text-sm"
              placeholder="请输入用户名"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-bold">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="nexus-input w-full px-3 text-sm"
              placeholder="请输入密码"
            />
          </div>
          {error && <p className="rounded-xl border border-[hsl(var(--destructive)/0.24)] bg-[hsl(var(--destructive-soft))] px-3 py-2 text-sm font-semibold text-destructive">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="nexus-button-primary w-full py-2 text-sm"
          >
            {loading ? '登录中…' : '登录'}
          </button>
        </form>
      </div>
    </div>
  )
}
