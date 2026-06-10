import { Check, ChevronDown, Pause, Plus, X } from 'lucide-react'
import { useState } from 'react'
import type { Todo } from '../../types/domain.types'
import { PRIORITY_LABELS, STATUS_LABELS } from '../../lib/constants'
import { cn } from '../../lib/utils'
import { ScheduleTodayPopover, StatusFilterSelect } from './todo.components'
import {
  PRIORITIES,
  PRIORITY_ROW_STYLES,
  PRIORITY_STYLES,
  normalizePriority,
  type Priority,
  type TodoStatus,
  type TodoTab,
} from './todo.shared'
import type { TodoMainViewProps } from './TodoDesktopView'

// TodoMobileView 使用独立移动端信息架构，避免把桌面卡片按比例缩小后占用首屏。
export function TodoMobileView(props: TodoMainViewProps) {
  const {
    activeTab,
    headerMetrics,
    operationError,
    createPending,
    today,
    onCreate,
    onTabChange,
  } = props

  return (
    <div className="nexus-page-enter mx-auto space-y-3 px-3 pb-24 pt-3 md:hidden">
      <header className="space-y-2">
        <div>
          <h1 className="text-[30px] font-black leading-none text-foreground">ToDo</h1>
          <p className="mt-1 text-[12px] font-medium leading-5 text-muted-foreground">今日执行、待分配、过期处理。</p>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {headerMetrics.map((metric) => (
            <div
              key={metric.label}
              className={cn(
                'rounded-lg border bg-card px-2.5 py-1.5',
                metric.tone === 'danger' && 'border-[hsl(var(--destructive)/0.24)] bg-[hsl(var(--destructive-soft))]',
              )}
            >
              <div className={cn('text-base font-black leading-none', metric.tone === 'danger' && 'text-destructive')}>{metric.value}</div>
              <div className={cn('mt-0.5 text-[10px] font-bold leading-none text-muted-foreground', metric.tone === 'danger' && 'text-destructive/75')}>{metric.label}</div>
            </div>
          ))}
        </div>
      </header>

      <MobileQuickCreate today={today} pending={createPending} onCreate={onCreate} />
      {operationError && (
        <div className="rounded-lg border border-[hsl(var(--destructive)/0.24)] bg-[hsl(var(--destructive-soft))] px-3 py-2 text-xs font-semibold text-destructive">
          ToDo 操作失败，请确认后端服务和登录状态后再试。
        </div>
      )}

      <MobileTabs activeTab={activeTab} onTabChange={onTabChange} />
      {activeTab === 'today' ? <MobileTodaySections {...props} /> : <MobileHistorySection {...props} />}
    </div>
  )
}

function MobileQuickCreate({ today, pending, onCreate }: {
  today: string
  pending: boolean
  onCreate: (input: { title: string; priority: Priority; addToday: boolean; dueDate?: string }) => void
}) {
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<Priority | null>(null)
  const [addToday, setAddToday] = useState(false)
  const [priorityError, setPriorityError] = useState(false)

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    if (!priority) {
      setPriorityError(true)
      return
    }
    onCreate({ title: trimmed, priority, addToday, dueDate: addToday ? today : undefined })
    setTitle('')
    setPriority(null)
    setAddToday(false)
    setPriorityError(false)
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border bg-card p-2 shadow-[var(--shadow-sm)]">
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="写下要处理的事"
        className="nexus-input h-10 w-full rounded-lg px-3 text-base font-semibold"
      />
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {PRIORITIES.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => {
              setPriority(item)
              setPriorityError(false)
            }}
            className={cn(
              'h-9 rounded-lg border text-sm font-black transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              PRIORITY_STYLES[item],
              priority === item ? 'ring-2 ring-ring ring-offset-1' : 'opacity-80',
            )}
          >
            {PRIORITY_LABELS[item]}
          </button>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <button
          type="button"
          onClick={() => setAddToday((value) => !value)}
          className={cn(
            'inline-flex h-10 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-bold transition-colors',
            addToday ? 'border-primary/35 bg-primary/10 text-primary' : 'bg-background text-foreground',
          )}
        >
          <span className={cn('flex h-4 w-4 items-center justify-center rounded border', addToday && 'border-primary bg-primary text-primary-foreground')}>
            {addToday && <Check className="h-3 w-3" strokeWidth={3} />}
          </span>
          加入今日
        </button>
        <button
          type="submit"
          disabled={!title.trim() || pending}
          className="nexus-button-primary h-10 min-w-24 gap-1.5 rounded-full px-4 text-sm disabled:bg-muted disabled:text-muted-foreground"
        >
          <Plus className="h-4 w-4" /> 添加
        </button>
      </div>
      {priorityError && <p className="mt-1.5 px-1 text-[11px] font-semibold text-destructive">请选择优先级。</p>}
    </form>
  )
}

function MobileTabs({ activeTab, onTabChange }: { activeTab: TodoTab; onTabChange: (tab: TodoTab) => void }) {
  return (
    <div className="grid grid-cols-2 rounded-xl border bg-card p-1">
      {([
        ['today', '今日'],
        ['history', '历史'],
      ] as const).map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onTabChange(key)}
          className={cn(
            'h-9 rounded-lg text-sm font-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            activeTab === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function MobileTodaySections(props: TodoMainViewProps) {
  const {
    today,
    schedulePending,
    todayLoading,
    todayError,
    pendingLoading,
    pendingError,
    overdueLoading,
    overdueError,
    todayInProgress,
    todayNotStarted,
    pendingItems,
    overdueItems,
    poolOpen,
    overdueOpen,
    onPoolOpenChange,
    onOverdueOpenChange,
    onStatusStep,
    onStatusChange,
    onScheduleToday,
    onOpenTodo,
  } = props

  return (
    <div className="space-y-4">
      <MobileSection title="今日" count={todayInProgress.length + todayNotStarted.length} loading={todayLoading} error={todayError} empty="今天还没有执行项">
        {todayInProgress.length > 0 && <MobileGroupLabel label="进行中" />}
        {todayInProgress.map((item) => <MobileTodoRow key={item.id} item={item} onOpen={() => onOpenTodo(item)} onStatusStep={() => onStatusStep(item)} />)}
        {todayNotStarted.length > 0 && <MobileGroupLabel label="未开始" />}
        {todayNotStarted.map((item) => <MobileTodoRow key={item.id} item={item} onOpen={() => onOpenTodo(item)} onStatusStep={() => onStatusStep(item)} />)}
      </MobileSection>

      <MobileSection title="待分配" count={pendingItems.length} loading={pendingLoading} error={pendingError} empty="没有待分配任务" collapsible open={poolOpen} onOpenChange={onPoolOpenChange}>
        {pendingItems.map((item) => (
          <MobileTodoRow
            key={item.id}
            item={item}
            onOpen={() => onOpenTodo(item)}
            onStatusStep={() => onStatusStep(item)}
            trailing={
              <div className="flex items-center gap-1">
                <ScheduleTodayPopover item={item} today={today} pending={schedulePending} onConfirm={(dueDate) => onScheduleToday(item, dueDate)} />
                <button
                  type="button"
                  aria-label="取消"
                  onClick={() => onStatusChange(item, 'cancelled')}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border bg-background text-muted-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            }
          />
        ))}
      </MobileSection>

      <MobileSection title="已过期" count={overdueItems.length} loading={overdueLoading} error={overdueError} empty="没有过期任务" collapsible open={overdueOpen} onOpenChange={onOverdueOpenChange}>
        {overdueItems.map((item) => <MobileTodoRow key={item.id} item={item} onOpen={() => onOpenTodo(item)} onStatusStep={() => onStatusStep(item)} />)}
      </MobileSection>
    </div>
  )
}

function MobileHistorySection({
  historyStatus,
  historyLoading,
  historyError,
  historyItems,
  onHistoryStatusChange,
  onStatusStep,
  onOpenTodo,
}: TodoMainViewProps) {
  return (
    <MobileSection
      title="历史 ToDo"
      count={historyItems.length}
      loading={historyLoading}
      error={historyError}
      empty="没有匹配的历史任务"
      toolbar={<StatusFilterSelect value={historyStatus} onChange={onHistoryStatusChange} />}
    >
      {historyItems.map((item) => <MobileTodoRow key={item.id} item={item} onOpen={() => onOpenTodo(item)} onStatusStep={() => onStatusStep(item)} />)}
    </MobileSection>
  )
}

function MobileSection({ title, count, loading, error, empty, children, collapsible = false, open = true, onOpenChange, toolbar }: {
  title: string
  count: number
  loading: boolean
  error: boolean
  empty: string
  children: React.ReactNode
  collapsible?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  toolbar?: React.ReactNode
}) {
  const visible = !collapsible || open
  return (
    <section className="space-y-2">
      <div className="flex min-h-8 items-center justify-between gap-2">
        <button
          type="button"
          disabled={!collapsible}
          onClick={() => collapsible && onOpenChange?.(!open)}
          className="flex min-w-0 items-center gap-1.5 rounded-lg text-left text-lg font-black"
        >
          {collapsible && <ChevronDown className={cn('h-4 w-4 transition-transform', !open && '-rotate-90')} />}
          <span className="truncate">{title}</span>
          <span className="text-xs font-black text-muted-foreground">{count}</span>
        </button>
        {toolbar}
      </div>
      {!visible ? null : loading ? (
        <p className="px-1 py-2 text-xs text-muted-foreground">加载中...</p>
      ) : error ? (
        <p className="rounded-lg border border-[hsl(var(--destructive)/0.24)] bg-[hsl(var(--destructive-soft))] px-3 py-2 text-xs font-semibold text-destructive">
          加载失败，请确认后端服务已启动。
        </p>
      ) : count > 0 ? (
        <ul className="space-y-1.5">{children}</ul>
      ) : (
        <p className="px-1 py-2 text-sm text-muted-foreground">{empty}</p>
      )}
    </section>
  )
}

function MobileGroupLabel({ label }: { label: string }) {
  return <li className="px-1 pt-0.5 text-[12px] font-black text-muted-foreground">{label}</li>
}

function MobileTodoRow({ item, trailing, onOpen, onStatusStep }: {
  item: Todo
  trailing?: React.ReactNode
  onOpen: () => void
  onStatusStep: () => void
}) {
  const priority = normalizePriority(item.priority)
  return (
    <li className={cn('flex min-h-11 items-center gap-2 rounded-xl border border-l-4 bg-card px-2.5 py-1.5 shadow-[var(--shadow-xs)]', PRIORITY_ROW_STYLES[priority])}>
      <MobileStatusButton status={item.status} onClick={onStatusStep} />
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        <span className={cn('min-w-0 flex-1 truncate text-sm font-black', item.status === 'done' && 'text-muted-foreground line-through')}>{item.title}</span>
        {item.dueDate && <span className="shrink-0 text-xs font-medium text-muted-foreground">{item.dueDate.slice(5)}</span>}
      </button>
      {trailing}
    </li>
  )
}

function MobileStatusButton({ status, onClick }: { status: TodoStatus; onClick: () => void }) {
  const clickable = status === 'not_started' || status === 'in_progress'
  return (
    <button
      type="button"
      title={STATUS_LABELS[status]}
      aria-label={`当前状态：${STATUS_LABELS[status]}`}
      disabled={!clickable}
      onClick={onClick}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground"
    >
      {status === 'done' && <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="h-2.5 w-2.5" strokeWidth={3} /></span>}
      {status === 'pending' && <span className="flex h-4 w-4 items-center justify-center rounded-full border bg-background"><Pause className="h-2.5 w-2.5" /></span>}
      {status === 'cancelled' && <span className="flex h-4 w-4 items-center justify-center rounded-full border bg-background"><X className="h-2.5 w-2.5" /></span>}
      {status === 'not_started' && <span className="h-4 w-4 rounded-full border-[1.5px] border-muted-foreground/55 bg-background" />}
      {status === 'in_progress' && (
        <span className="relative flex h-4 w-4 items-center justify-center rounded-full border border-primary/35 bg-background">
          <span className="absolute h-4 w-4 animate-ping rounded-full bg-primary/20" />
          <span className="h-2 w-2 rounded-full bg-primary" />
        </span>
      )}
    </button>
  )
}
