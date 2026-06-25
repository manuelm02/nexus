import React from 'react'

// PageHeader 是全站统一的章节式页眉（Signature）：mono 眉标 + accent 书脊 + serif 标题 + 副标题 + 右侧 actions。
export interface PageHeaderProps {
  /** mono uppercase 眉标，如 KNOWLEDGE / CAPTURE / TRANSLATE */
  eyebrow: string
  /** serif 大标题 */
  title: string
  /** sans muted 一句话副标题 */
  subtitle?: string
  /** 右侧主操作（如「新增」），每页最多一个 primary */
  actions?: React.ReactNode
}

export function PageHeader({ eyebrow, title, subtitle, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{eyebrow}</p>
        <div className="mt-1.5 flex items-center gap-2.5">
          <span aria-hidden className="h-6 w-[3px] shrink-0 rounded-full bg-primary md:h-6" />
          <h1 className="font-display text-[22px] font-bold leading-none tracking-tight text-foreground md:text-[28px]">{title}</h1>
        </div>
        {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  )
}
