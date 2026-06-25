import React from 'react'
import { cn } from '@/lib/utils'

// EmptyState 是全站唯一空状态组件，居中显示图标 + 标题 + 引导语 + 可选 CTA。
export interface EmptyStateProps {
  /** lucide 图标组件，单色描线风格 */
  icon?: React.ComponentType<{ className?: string }>
  title: string
  hint?: string
  action?: React.ReactNode
}

export function EmptyState({ icon: Icon, title, hint, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {Icon && (
        <div className={cn(
          'mb-3 flex h-12 w-12 items-center justify-center rounded-xl',
          'bg-accent text-muted-foreground',
        )}>
          <Icon className="h-5 w-5" />
        </div>
      )}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}
