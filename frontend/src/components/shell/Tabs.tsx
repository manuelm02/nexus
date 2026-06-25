import { cn } from '@/lib/utils'

// Tabs 是全站唯一 tab 实现，统一 segmented（Apple 风格灰底白滑块）和 underline（下划线）两种 variant。
export interface TabsProps<T extends string> {
  value: T
  onChange: (v: T) => void
  items: { value: T; label: string; count?: number }[]
  variant?: 'segmented' | 'underline'
}

export function Tabs<T extends string>({ value, onChange, items, variant = 'segmented' }: TabsProps<T>) {
  if (variant === 'underline') {
    return (
      <div className="flex items-center gap-0" role="tablist">
        {items.map((item) => (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={value === item.value}
            onClick={() => onChange(item.value)}
            className={cn(
              'relative flex min-h-9 items-center gap-1.5 px-3 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              value === item.value
                ? 'font-semibold text-foreground after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:bg-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {item.label}
            {item.count !== undefined && <TabCount count={item.count} active={value === item.value} />}
          </button>
        ))}
      </div>
    )
  }

  // segmented：灰底轨道 + 白色选中滑块（iOS/macOS segmented control 观感，accent 留给主操作不滥用）
  return (
    <div role="tablist" className="inline-flex h-9 items-center gap-0.5 rounded-lg bg-muted p-1">
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          role="tab"
          aria-selected={value === item.value}
          onClick={() => onChange(item.value)}
          className={cn(
            'inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-[13px] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            value === item.value
              ? 'bg-card font-semibold text-foreground shadow-[var(--shadow-xs)]'
              : 'font-medium text-muted-foreground hover:text-foreground',
          )}
        >
          {item.label}
          {item.count !== undefined && <TabCount count={item.count} active={value === item.value} />}
        </button>
      ))}
    </div>
  )
}

// 计数徽标：选中态用 primary 浅色点缀，未选中态保持中性
function TabCount({ count, active }: { count: number; active: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums',
        active ? 'bg-primary/10 text-primary' : 'bg-foreground/5 text-muted-foreground',
      )}
    >
      {count}
    </span>
  )
}
