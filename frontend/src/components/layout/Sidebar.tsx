import { NavLink } from 'react-router-dom'
import {
  Target, Feather, Layers, Brain, Radio,
  CreditCard, Hammer, Sparkles, Settings, Languages, LogOut,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { NAV_ITEMS } from '../../lib/constants'
import { useAuth } from '../../hooks/useAuth'

const icons: Record<string, React.ComponentType<{ className?: string }>> = {
  Target, Feather, Layers, Brain, Radio,
  CreditCard, Hammer, Sparkles, Settings, Languages,
}

// Sidebar 展示桌面端主功能导航和底部系统入口。
export function Sidebar() {
  const { user, logout } = useAuth()
  const displayName = user?.nickname || user?.username || 'User'

  return (
    <aside className="hidden h-screen w-64 shrink-0 flex-col border-r border-secondary/80 bg-primary text-primary-foreground md:sticky md:top-0 md:flex">
      <div className="border-b border-white/10 px-5 py-5">
        <span className="text-xl font-black tracking-normal">Nexus</span>
        <p className="mt-1 text-[11px] font-medium text-secondary-foreground/65">Personal Knowledge OS</p>
      </div>
      <nav className="flex-1 overflow-y-auto p-2">
        {NAV_ITEMS.map(({ path, label, icon }) => {
          const Icon = icons[icon]
          return (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) => cn(
                'flex min-h-10 items-center gap-3 rounded-[0.625rem] px-3 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70',
                isActive
                  ? 'bg-white font-bold text-primary'
                  : 'text-secondary-foreground/70 hover:bg-white/10 hover:text-white',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </NavLink>
          )
        })}
      </nav>
      <div className="border-t border-white/10 p-2">
        <NavLink
          to="/settings"
          className={({ isActive }) => cn(
            'flex min-h-10 items-center gap-3 rounded-[0.625rem] px-3 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70',
            isActive ? 'bg-white font-bold text-primary' : 'text-secondary-foreground/70 hover:bg-white/10 hover:text-white',
          )}
        >
          <Settings className="h-4 w-4 shrink-0" />
          Settings
        </NavLink>
        <NavLink
          to="/profile"
          className={({ isActive }) => cn(
            'mt-1 flex min-h-12 items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70',
            isActive ? 'bg-white font-bold text-primary' : 'bg-secondary/70 text-secondary-foreground hover:bg-white/10 hover:text-white',
          )}
        >
          {({ isActive }) => (
            <>
              <span className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black',
                isActive ? 'bg-primary text-primary-foreground' : 'bg-white text-primary',
              )}>
                {displayName.slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0">
                <span className="block truncate">{displayName}</span>
                <span className={cn(
                  'block text-[10px] font-medium',
                  isActive ? 'text-primary/65' : 'text-secondary-foreground/60',
                )}>Profile</span>
              </span>
            </>
          )}
        </NavLink>
        <button
          type="button"
          onClick={() => void logout()}
          className="mt-1 flex min-h-10 w-full items-center gap-3 rounded-[0.625rem] px-3 py-2.5 text-left text-sm text-secondary-foreground/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          退出登录
        </button>
      </div>
    </aside>
  )
}
