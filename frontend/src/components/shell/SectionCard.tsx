import React from 'react'
import { cn } from '@/lib/utils'

// SectionCard 是基于 .nexus-surface 的统一卡片容器，统一 padding、标题、工具区位置。
export interface SectionCardProps {
  /** section 标题（sans，可选为 serif 用于大区块） */
  title?: string
  icon?: React.ComponentType<{ className?: string }>
  /** 右上工具区 */
  toolbar?: React.ReactNode
  children: React.ReactNode
  /** compact = p-2.5/p-3, normal = p-3.5/p-4 */
  padding?: 'compact' | 'normal'
}

export function SectionCard({ title, icon: Icon, toolbar, children, padding = 'normal' }: SectionCardProps) {
  return (
    <section className="nexus-surface">
      {(title || toolbar) && (
        <div className={cn(
          'flex items-center justify-between gap-2',
          padding === 'compact' ? 'px-2.5 pt-2.5 md:px-3 md:pt-3' : 'px-3.5 pt-3.5 md:px-4 md:pt-4',
        )}>
          <div className="flex items-center gap-2">
            {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
            {title && <h2 className="text-sm font-semibold text-foreground">{title}</h2>}
          </div>
          {toolbar && <div className="flex shrink-0 items-center gap-1.5">{toolbar}</div>}
        </div>
      )}
      <div className={cn(
        padding === 'compact' ? 'p-2.5 md:p-3' : 'p-3.5 md:p-4',
        // 如果同时有标题和内容，内容区 pt 要收紧
        (title || toolbar) && (padding === 'compact' ? 'pt-2 md:pt-2' : 'pt-2.5 md:pt-3'),
      )}>
        {children}
      </div>
    </section>
  )
}
