import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import * as Dialog from '@radix-ui/react-dialog'
import {
  Target, Feather, Layers, Brain, Radio, FileText, CreditCard, Hammer, Sparkles,
  Languages, LogOut, Menu, Settings, User, X,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { NAV_ITEMS } from '../../lib/constants'
import { useAuth } from '../../hooks/useAuth'
import { BrandMark } from '../brand/BrandMark'

const icons: Record<string, React.ComponentType<{ className?: string }>> = {
  Target, Feather, Layers, Brain, Radio, FileText, CreditCard, Hammer, Sparkles, Languages,
  LogOut, Menu, Settings, User,
}

const PRIMARY_MOBILE_PATHS = ['/chat', '/todo', '/inbox', '/translate'] as const

const moreItems = [
  ...NAV_ITEMS.filter((item) => !PRIMARY_MOBILE_PATHS.includes(item.path as (typeof PRIMARY_MOBILE_PATHS)[number])),
  { path: '/settings', label: 'Settings', icon: 'Settings' },
  { path: '/profile', label: 'Account', icon: 'User' },
] as const

// MobileNav 展示移动端底部主导航，并把低频入口收纳到更多面板。
export function MobileNav() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const { user, logout } = useAuth()
  const primaryItems = NAV_ITEMS.filter((item) => PRIMARY_MOBILE_PATHS.includes(item.path as (typeof PRIMARY_MOBILE_PATHS)[number]))
  const moreActive = moreItems.some((item) => item.path === location.pathname)

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card/95 px-2 pb-[max(env(safe-area-inset-bottom),0.35rem)] pt-1.5 shadow-[0_-8px_24px_rgba(var(--primary-rgb),0.08)] backdrop-blur md:hidden">
        <div className="grid grid-cols-5 gap-1">
          {primaryItems.map(({ path, label, icon }) => {
            const Icon = icons[icon]
            return (
              <NavLink
                key={path}
                to={path}
                className={({ isActive }) => cn(
                  'flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[11px] leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isActive ? 'bg-primary text-primary-foreground font-bold' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="max-w-full truncate">{label}</span>
              </NavLink>
            )
          })}
          <Dialog.Trigger asChild>
            <button
              type="button"
              className={cn(
                'flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[11px] leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                moreActive ? 'bg-primary text-primary-foreground font-bold' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              <Menu className="h-5 w-5 shrink-0" />
              <span className="max-w-full truncate">更多</span>
            </button>
          </Dialog.Trigger>
        </div>
      </nav>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-background/50 backdrop-blur-sm md:hidden" />
        <Dialog.Content className="fixed inset-x-3 bottom-3 z-[60] max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl border bg-card p-3 shadow-[var(--shadow-lg)] md:hidden">
          <div className="mb-2 flex items-center justify-between gap-3 px-1">
            <Dialog.Title className="flex items-center gap-2 text-sm font-semibold">
              <BrandMark className="h-8 w-8 rounded-lg bg-white shadow-[var(--shadow-xs)]" imageClassName="p-0.5" />
              Nexus
            </Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="关闭">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="grid gap-1">
            {moreItems.map(({ path, label, icon }) => {
              const Icon = icons[icon]
              const displayLabel = path === '/profile' ? (user?.nickname || user?.username || label) : label
              return (
                <NavLink
                  key={path}
                  to={path}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) => cn(
                    'flex min-h-11 items-center gap-3 rounded-xl px-3 py-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    isActive ? 'bg-primary text-primary-foreground font-bold' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{displayLabel}</span>
                </NavLink>
              )
            })}
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                void logout()
              }}
              className="flex min-h-11 items-center gap-3 rounded-xl px-3 py-3 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              退出登录
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
