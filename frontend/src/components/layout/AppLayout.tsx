import { Outlet, Navigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { MobileNav } from './MobileNav'
import { useAuthStore } from '../../stores/authStore'

// AppLayout 提供全局布局框架：桌面端渲染侧边栏，移动端渲染底部导航，未登录时重定向到登录页。
export function AppLayout() {
  const isAuthenticated = useAuthStore((s) => !!s.accessToken)

  if (!isAuthenticated) return <Navigate to="/login" replace />

  return (
    <div className="flex min-h-dvh bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 overflow-y-auto pb-[calc(5rem+env(safe-area-inset-bottom,0px))] md:pb-0">
        <Outlet />
      </main>
      <MobileNav />
    </div>
  )
}
