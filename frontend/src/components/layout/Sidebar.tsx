import { NavLink } from 'react-router-dom'
import {
  Target, Feather, Layers, Brain, Radio, FileText,
  LayoutDashboard, Hammer, Sparkles, Settings, Languages, LogOut,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { NAV_ITEMS } from '../../lib/constants'
import { useAuth } from '../../hooks/useAuth'
import { BrandMark } from '../brand/BrandMark'

const icons: Record<string, React.ComponentType<{ className?: string }>> = {
  Target, Feather, Layers, Brain, Radio, FileText,
  LayoutDashboard, Hammer, Sparkles, Settings, Languages,
}

// Sidebar 展示桌面端主功能导航和底部系统入口。
export function Sidebar() {
  const { user, logout } = useAuth()
  const displayName = user?.nickname || user?.username || 'User'

  return (
    <aside className="hidden h-screen w-64 shrink-0 flex-col border-r border-secondary/80 bg-primary text-primary-foreground md:sticky md:top-0 md:flex">
      <div className="border-b border-white/10 px-5 py-5">
        <div className="flex items-center gap-3">
          <BrandMark className="h-11 w-11 shrink-0 rounded-xl bg-white/95 shadow-[0_10px_24px_rgba(0,0,0,0.16)]" imageClassName="p-1" />
          <span className="min-w-0">
            <span className="block text-xl font-black leading-none tracking-normal">Nexus</span>
            <span className="mt-1 block text-[11px] font-medium leading-tight text-secondary-foreground/65">
              Personal Knowledge OS
            </span>
          </span>
        </div>
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
      {/* 统一账户胶囊区：身份区进入 Profile，操作区仅保留 Settings 和退出登录 */}
      <div className="border-t border-white/10 p-2">
        <div className="rounded-xl bg-secondary/50">
          {/* 身份区：点击整行进入 /profile */}
          <NavLink
            to="/profile"
            className={({ isActive }) => cn(
              'flex min-h-12 items-center gap-3 rounded-t-xl px-3 py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70',
              isActive ? 'bg-white font-bold text-primary' : 'text-secondary-foreground hover:bg-white/10 hover:text-white',
            )}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-[12px] font-black text-primary">
              {displayName.slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold">{displayName}</span>
              <span className="block text-[10px] font-medium text-secondary-foreground/50">Personal workspace</span>
            </span>
          </NavLink>
          {/* 操作区：Settings + 退出登录 */}
          <div className="flex items-center gap-1 px-2 pb-2">
            <NavLink
              to="/settings"
              className={({ isActive }) => cn(
                'flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70',
                isActive ? 'bg-white text-primary' : 'text-secondary-foreground/65 hover:bg-white/10 hover:text-white',
              )}
            >
              <Settings className="h-3.5 w-3.5" />
              Settings
            </NavLink>
            <button
              type="button"
              onClick={() => void logout()}
              className="flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg text-xs font-bold text-secondary-foreground/55 transition-colors hover:bg-destructive/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              <LogOut className="h-3.5 w-3.5" />
              退出登录
            </button>
          </div>
        </div>
      </div>
    </aside>
  )
}
