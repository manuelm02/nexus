import { useMemo, useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { cn } from '../../lib/utils'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'] as const
const MONTH_LABELS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'] as const

export type DatePickerProps = {
  value?: string
  onChange: (value: string) => void
  /** 值非空时在组件内部提供清空动作；调用方不要再额外摆外置 X。 */
  allowClear?: boolean
  /** 移动端展开态使用今天/明天快捷 chip，完整选择仍由同一个弹层负责。 */
  showQuickChips?: boolean
  compact?: boolean
  invalid?: boolean
  placeholder?: string
}

function pad2(value: number) {
  return String(value).padStart(2, '0')
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function todayString() {
  return toDateKey(new Date())
}

function parseDateKey(value?: string) {
  if (!value) return null
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

function addDays(date: Date, days: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function addMonths(date: Date, months: number) {
  const next = new Date(date)
  next.setMonth(next.getMonth() + months, 1)
  return next
}

function formatDisplayDate(value?: string) {
  if (!value) return ''
  const parsed = parseDateKey(value)
  if (!parsed) return value
  return `${parsed.getFullYear()}/${pad2(parsed.getMonth() + 1)}/${pad2(parsed.getDate())}`
}

function formatShortDate(value: string) {
  const parsed = parseDateKey(value)
  if (!parsed) return value
  return `${pad2(parsed.getMonth() + 1)}/${pad2(parsed.getDate())}`
}

function buildCalendarDays(month: Date) {
  const firstOfMonth = new Date(month.getFullYear(), month.getMonth(), 1)
  const start = addDays(firstOfMonth, -firstOfMonth.getDay())
  return Array.from({ length: 42 }, (_, index) => addDays(start, index))
}

// DatePicker 提供 Nexus 统一日期选择体验，支持年份/月份快速跳转，供 ToDo、Subscriptions、PanelHub 等复用。
export function DatePicker({ value, onChange, allowClear = false, showQuickChips = false, compact = false, invalid = false, placeholder = '年 / 月 / 日' }: DatePickerProps) {
  const today = todayString()
  const tomorrow = toDateKey(addDays(parseDateKey(today) ?? new Date(), 1))
  const selectedDate = parseDateKey(value)
  const [open, setOpen] = useState(false)
  const [visibleMonth, setVisibleMonth] = useState(() => selectedDate ?? parseDateKey(today) ?? new Date())

  // 子面板开关：年份选择网格 / 月份选择网格
  const [yearPickerOpen, setYearPickerOpen] = useState(false)
  const [monthPickerOpen, setMonthPickerOpen] = useState(false)

  // 年份网格翻页范围：每页展示 12 个年份，初始定位到当前年份所在区间
  const [yearRangeStart, setYearRangeStart] = useState(() => {
    const currentYear = (selectedDate ?? new Date()).getFullYear()
    return currentYear - (currentYear % 12)
  })

  const calendarDays = useMemo(() => buildCalendarDays(visibleMonth), [visibleMonth])
  const hasValue = !!value

  const handleSelect = (nextValue: string) => {
    onChange(nextValue)
    const nextDate = parseDateKey(nextValue)
    if (nextDate) setVisibleMonth(nextDate)
    setOpen(false)
  }

  // 打开 Popover 时重置所有子面板状态，并同步年份区间
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setVisibleMonth(selectedDate ?? parseDateKey(today) ?? new Date())
      setYearPickerOpen(false)
      setMonthPickerOpen(false)
      const y = (selectedDate ?? new Date()).getFullYear()
      setYearRangeStart(y - (y % 12))
    }
    setOpen(nextOpen)
  }

  const trigger = (
    <button
      type="button"
      className={cn(
        'group flex w-full min-w-0 items-center rounded-lg border bg-card text-left shadow-[var(--shadow-xs)] transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        compact ? 'h-9 gap-2 px-3 text-sm' : 'h-10 gap-2 px-3 text-sm',
        invalid && 'border-destructive focus-visible:ring-destructive',
        open && 'border-ring ring-2 ring-ring/18',
      )}
    >
      <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className={cn('min-w-0 flex-1 truncate font-semibold', hasValue ? 'text-foreground' : 'text-muted-foreground')}>
        {hasValue ? formatDisplayDate(value) : placeholder}
      </span>
      {allowClear && hasValue && (
        <span
          aria-label="清空日期"
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onChange('')
            setOpen(false)
          }}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </span>
      )}
    </button>
  )

  return (
    <div className="space-y-1.5">
      <Popover.Root open={open} onOpenChange={handleOpenChange}>
        <Popover.Trigger asChild>{trigger}</Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            side="bottom"
            align="start"
            sideOffset={8}
            collisionPadding={12}
            className="z-[80] w-[min(calc(100vw-2rem),19rem)] rounded-lg border bg-popover p-3 text-popover-foreground shadow-lg"
          >
            {/* 日历头部：年份/月份子面板打开时隐藏左右箭头，子面板自带翻页 */}
            <div className="flex items-center justify-between gap-2">
              {!yearPickerOpen && !monthPickerOpen ? (
                <button type="button" onClick={() => setVisibleMonth(addMonths(visibleMonth, -1))} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="上个月">
                  <ChevronLeft className="h-4 w-4" />
                </button>
              ) : (
                <span className="w-8" />
              )}

              {/* 年份和月份均可点击切换子面板 */}
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setYearPickerOpen(!yearPickerOpen)
                    setMonthPickerOpen(false)
                    // 打开年份面板时同步区间
                    const y = visibleMonth.getFullYear()
                    setYearRangeStart(y - (y % 12))
                  }}
                  className={cn(
                    'rounded-md px-1.5 py-0.5 text-sm font-black transition-colors hover:bg-accent',
                    yearPickerOpen ? 'bg-accent text-foreground' : 'text-foreground',
                  )}
                >
                  {visibleMonth.getFullYear()}年
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMonthPickerOpen(!monthPickerOpen)
                    setYearPickerOpen(false)
                  }}
                  className={cn(
                    'rounded-md px-1.5 py-0.5 text-sm font-black transition-colors hover:bg-accent',
                    monthPickerOpen ? 'bg-accent text-foreground' : 'text-foreground',
                  )}
                >
                  {pad2(visibleMonth.getMonth() + 1)}月
                </button>
              </div>

              {!yearPickerOpen && !monthPickerOpen ? (
                <button type="button" onClick={() => setVisibleMonth(addMonths(visibleMonth, 1))} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="下个月">
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <span className="w-8" />
              )}
            </div>

            {/* 内容区域：按子面板状态切换 */}
            {yearPickerOpen ? (
              <div className="mt-3">
                <div className="mb-2 flex items-center justify-between">
                  <button type="button" onClick={() => setYearRangeStart((prev) => prev - 12)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" aria-label="上一页年份">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-xs font-bold text-muted-foreground">{yearRangeStart} — {yearRangeStart + 11}</span>
                  <button type="button" onClick={() => setYearRangeStart((prev) => prev + 12)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" aria-label="下一页年份">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {Array.from({ length: 12 }, (_, i) => yearRangeStart + i).map((year) => (
                    <button key={year} type="button"
                      onClick={() => {
                        setVisibleMonth(new Date(year, visibleMonth.getMonth(), 1))
                        setYearPickerOpen(false)
                      }}
                      className={cn(
                        'flex h-9 items-center justify-center rounded-md text-sm font-semibold transition-colors',
                        year === visibleMonth.getFullYear() ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-accent',
                        year === new Date().getFullYear() && year !== visibleMonth.getFullYear() && 'border border-primary/35 text-primary',
                      )}
                    >
                      {year}
                    </button>
                  ))}
                </div>
              </div>
            ) : monthPickerOpen ? (
              <div className="mt-3 grid grid-cols-4 gap-1">
                {MONTH_LABELS.map((label, month) => (
                  <button key={month} type="button"
                    onClick={() => {
                      setVisibleMonth(new Date(visibleMonth.getFullYear(), month, 1))
                      setMonthPickerOpen(false)
                    }}
                    className={cn(
                      'flex h-9 items-center justify-center rounded-md text-sm font-semibold transition-colors',
                      month === visibleMonth.getMonth() ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-accent',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : (
              <>
                <div className="mt-3 grid grid-cols-7 gap-1 text-center">
                  {WEEKDAYS.map((weekday) => (
                    <div key={weekday} className="flex h-7 items-center justify-center text-xs font-black text-muted-foreground">
                      {weekday}
                    </div>
                  ))}
                  {calendarDays.map((day) => {
                    const dayKey = toDateKey(day)
                    const isSelected = dayKey === value
                    const isToday = dayKey === today
                    const outsideMonth = day.getMonth() !== visibleMonth.getMonth()
                    return (
                      <button
                        key={dayKey}
                        type="button"
                        onClick={() => handleSelect(dayKey)}
                        className={cn(
                          'flex h-8 items-center justify-center rounded-md text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          outsideMonth ? 'text-muted-foreground/45 hover:bg-accent/45 hover:text-muted-foreground' : 'text-foreground hover:bg-accent',
                          isToday && !isSelected && 'border border-primary/35 text-primary',
                          isSelected && 'bg-primary text-primary-foreground shadow-sm hover:bg-primary hover:text-primary-foreground',
                        )}
                      >
                        {day.getDate()}
                      </button>
                    )
                  })}
                </div>

                <div className="mt-3 flex items-center justify-between border-t pt-3">
                  {allowClear ? (
                    <button type="button" onClick={() => { onChange(''); setOpen(false) }} disabled={!hasValue} className="inline-flex h-8 items-center justify-center rounded-md px-2 text-xs font-bold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40">
                      清除
                    </button>
                  ) : (
                    <span />
                  )}
                  <button type="button" onClick={() => handleSelect(today)} className="inline-flex h-8 items-center justify-center rounded-md px-2 text-xs font-bold text-primary transition-colors hover:bg-primary/10">
                    今天
                  </button>
                </div>
              </>
            )}

            <Popover.Arrow className="fill-popover" />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {showQuickChips && (
        <div className="flex flex-wrap items-center gap-1.5">
          {([
            ['今天', today],
            ['明天', tomorrow],
          ] as const).map(([label, date]) => (
            <button
              key={label}
              type="button"
              onClick={() => handleSelect(date)}
              className={cn(
                'inline-flex h-8 items-center gap-1 rounded-lg border bg-background px-2.5 text-xs font-bold transition-colors',
                value === date ? 'border-primary/50 bg-primary/10 text-primary' : 'text-muted-foreground hover:border-muted-foreground/30 hover:text-foreground',
              )}
            >
              {label}
            </button>
          ))}
          {hasValue && (
            <span className="inline-flex h-8 items-center rounded-lg border bg-accent/55 px-2.5 text-xs font-bold text-foreground">
              {formatShortDate(value)}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
