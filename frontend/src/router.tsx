import { createBrowserRouter } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { lazy, Suspense } from 'react'

// 所有页面懒加载，减少首屏 bundle 体积；Vite 会自动做代码分割
const LoginPage      = lazy(() => import('./pages/Login'))
const FocusPage      = lazy(() => import('./pages/Focus'))
const FleetingPage   = lazy(() => import('./pages/Fleeting'))
const PrismPage      = lazy(() => import('./pages/Prism'))
const MindbankPage   = lazy(() => import('./pages/Mindbank'))
const RadarPage      = lazy(() => import('./pages/Radar'))
const LedgerPage     = lazy(() => import('./pages/Ledger'))
const ForgePage      = lazy(() => import('./pages/Forge'))
const MusePage       = lazy(() => import('./pages/Muse'))
const TasksPage      = lazy(() => import('./pages/Tasks'))
const SettingsPage   = lazy(() => import('./pages/Settings'))

/** 页面切换时的全局加载占位 */
function Fallback() {
  return (
    <div className="flex items-center justify-center h-full min-h-[200px]">
      <div className="text-muted-foreground text-sm">加载中…</div>
    </div>
  )
}

function Wrap({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<Fallback />}>{children}</Suspense>
}

/**
 * 应用路由树。
 * AppLayout 作为根布局（含侧边栏 + 认证守卫），未登录时自动跳转 /login。
 * Mindbank / Radar / Forge / Muse 当前为 Phase 2 占位页面。
 */
export const router = createBrowserRouter([
  {
    path: '/login',
    element: <Wrap><LoginPage /></Wrap>,
  },
  {
    path: '/',
    element: <AppLayout />,  // 认证守卫在 AppLayout 中实现
    children: [
      { index: true, element: <Wrap><FocusPage /></Wrap> },
      { path: 'focus',    element: <Wrap><FocusPage /></Wrap> },
      { path: 'fleeting', element: <Wrap><FleetingPage /></Wrap> },
      { path: 'prism',    element: <Wrap><PrismPage /></Wrap> },
      { path: 'mindbank', element: <Wrap><MindbankPage /></Wrap> },
      { path: 'radar',    element: <Wrap><RadarPage /></Wrap> },
      { path: 'ledger',   element: <Wrap><LedgerPage /></Wrap> },
      { path: 'forge',    element: <Wrap><ForgePage /></Wrap> },
      { path: 'muse',     element: <Wrap><MusePage /></Wrap> },
      { path: 'tasks',    element: <Wrap><TasksPage /></Wrap> },
      { path: 'settings', element: <Wrap><SettingsPage /></Wrap> },
    ],
  },
])
