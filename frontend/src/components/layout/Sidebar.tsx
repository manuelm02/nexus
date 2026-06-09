import { NavLink } from 'react-router-dom'
import {
  Target, Feather, Layers, Brain, Radio,
  CreditCard, Hammer, Sparkles, Settings, ListTodo, Languages, User, LogOut,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { NAV_ITEMS } from '../../lib/constants'
import { useAuth } from '../../hooks/useAuth'

const icons: Record<string, React.ComponentType<{ className?: string }>> = {
  Target, Feather, Layers, Brain, Radio,
  CreditCard, Hammer, Sparkles, Settings, ListTodo, Languages,
}

// Sidebar 展示桌面端主功能导航和底部系统入口。
export function Sidebar() {
  const { user, logout } = useAuth()

  return (
    <aside className="hidden md:flex flex-col w-56 shrink-0 border-r bg-card h-screen sticky top-0">
      <div className="px-4 py-5 border-b">
        <span className="font-bold text-lg tracking-tight">Nexus</span>
      </div>
      <nav className="flex-1 overflow-y-auto py-2">
        {NAV_ITEMS.map(({ path, label, icon }) => {
          const Icon = icons[icon]
          return (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) => cn(
                'flex items-center gap-3 px-4 py-2.5 text-sm transition-colors',
                isActive
                  ? 'bg-accent text-accent-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </NavLink>
          )
        })}
      </nav>
      <div className="border-t py-2">
        <NavLink
          to="/tasks"
          className={({ isActive }) => cn(
            'flex items-center gap-3 px-4 py-2.5 text-sm transition-colors',
            isActive ? 'bg-accent text-accent-foreground font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
          )}
        >
          <ListTodo className="h-4 w-4 shrink-0" />
          Jobs
        </NavLink>
        <NavLink
          to="/profile"
          className={({ isActive }) => cn(
            'flex items-center gap-3 px-4 py-2.5 text-sm transition-colors',
            isActive ? 'bg-accent text-accent-foreground font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
          )}
        >
          <User className="h-4 w-4 shrink-0" />
          <span className="truncate">{user?.nickname || user?.username || 'User'}</span>
        </NavLink>
        <button
          type="button"
          onClick={() => void logout()}
          className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          退出登录
        </button>
        <NavLink
          to="/settings"
          className={({ isActive }) => cn(
            'flex items-center gap-3 px-4 py-2.5 text-sm transition-colors',
            isActive ? 'bg-accent text-accent-foreground font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
          )}
        >
          <Settings className="h-4 w-4 shrink-0" />
          Settings
        </NavLink>
      </div>
    </aside>
  )
}
