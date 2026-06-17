import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

type RadialProgressProps = {
  ratio: number
  size?: number
  strokeWidth?: number
  colorClassName?: string
  children?: ReactNode
}

const RADIUS = 24
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

// RadialProgress 纯 SVG 环形进度条，用于按量账户余额可视化，不引入图表库
export function RadialProgress({ ratio, size = 56, strokeWidth = 6, colorClassName, children }: RadialProgressProps) {
  const clamped = Math.min(1, Math.max(0, ratio))
  const offset = CIRCUMFERENCE * (1 - clamped)

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 56 56" className="-rotate-90">
        <circle cx="28" cy="28" r={RADIUS} fill="none" stroke="hsl(var(--muted))" strokeWidth={strokeWidth} />
        <circle
          cx="28"
          cy="28"
          r={RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          className={cn('transition-[stroke-dashoffset] duration-500 ease-out', colorClassName)}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  )
}
