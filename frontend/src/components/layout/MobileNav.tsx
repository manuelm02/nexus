import { NavLink } from 'react-router-dom'
import { Target, Feather, Layers, Brain, Radio, CreditCard, Hammer, Sparkles, Languages } from 'lucide-react'
import { cn } from '../../lib/utils'
import { NAV_ITEMS } from '../../lib/constants'

const icons: Record<string, React.ComponentType<{ className?: string }>> = {
  Target, Feather, Layers, Brain, Radio, CreditCard, Hammer, Sparkles, Languages,
}

// MobileNav 展示移动端底部主功能导航。
export function MobileNav() {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t flex overflow-x-auto">
      {NAV_ITEMS.map(({ path, label, icon }) => {
        const Icon = icons[icon]
        return (
          <NavLink
            key={path}
            to={path}
            className={({ isActive }) => cn(
              'flex flex-col items-center gap-0.5 px-3 py-2 text-xs min-w-[56px] transition-colors',
              isActive ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            <Icon className="h-5 w-5" />
            <span>{label}</span>
          </NavLink>
        )
      })}
    </nav>
  )
}
