import { Check, ChevronDown, Plus, X } from 'lucide-react'
import { useRef, useState } from 'react'
import type { Todo } from '../../types/domain.types'
import { PRIORITY_LABELS, STATUS_LABELS } from '../../lib/constants'
import { cn } from '../../lib/utils'
import { Tabs } from '../../components/shell'
import { MobileTaskCard, StatusFilterSelect } from './todo.components'
import { TodoDatePicker } from './components/TodoDatePicker'
import {
  PRIORITIES,
  PRIORITY_ROW_STYLES,
  PRIORITY_STYLES,
  normalizePriority,
  type Priority,
  type TodoStatus,
} from './todo.shared'
import type { TodoMainViewProps } from './TodoDesktopView'

// TodoMobileView 使用独立移动端信息架构，适配看板三栏 + 任务 + 历史。
export function TodoMobileView(props: TodoMainViewProps) {
  const {
    activeTab,
    operationError,
    createPending,
    onCreate,
    onTabChange,
  } = props

  return (
    <div className="nexus-page-enter space-y-3 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+4rem)] pt-3 md:hidden">
      <MobileQuickCreate pending={createPending} onCreate={onCreate} />
      {operationError && (
        <div className="rounded-lg border border-[hsl(var(--destructive)/0.24)] bg-[hsl(var(--destructive-soft))] px-3 py-2 text-xs font-semibold text-destructive">
          ToDo 操作失败，请确认后端服务和登录状态后再试。
        </div>
      )}

      <Tabs
        variant="segmented"
        value={activeTab}
        onChange={onTabChange}
        items={[
          { value: 'list', label: 'List' },
          { value: 'tasks', label: '任务' },
          { value: 'history', label: '历史' },
        ]}
      />
      {activeTab === 'list' ? <MobileBoardSections {...props} /> : activeTab === 'tasks' ? <MobileTaskSection {...props} /> : <MobileHistorySection {...props} />}
    </div>
  )
}

// MobileQuickCreate 移动端快速添加：默认只显示输入框+添加按钮，按需展开优先级和日期。
function MobileQuickCreate({ pending, onCreate }: {
  pending: boolean
  onCreate: (input: { title: string; priority: Priority; scheduledDate?: string; dueDate?: string }) => void
}) {
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<Priority>('medium')
  const [scheduledDate, setScheduledDate] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [priorityError, setPriorityError] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // 输入框获得焦点或已有内容时自动展开设置层
  const shouldExpand = expanded || !!title.trim()

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    onCreate({
      title: trimmed,
      priority,
      scheduledDate: scheduledDate || undefined,
      dueDate: scheduledDate || undefined,
    })
    // 添加成功：清空标题、收起设置、重置为 medium、清空日期
    setTitle('')
    setPriority('medium')
    setScheduledDate('')
    setExpanded(false)
    setPriorityError(false)
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border bg-card p-2 shadow-[var(--shadow-sm)]">
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          value={title}
          onChange={(event) => {
            setTitle(event.target.value)
            if (event.target.value.trim()) setExpanded(true)
          }}
          onFocus={() => setExpanded(true)}
          placeholder="写下要处理的事"
          className="nexus-input h-10 flex-1 rounded-lg px-3 text-base font-semibold"
        />
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-background text-muted-foreground transition-colors',
            shouldExpand && 'border-primary/40 text-primary',
          )}
          aria-label="展开设置"
        >
          <ChevronDown className={cn('h-4 w-4 transition-transform', shouldExpand && 'rotate-180')} />
        </button>
        <button
          type="submit"
          disabled={!title.trim() || pending}
          className="nexus-button-primary h-10 min-w-20 shrink-0 gap-1.5 rounded-lg px-3 text-sm disabled:bg-muted disabled:text-muted-foreground"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {shouldExpand && (
        <div className="mt-2 space-y-2 border-t pt-2">
          {/* 优先级 segmented control */}
          <div className="grid grid-cols-3 gap-1.5">
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
                  priority === item ? 'ring-2 ring-ring ring-offset-1' : 'opacity-75',
                )}
              >
                {PRIORITY_LABELS[item]}
              </button>
            ))}
          </div>
          {priorityError && <p className="px-1 text-[11px] font-semibold text-destructive">请选择优先级。</p>}

          {/* 日期选择器：内嵌清空 + 快捷 chip */}
          <TodoDatePicker
            value={scheduledDate}
            onChange={setScheduledDate}
            allowClear
            showQuickChips
            compact
            placeholder="计划日期（可选）"
          />
        </div>
      )}
    </form>
  )
}

function MobileBoardSections(props: TodoMainViewProps) {
  const {
    boardLoading,
    boardError,
    todayItems,
    futureItems,
    overdueItems,
    overdueOpen,
    onOverdueOpenChange,
    onStatusStep,
    onOpenTodo,
  } = props

  return (
    <div className="space-y-4">
      <MobileSection title="今日" count={todayItems.length} loading={boardLoading} error={boardError} empty="今天还没有执行项">
        {todayItems.map((item) => <MobileTodoRow key={item.id} item={item} onOpen={() => onOpenTodo(item)} onStatusStep={() => onStatusStep(item)} />)}
      </MobileSection>

      <MobileSection title="未来" count={futureItems.length} loading={boardLoading} error={boardError} empty="没有未来计划">
        {futureItems.map((item) => <MobileTodoRow key={item.id} item={item} onOpen={() => onOpenTodo(item)} onStatusStep={() => onStatusStep(item)} />)}
      </MobileSection>

      <MobileSection title="已过期" count={overdueItems.length} loading={boardLoading} error={boardError} empty="没有过期任务" collapsible open={overdueOpen} onOpenChange={onOverdueOpenChange}>
        {overdueItems.map((item) => <MobileTodoRow key={item.id} item={item} onOpen={() => onOpenTodo(item)} onStatusStep={() => onStatusStep(item)} />)}
      </MobileSection>
    </div>
  )
}

function MobileTaskSection({ boardLoading, boardError, taskItems, onStatusChange, onScheduleTask, onOpenTodo }: TodoMainViewProps) {
  return (
    <MobileSection title="任务" count={taskItems.length} loading={boardLoading} error={boardError} empty="没有任务">
      {taskItems.map((item) => (
        <MobileTaskCard
          key={item.id}
          item={item}
          onOpen={() => onOpenTodo(item)}
          onSchedule={(date) => onScheduleTask(item.id, date)}
          onCancel={() => onStatusChange(item, 'cancelled')}
        />
      ))}
    </MobileSection>
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
          className="flex min-w-0 items-center gap-1.5 rounded-lg text-left text-base font-black"
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

function MobileTodoRow({ item, trailing, onOpen, onStatusStep }: {
  item: Todo
  trailing?: React.ReactNode
  onOpen: () => void
  onStatusStep: () => void
}) {
  const priority = normalizePriority(item.priority)
  return (
    <li className={cn('flex min-h-[3.5rem] items-center gap-2 rounded-xl border border-l-4 bg-card px-2.5 py-1.5 shadow-[var(--shadow-xs)]', PRIORITY_ROW_STYLES[priority])}>
      <MobileStatusButton status={item.status} onClick={onStatusStep} />
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        <span className={cn('min-w-0 flex-1 truncate text-sm font-black', item.status === 'done' && 'text-muted-foreground line-through')}>{item.title}</span>
        {item.scheduledDate && (
          <span className="shrink-0 text-xs font-medium text-muted-foreground">{item.scheduledDate.slice(5)}</span>
        )}
        {item.dueDate && (
          <span className="shrink-0 text-xs font-medium text-muted-foreground">→{item.dueDate.slice(5)}</span>
        )}
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
      className="flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground"
    >
      {status === 'done' && <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="h-2.5 w-2.5" strokeWidth={3} /></span>}
      {status === 'pending' && <span className="flex h-4 w-4 items-center justify-center rounded-full border bg-background"><div className="h-2.5 w-2.5" /></span>}
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
