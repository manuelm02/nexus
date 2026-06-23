import { createBrowserRouter } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { lazy, Suspense } from 'react'

// 所有页面懒加载，减少首屏 bundle 体积；Vite 会自动做代码分割
const LoginPage      = lazy(() => import('./pages/Login'))
const ChatPage       = lazy(() => import('./pages/Chat'))
const TodoPage       = lazy(() => import('./pages/ToDo'))
const InboxPage      = lazy(() => import('./pages/Inbox'))
const CrawlPage      = lazy(() => import('./pages/Crawl'))
const MindbankPage   = lazy(() => import('./pages/Mindbank'))
const NotesPage      = lazy(() => import('./pages/Notes'))
const CodingPracticePage = lazy(() => import('./pages/CodingPractice'))
const TranslatePage  = lazy(() => import('./pages/Translate'))
const PanelHubPage = lazy(() => import('./pages/PanelHub'))
const TasksPage      = lazy(() => import('./pages/Tasks'))
const SettingsPage   = lazy(() => import('./pages/Settings'))
const ProfilePage    = lazy(() => import('./pages/Profile'))

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
 * 新路径按导航命名保留旧路径别名，避免已收藏链接在重命名后失效。
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
      { index: true, element: <Wrap><ChatPage /></Wrap> },
      { path: 'chat', element: <Wrap><ChatPage /></Wrap> },
      { path: 'todo', element: <Wrap><TodoPage /></Wrap> },
      { path: 'inbox', element: <Wrap><InboxPage /></Wrap> },
      { path: 'crawl', element: <Wrap><CrawlPage /></Wrap> },
      { path: 'mindbank', element: <Wrap><MindbankPage /></Wrap> },
      { path: 'notes', element: <Wrap><NotesPage /></Wrap> },
      { path: 'coding-practice', element: <Wrap><CodingPracticePage /></Wrap> },
      { path: 'translate', element: <Wrap><TranslatePage /></Wrap> },
      { path: 'panel-hub', element: <Wrap><PanelHubPage /></Wrap> },
      { path: 'subscriptions', element: <Wrap><PanelHubPage /></Wrap> },
      { path: 'focus', element: <Wrap><TodoPage /></Wrap> },
      { path: 'fleeting', element: <Wrap><InboxPage /></Wrap> },
      { path: 'prism', element: <Wrap><TranslatePage /></Wrap> },
      { path: 'radar', element: <Wrap><CrawlPage /></Wrap> },
      { path: 'ledger', element: <Wrap><PanelHubPage /></Wrap> },
      { path: 'forge', element: <Wrap><CodingPracticePage /></Wrap> },
      { path: 'muse', element: <Wrap><ChatPage /></Wrap> },
      { path: 'tasks',    element: <Wrap><TasksPage /></Wrap> },
      { path: 'settings', element: <Wrap><SettingsPage /></Wrap> },
      { path: 'profile',  element: <Wrap><ProfilePage /></Wrap> },
    ],
  },
])
