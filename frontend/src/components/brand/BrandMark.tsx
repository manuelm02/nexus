import { cn } from '../../lib/utils'

export type BrandMarkProps = {
  className?: string
  /** @deprecated 旧 PNG 资产参数，保留以兼容调用方，已无效 */
  imageClassName?: string
  title?: string
  /** @deprecated 旧 PNG 变体，保留以兼容调用方，已无效 */
  variant?: 'transparent' | 'light' | 'dark'
}

// BrandMark 直接使用 public/icons/icon-192.png（正式设计资产）。
// 圆角和尺寸由调用方通过 className 控制（默认 rounded-xl）。
export function BrandMark({ className, title = 'Nexus' }: BrandMarkProps) {
  return (
    <span
      className={cn('relative block overflow-hidden rounded-xl', className)}
      title={title}
      aria-label={title}
      role="img"
    >
      <img
        src="/icons/icon-192.png"
        alt={title}
        className="h-full w-full object-cover"
        draggable={false}
      />
    </span>
  )
}
