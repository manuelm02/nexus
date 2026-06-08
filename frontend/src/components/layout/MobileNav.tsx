import { NavLink } from 'react-router-dom'
import { Target, Feather, Layers, Brain, Radio, CreditCard, Hammer, Sparkles } from 'lucide-react'
import { cn } from '../../lib/utils'

const navItems = [
  { path: '/focus',    label: 'Focus',    Icon: Target     },
  { path: '/fleeting', label: 'Fleeting', Icon: Feather    },
  { path: '/prism',    label: 'Prism',    Icon: Layers     },
  { path: '/mindbank', label: 'Mindbank', Icon: Brain      },
  { path: '/radar',    label: 'Radar',    Icon: Radio      },
  { path: '/ledger',   label: 'Ledger',   Icon: CreditCard },
  { path: '/forge',    label: 'Forge',    Icon: Hammer     },
  { path: '/muse',     label: 'Muse',     Icon: Sparkles   },
]

export function MobileNav() {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t flex overflow-x-auto">
      {navItems.map(({ path, label, Icon }) => (
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
      ))}
    </nav>
  )
}
