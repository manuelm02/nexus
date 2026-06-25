import { NavLink } from 'react-router-dom'
import {
  Target, Feather, Layers, Brain, Radio, FileText,
  LayoutDashboard, Hammer, Sparkles, Settings, Languages, LogOut,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { NAV_GROUPS, NAV_ITEMS } from '../../lib/constants'
import { useAuth } from '../../hooks/useAuth'
import { BrandMark } from '../brand/BrandMark'

const icons: Record<string, React.ComponentType<{ className?: string }>> = {
  Target, Feather, Layers, Brain, Radio, FileText,
  LayoutDashboard, Hammer, Sparkles, Settings, Languages,
}

// Sidebar 展示桌面端主功能导航（按空间/收集/工具/管理分组）和底部系统入口，浅色暖纸风格。
export function Sidebar() {
  const { user, logout } = useAuth()
  const displayName = user?.nickname || user?.username || 'User'

  return (
    <aside className="hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-sidebar text-sidebar-foreground md:sticky md:top-0 md:flex">
      {/* 品牌区 */}
      <div className="border-b border-border px-5 py-5">
        <div className="flex items-center gap-3">
          <BrandMark className="h-11 w-11 shrink-0 shadow-[var(--shadow-sm)]" />
          <span className="min-w-0">
            <span className="block text-xl font-black leading-none tracking-normal">Nexus</span>
            <span className="mt-1 block text-[11px] font-medium leading-tight text-sidebar-muted">
              Personal Knowledge OS
            </span>
          </span>
        </div>
      </div>

      {/* 分组导航 */}
      <nav className="flex-1 overflow-y-auto p-2">
        {NAV_GROUPS.map((group) => (
          <div key={group.key} className="mb-3 last:mb-0">
            {/* 组标题：mono uppercase，浅色 muted */}
            <p className="px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-muted">
              {group.label}
            </p>
            {NAV_ITEMS.filter((item) => item.group === group.key).map(({ path, label, icon }) => {
              const Icon = icons[icon]
              return (
                <NavLink
                  key={path}
                  to={path}
                  className={({ isActive }) => cn(
                    'flex min-h-10 items-center gap-3 rounded-[0.625rem] px-3 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isActive
                      ? 'border-l-[3px] border-l-primary bg-card pl-[9px] font-semibold text-primary shadow-[var(--shadow-xs)]'
                      : 'text-sidebar-muted hover:bg-sidebar-hover hover:text-foreground',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </NavLink>
              )
            })}
          </div>
        ))}
      </nav>

      {/* 账户胶囊区：白底浅色风格，去掉原深色专用类 */}
      <div className="border-t border-border p-2">
        <div className="rounded-xl bg-card/60 shadow-[var(--shadow-xs)]">
          {/* 身份区：点击进入 /profile */}
          <NavLink
            to="/profile"
            className={({ isActive }) => cn(
              'flex min-h-12 items-center gap-3 rounded-t-xl px-3 py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isActive
                ? 'bg-primary text-primary-foreground font-bold'
                : 'text-foreground hover:bg-sidebar-hover',
            )}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-[12px] font-black text-primary-foreground">
              {displayName.slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold">{displayName}</span>
              <span className="block text-[10px] font-medium text-muted-foreground">Personal workspace</span>
            </span>
          </NavLink>
          {/* 操作区：Settings + 退出登录 */}
          <div className="flex items-center gap-1 px-2 pb-2">
            <NavLink
              to="/settings"
              className={({ isActive }) => cn(
                'flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-sidebar-hover hover:text-foreground',
              )}
            >
              <Settings className="h-3.5 w-3.5" />
              Settings
            </NavLink>
            <button
              type="button"
              onClick={() => void logout()}
              className="flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg text-xs font-bold text-muted-foreground transition-colors hover:bg-sidebar-hover hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
