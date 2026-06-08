import { NavLink } from 'react-router-dom'
import {
  Target, Feather, Layers, Brain, Radio,
  CreditCard, Hammer, Sparkles, Settings, ListTodo,
} from 'lucide-react'
import { cn } from '../../lib/utils'

const icons: Record<string, React.ComponentType<{ className?: string }>> = {
  Target, Feather, Layers, Brain, Radio,
  CreditCard, Hammer, Sparkles, Settings, ListTodo,
}

const navItems = [
  { path: '/focus',    label: 'Focus',    icon: 'Target'    },
  { path: '/fleeting', label: 'Fleeting', icon: 'Feather'   },
  { path: '/prism',    label: 'Prism',    icon: 'Layers'    },
  { path: '/mindbank', label: 'Mindbank', icon: 'Brain'     },
  { path: '/radar',    label: 'Radar',    icon: 'Radio'     },
  { path: '/ledger',   label: 'Ledger',   icon: 'CreditCard'},
  { path: '/forge',    label: 'Forge',    icon: 'Hammer'    },
  { path: '/muse',     label: 'Muse',     icon: 'Sparkles'  },
]

export function Sidebar() {
  return (
    <aside className="hidden md:flex flex-col w-56 shrink-0 border-r bg-card h-screen sticky top-0">
      <div className="px-4 py-5 border-b">
        <span className="font-bold text-lg tracking-tight">Nexus</span>
      </div>
      <nav className="flex-1 overflow-y-auto py-2">
        {navItems.map(({ path, label, icon }) => {
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
          Tasks
        </NavLink>
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
