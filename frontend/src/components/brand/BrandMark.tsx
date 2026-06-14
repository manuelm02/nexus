import { cn } from '../../lib/utils'

export type BrandMarkProps = {
  className?: string
  imageClassName?: string
  title?: string
  variant?: 'transparent' | 'light' | 'dark'
}

// BrandMark 使用无字纯图形资产；小尺寸场景禁止使用带文字完整 logo。
export function BrandMark({ className, imageClassName, title = 'Nexus', variant = 'transparent' }: BrandMarkProps) {
  return (
    <span
      className={cn('relative block overflow-hidden', className)}
      title={title}
      aria-label={title}
      role="img"
    >
      <img
        src={`/brand/nexus-mark-${variant}.png`}
        alt=""
        aria-hidden="true"
        className={cn('h-full w-full object-contain', imageClassName)}
      />
    </span>
  )
}
