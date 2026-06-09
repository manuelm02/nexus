import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as AlertDialog from '@radix-ui/react-alert-dialog'
import * as Dialog from '@radix-ui/react-dialog'
import * as Select from '@radix-ui/react-select'
import {
  CalendarPlus, Check, ChevronDown, Info, Pause, Plus, Trash2, X,
} from 'lucide-react'
import { todoApi } from '../../api/todo.api'
import type { Todo } from '../../types/domain.types'
import { PRIORITY_LABELS, STATUS_LABELS } from '../../lib/constants'
import { cn } from '../../lib/utils'

type Priority = Todo['priority']
type TodoStatus = Todo['status']
type TodoTab = 'today' | 'history'

const PRIORITIES: Priority[] = ['low', 'medium', 'high']
const TODO_STATUSES: TodoStatus[] = ['pending', 'cancelled', 'not_started', 'in_progress', 'done']

const PRIORITY_STYLES: Record<Priority, string> = {
  low: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  medium: 'border-amber-200 bg-amber-50 text-amber-700',
  high: 'border-red-300 bg-red-50 text-red-900',
}

const PRIORITY_ROW_STYLES: Record<Priority, string> = {
  low: 'border-emerald-200 bg-emerald-50/45 hover:bg-emerald-50/70',
  medium: 'border-amber-200 bg-amber-50/45 hover:bg-amber-50/70',
  high: 'border-red-300 bg-red-50/45 hover:bg-red-50/70',
}

const todayString = () => new Date().toISOString().slice(0, 10)

const normalizePriority = (priority?: string): Priority => {
  if (priority === 'low' || priority === 'medium' || priority === 'high') return priority
  if (priority === 'urgent') return 'high'
  return 'medium'
}

// TodoPage 承载今日优先的 ToDo 工作流，并把历史任务拆到独立页签。
export default function TodoPage() {
  const [activeTab, setActiveTab] = useState<TodoTab>('today')
  const [historyStatus, setHistoryStatus] = useState<TodoStatus | ''>('done')
  const [scheduleTarget, setScheduleTarget] = useState<Todo | null>(null)
  const [detailTarget, setDetailTarget] = useState<Todo | null>(null)
  const [poolOpen, setPoolOpen] = useState(true)
  const [overdueOpen, setOverdueOpen] = useState(true)
  const qc = useQueryClient()
  const today = useMemo(() => todayString(), [])

  const pendingQuery = useQuery({
    queryKey: ['todo', 'pool'],
    queryFn: () => todoApi.list({ status: 'pending' }),
  })
  const todayQuery = useQuery({
    queryKey: ['todo', 'today', today],
    queryFn: () => todoApi.list({ date: today }),
  })
  const overdueQuery = useQuery({
    queryKey: ['todo', 'overdue'],
    queryFn: () => todoApi.list({ overdue: true }),
  })
  const historyQuery = useQuery({
    queryKey: ['todo', 'history', historyStatus],
    queryFn: () => todoApi.list({ status: historyStatus || undefined }),
  })

  const invalidateTodo = () => qc.invalidateQueries({ queryKey: ['todo'] })

  const createMutation = useMutation({
    mutationFn: async (input: { title: string; priority: Priority; addToday: boolean; dueDate?: string }) => {
      const created = await todoApi.create({ title: input.title, priority: input.priority })
      const todo = created.data.data
      if (input.addToday && todo) {
        await todoApi.scheduleToday(todo.id, input.dueDate || today)
      }
    },
    onSuccess: invalidateTodo,
  })
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TodoStatus }) => todoApi.updateStatus(id, status),
    onSuccess: invalidateTodo,
  })
  const scheduleMutation = useMutation({
    mutationFn: ({ id, dueDate }: { id: string; dueDate: string }) => todoApi.scheduleToday(id, dueDate),
    onSuccess: () => {
      invalidateTodo()
      setScheduleTarget(null)
    },
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Todo> }) => todoApi.update(id, data),
    onSuccess: () => {
      invalidateTodo()
      setDetailTarget(null)
    },
  })
  const deleteMutation = useMutation({
    mutationFn: (id: string) => todoApi.delete(id),
    onSuccess: () => {
      invalidateTodo()
      setDetailTarget(null)
    },
  })

  const pendingItems = pendingQuery.data?.data?.data ?? []
  const todayItems = (todayQuery.data?.data?.data ?? []).filter((item) => !['pending', 'cancelled', 'done'].includes(item.status))
  const todayInProgress = todayItems.filter((item) => item.status === 'in_progress')
  const todayNotStarted = todayItems.filter((item) => item.status === 'not_started')
  const overdueItems = overdueQuery.data?.data?.data ?? []
  const historyItems = historyQuery.data?.data?.data ?? []

  const handleStatusChange = (item: Todo, status: TodoStatus) => {
    statusMutation.mutate({ id: item.id, status })
  }

  const handleStatusStep = (item: Todo) => {
    const nextStatus = getNextRowStatus(item.status)
    if (nextStatus !== item.status) handleStatusChange(item, nextStatus)
  }

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-8 space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-[-0.04em] md:text-4xl">ToDo</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">今日执行、待分配、过期处理和历史恢复。</p>
        </div>
      </div>

      <QuickCreate
        today={today}
        pending={createMutation.isPending}
        onCreate={(input) => createMutation.mutate(input)}
      />
      {(createMutation.isError || statusMutation.isError || scheduleMutation.isError || updateMutation.isError || deleteMutation.isError) && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          ToDo 操作失败，请确认后端服务和登录状态后再试。
        </div>
      )}

      <div className="flex rounded-md border bg-card p-1">
        {([
          ['today', '今日'],
          ['history', '历史'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={cn(
              'h-9 flex-1 rounded-sm text-sm transition-colors',
              activeTab === key ? 'bg-primary text-primary-foreground font-medium' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'today' ? (
        <div className="space-y-5">
          <TodoSection title="今日" loading={todayQuery.isLoading} empty="今天还没有执行项">
            {todayQuery.isError && <ErrorRow text="今日 ToDo 加载失败，请确认后端服务已启动。" />}
            {todayInProgress.length > 0 && <TodoGroupLabel label="进行中" />}
            {todayInProgress.map((item) => (
              <TodoRow key={item.id} item={item} onOpen={() => setDetailTarget(item)} onStatusStep={() => handleStatusStep(item)} />
            ))}
            {todayNotStarted.length > 0 && <TodoGroupLabel label="未开始" />}
            {todayNotStarted.map((item) => (
              <TodoRow key={item.id} item={item} onOpen={() => setDetailTarget(item)} onStatusStep={() => handleStatusStep(item)} />
            ))}
          </TodoSection>

          <TodoSection
            title="待分配"
            loading={pendingQuery.isLoading}
            empty="没有待分配任务"
            collapsible
            open={poolOpen}
            onOpenChange={setPoolOpen}
          >
            {pendingQuery.isError && <ErrorRow text="待分配 ToDo 加载失败，请确认后端服务已启动。" />}
            {pendingItems.map((item) => (
              <TodoRow
                key={item.id}
                item={item}
                onOpen={() => setDetailTarget(item)}
                onStatusStep={() => handleStatusStep(item)}
                trailing={
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setScheduleTarget(item)}
                      className="nexus-button-utility h-9 shrink-0 gap-1.5 px-2.5 text-xs text-muted-foreground"
                    >
                      <CalendarPlus className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">加入今日</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStatusChange(item, 'cancelled')}
                      className="nexus-button-utility h-9 shrink-0 gap-1.5 px-2.5 text-xs text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">取消</span>
                    </button>
                  </div>
                }
              />
            ))}
          </TodoSection>

          <TodoSection
            title="已过期"
            loading={overdueQuery.isLoading}
            empty="没有过期任务"
            collapsible
            open={overdueOpen}
            onOpenChange={setOverdueOpen}
          >
            {overdueQuery.isError && <ErrorRow text="已过期 ToDo 加载失败，请确认后端服务已启动。" />}
            {overdueItems.map((item) => (
              <TodoRow
                key={item.id}
                item={item}
                onOpen={() => setDetailTarget(item)}
                onStatusStep={() => handleStatusStep(item)}
              />
            ))}
          </TodoSection>
        </div>
      ) : (
        <TodoSection
          title="历史 ToDo"
          loading={historyQuery.isLoading}
          empty="没有匹配的历史任务"
          toolbar={
            <StatusFilterSelect
              value={historyStatus}
              onChange={setHistoryStatus}
            />
          }
        >
          {historyQuery.isError && <ErrorRow text="历史 ToDo 加载失败，请确认后端服务已启动。" />}
          {historyItems.map((item) => (
            <TodoRow
              key={item.id}
              item={item}
              onOpen={() => setDetailTarget(item)}
              onStatusStep={() => handleStatusStep(item)}
            />
          ))}
        </TodoSection>
      )}

      <ScheduleDialog
        item={scheduleTarget}
        today={today}
        pending={scheduleMutation.isPending}
        onOpenChange={(open) => !open && setScheduleTarget(null)}
        onConfirm={(dueDate) => scheduleTarget && scheduleMutation.mutate({ id: scheduleTarget.id, dueDate })}
      />
      <TodoDetailDialog
        item={detailTarget}
        saving={updateMutation.isPending}
        deleting={deleteMutation.isPending}
        onOpenChange={(open) => !open && setDetailTarget(null)}
        onSave={(id, data) => updateMutation.mutate({ id, data })}
        onDelete={(id) => deleteMutation.mutate(id)}
      />
    </div>
  )
}

function QuickCreate({ today, pending, onCreate }: {
  today: string
  pending: boolean
  onCreate: (input: { title: string; priority: Priority; addToday: boolean; dueDate?: string }) => void
}) {
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<Priority | null>(null)
  const [addToday, setAddToday] = useState(false)
  const [dueDate, setDueDate] = useState(today)
  const [priorityError, setPriorityError] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    if (!priority) {
      setPriorityError(true)
      return
    }
    onCreate({ title: trimmed, priority, addToday, dueDate: addToday ? dueDate : undefined })
    setTitle('')
    setPriority(null)
    setAddToday(false)
    setDueDate(today)
    setPriorityError(false)
  }

  return (
    <form onSubmit={handleSubmit} className="nexus-surface rounded-lg p-3 sm:p-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-center">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="写下要处理的事"
          className="nexus-input h-11 w-full min-w-0 px-3 text-base sm:text-sm lg:min-w-[320px]"
        />
        <div className="min-w-0 lg:w-[216px]">
          <PriorityPicker
            value={priority}
            onChange={(nextPriority) => {
              setPriority(nextPriority)
              setPriorityError(false)
            }}
            compact
          />
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:grid-cols-[auto_auto] sm:justify-end lg:justify-start">
          <label className="nexus-button-utility h-11 justify-start gap-2 px-3 text-sm text-foreground">
            <input
              type="checkbox"
              checked={addToday}
              onChange={(e) => setAddToday(e.target.checked)}
              className="h-4 w-4 rounded border-muted-foreground/40"
            />
            加入今日
          </label>
          <button
            type="submit"
            disabled={!title.trim() || pending}
            className="nexus-button-primary h-11 gap-2 px-5 text-sm"
          >
            <Plus className="h-4 w-4" /> 添加
          </button>
        </div>
      </div>

      {priorityError && (
        <p className="mt-2 px-1 text-xs text-destructive">请选择一个优先级后再添加。</p>
      )}

      {addToday && (
        <div className="mt-3 border-t pt-3">
          <label className="grid gap-1.5 text-xs font-medium text-muted-foreground sm:max-w-xs">
            截止日期
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="nexus-input h-10 px-3 text-sm font-normal text-foreground"
            />
          </label>
        </div>
      )}
    </form>
  )
}

function PriorityPicker({ value, onChange, compact = false }: { value?: Priority | null; onChange: (value: Priority) => void; compact?: boolean }) {
  return (
    <div className={cn('grid grid-cols-3 gap-2', compact && 'w-full')}>
      {PRIORITIES.map((priority) => (
        <button
          key={priority}
          type="button"
          onClick={() => onChange(priority)}
          className={cn(
            'h-10 min-w-0 rounded-md border px-3 text-sm font-medium transition-all',
            PRIORITY_STYLES[priority],
            value === priority ? 'ring-2 ring-ring ring-offset-1' : 'opacity-75 hover:opacity-100',
            compact && 'h-11 px-2 text-sm',
          )}
        >
          {PRIORITY_LABELS[priority]}
        </button>
      ))}
    </div>
  )
}

function StatusFilterSelect({ value, onChange }: { value: TodoStatus | ''; onChange: (value: TodoStatus | '') => void }) {
  return (
    <StatusSelectBase
      value={value || 'all'}
      onChange={(nextValue) => onChange(nextValue === 'all' ? '' : nextValue as TodoStatus)}
      options={[['all', '全部状态'], ...TODO_STATUSES.map((status) => [status, STATUS_LABELS[status]] as const)]}
      className="h-9 min-w-28 px-2 text-xs"
    />
  )
}

function StatusSelect({ value, onChange }: { value: TodoStatus; onChange: (value: TodoStatus) => void }) {
  return (
    <StatusSelectBase
      value={value}
      onChange={(nextValue) => onChange(nextValue as TodoStatus)}
      options={TODO_STATUSES.map((status) => [status, STATUS_LABELS[status]] as const)}
      className="h-10 w-full px-3 text-sm"
    />
  )
}

function StatusSelectBase({ value, onChange, options, className }: {
  value: string
  onChange: (value: string) => void
  options: readonly (readonly [string, string])[]
  className: string
}) {
  return (
    <Select.Root value={value} onValueChange={onChange}>
      <Select.Trigger
        className={cn(
          'inline-flex items-center justify-between gap-2 rounded-md border bg-card text-foreground shadow-sm transition-colors hover:bg-accent/60 focus:outline-none focus:ring-2 focus:ring-ring',
          className,
        )}
      >
        <Select.Value />
        <Select.Icon>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={6}
          className="z-[70] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg"
        >
          <Select.Viewport>
            {options.map(([optionValue, label]) => (
              <Select.Item
                key={optionValue}
                value={optionValue}
                className="relative flex h-9 cursor-default select-none items-center rounded-md px-8 text-sm outline-none transition-colors data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
              >
                <Select.ItemIndicator className="absolute left-2 flex h-4 w-4 items-center justify-center text-primary">
                  <Check className="h-3.5 w-3.5" />
                </Select.ItemIndicator>
                <Select.ItemText>{label}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  )
}

function TodoSection({ title, loading, empty, toolbar, children, collapsible = false, open = true, onOpenChange }: {
  title: string
  loading: boolean
  empty: string
  toolbar?: React.ReactNode
  children: React.ReactNode
  collapsible?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const rendered = useMemo(() => ReactChildren(children), [children])
  const visible = !collapsible || open !== false
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          disabled={!collapsible}
          onClick={() => collapsible && onOpenChange?.(!(open ?? true))}
          className={cn(
            'flex min-h-8 items-center gap-1.5 rounded-md text-sm font-semibold',
            collapsible && 'pr-2 text-left hover:text-primary',
          )}
        >
          {collapsible && <ChevronDown className={cn('h-4 w-4 transition-transform', open === false && '-rotate-90')} />}
          {title}
          <span className="text-xs font-normal text-muted-foreground">{rendered.filter(isTodoItemNode).length}</span>
        </button>
        {toolbar}
      </div>
      {!visible ? null : loading ? (
        <p className="px-1 py-3 text-sm text-muted-foreground">加载中...</p>
      ) : rendered.length > 0 ? (
        <ul className="space-y-2">{rendered}</ul>
      ) : (
        <p className="px-1 py-3 text-sm text-muted-foreground">{empty}</p>
      )}
    </section>
  )
}

function isTodoItemNode(node: React.ReactNode) {
  return typeof node === 'object' && node !== null && 'props' in node && !(node as { props?: { 'data-group-label'?: boolean } }).props?.['data-group-label']
}

function TodoGroupLabel({ label }: { label: string }) {
  return (
    <li data-group-label className="px-1 pt-1 text-xs font-medium text-muted-foreground">
      {label}
    </li>
  )
}

function ReactChildren(children: React.ReactNode) {
  return Array.isArray(children) ? children.flat().filter(Boolean) : [children].filter(Boolean)
}

function ErrorRow({ text }: { text: string }) {
  return (
    <li className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
      {text}
    </li>
  )
}

function TodoRow({ item, trailing, onOpen, onStatusStep }: {
  item: Todo
  trailing?: React.ReactNode
  onOpen: () => void
  onStatusStep: () => void
}) {
  const priority = normalizePriority(item.priority)

  return (
    <li className={cn('group flex min-h-12 items-center gap-2 rounded-lg border px-2.5 py-1.5 transition-colors sm:px-3', PRIORITY_ROW_STYLES[priority])}>
      <StatusCycleButton status={item.status} onClick={onStatusStep} />
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        <p className={cn('min-w-0 flex-1 truncate text-sm font-medium', item.status === 'done' && 'text-muted-foreground line-through')}>
          {item.title}
        </p>
        <span className={cn('hidden rounded border px-1.5 py-0.5 text-xs sm:inline-flex', PRIORITY_STYLES[priority])}>
          {PRIORITY_LABELS[priority]}
        </span>
        {item.dueDate && <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">截止 {item.dueDate}</span>}
        {item.dueDate && <span className="shrink-0 text-xs text-muted-foreground sm:hidden">{item.dueDate.slice(5)}</span>}
        <Info className="hidden h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 sm:block" />
      </button>
      {trailing && <div className="flex shrink-0 justify-end">{trailing}</div>}
    </li>
  )
}

function getNextRowStatus(status: TodoStatus): TodoStatus {
  if (status === 'not_started') return 'in_progress'
  if (status === 'in_progress') return 'done'
  return status
}

function StatusCycleButton({ status, onClick }: { status: TodoStatus; onClick: () => void }) {
  const clickable = status === 'not_started' || status === 'in_progress'
  return (
    <button
      type="button"
      title={STATUS_LABELS[status]}
      aria-label={`当前状态：${STATUS_LABELS[status]}`}
      onClick={onClick}
      disabled={!clickable}
      className={cn(
        'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-all',
        clickable && 'hover:bg-background/70 hover:text-primary',
        !clickable && status !== 'done' && 'cursor-default',
      )}
    >
      {status === 'done' && (
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
          <Check className="h-2.5 w-2.5" strokeWidth={3} />
        </span>
      )}
      {status === 'pending' && (
        <span className="flex h-4 w-4 items-center justify-center rounded-full border border-muted-foreground/30 bg-background/70">
          <Pause className="h-2.5 w-2.5" />
        </span>
      )}
      {status === 'cancelled' && (
        <span className="flex h-4 w-4 items-center justify-center rounded-full border border-muted-foreground/30 bg-background/70">
          <X className="h-2.5 w-2.5" />
        </span>
      )}
      {status === 'not_started' && <span className="h-4 w-4 rounded-full border-[1.5px] border-muted-foreground/55 bg-background/40 shadow-[inset_0_0_0_1px_hsl(var(--background))]" />}
      {status === 'in_progress' && (
        <span className="relative flex h-4 w-4 items-center justify-center rounded-full border border-primary/35 bg-background/80">
          <span className="absolute h-4 w-4 animate-ping rounded-full bg-primary/20" />
          <span className="h-2 w-2 rounded-full bg-primary shadow-sm" />
        </span>
      )}
    </button>
  )
}

function ScheduleDialog({ item, today, pending, onOpenChange, onConfirm }: {
  item: Todo | null
  today: string
  pending: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (dueDate: string) => void
}) {
  const [dueDate, setDueDate] = useState(today)

  useEffect(() => {
    if (item) setDueDate(item.dueDate || today)
  }, [item, today])

  return (
    <Dialog.Root open={!!item} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" />
        <Dialog.Content className="nexus-surface fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg p-4">
          <Dialog.Title className="text-base font-semibold">加入今日</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted-foreground">
            选择这个 ToDo 的截止日期。
          </Dialog.Description>
          <label className="mt-4 block space-y-2 text-sm">
            <span className="text-xs font-medium text-muted-foreground">截止日期</span>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="nexus-input h-10 w-full px-3 text-sm"
            />
          </label>
          <div className="mt-5 flex justify-end gap-2">
            <Dialog.Close asChild>
              <button type="button" className="nexus-button-utility h-10 px-3 text-sm">取消</button>
            </Dialog.Close>
            <button
              type="button"
              disabled={pending}
              onClick={() => onConfirm(dueDate || today)}
              className="nexus-button-primary h-10 px-4 text-sm"
            >
              确认加入
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function TodoDetailDialog({ item, saving, deleting, onOpenChange, onSave, onDelete }: {
  item: Todo | null
  saving: boolean
  deleting: boolean
  onOpenChange: (open: boolean) => void
  onSave: (id: string, data: Partial<Todo>) => void
  onDelete: (id: string) => void
}) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'medium' as Priority,
    status: 'pending' as TodoStatus,
    scheduledDate: '',
    dueDate: '',
  })

  useEffect(() => {
    if (!item) return
    setForm({
      title: item.title,
      description: item.description ?? '',
      priority: normalizePriority(item.priority),
      status: item.status,
      scheduledDate: item.scheduledDate ?? '',
      dueDate: item.dueDate ?? '',
    })
  }, [item])

  const handleSave = () => {
    if (!item || !form.title.trim()) return
    onSave(item.id, {
      title: form.title.trim(),
      description: form.description,
      priority: form.priority,
      status: form.status,
      scheduledDate: form.scheduledDate || undefined,
      dueDate: form.dueDate || undefined,
    })
  }

  return (
    <Dialog.Root open={!!item} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" />
        <Dialog.Content className="nexus-surface fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg p-4">
          <div className="flex items-center justify-between gap-3">
            <Dialog.Title className="text-base font-semibold">ToDo 详情</Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" className="nexus-button-utility h-9 w-9 text-muted-foreground" aria-label="关闭">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="mt-4 space-y-4">
            <label className="block space-y-2">
              <span className="text-xs font-medium text-muted-foreground">标题</span>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="nexus-input h-10 w-full px-3 text-sm"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-xs font-medium text-muted-foreground">备注</span>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={4}
                className="nexus-input w-full resize-y px-3 py-2 text-sm"
              />
            </label>

            <div className="space-y-2">
              <span className="text-xs font-medium text-muted-foreground">优先级</span>
              <PriorityPicker value={form.priority} onChange={(priority) => setForm({ ...form, priority })} />
            </div>

            <label className="block space-y-2">
              <span className="text-xs font-medium text-muted-foreground">状态</span>
              <StatusSelect
                value={form.status}
                onChange={(status) => setForm({ ...form, status })}
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-xs font-medium text-muted-foreground">计划日期</span>
                <input
                  type="date"
                  value={form.scheduledDate}
                  onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })}
                  className="nexus-input h-10 w-full px-3 text-sm"
                />
              </label>
              <label className="block space-y-2">
                <span className="text-xs font-medium text-muted-foreground">截止日期</span>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                  className="nexus-input h-10 w-full px-3 text-sm"
                />
              </label>
            </div>
          </div>

          <div className="mt-5 flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            {item && (
              <DeleteTodoConfirm deleting={deleting} onConfirm={() => onDelete(item.id)} />
            )}
            <div className="flex justify-end gap-2">
              <Dialog.Close asChild>
                <button type="button" className="nexus-button-utility h-10 px-3 text-sm">取消</button>
              </Dialog.Close>
              <button
                type="button"
                disabled={saving || !form.title.trim()}
                onClick={handleSave}
                className="nexus-button-primary h-10 px-4 text-sm"
              >
                保存
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function DeleteTodoConfirm({ deleting, onConfirm }: { deleting: boolean; onConfirm: () => void }) {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger asChild>
        <button
          type="button"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-destructive/40 px-3 text-sm text-destructive transition-colors hover:bg-destructive/10"
        >
          <Trash2 className="h-4 w-4" /> 删除
        </button>
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-sm" />
        <AlertDialog.Content className="nexus-surface fixed left-1/2 top-1/2 z-[60] w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg p-4">
          <AlertDialog.Title className="text-base font-semibold">确认删除这个 ToDo？</AlertDialog.Title>
          <AlertDialog.Description className="mt-1 text-sm text-muted-foreground">
            此操作无法撤销。
          </AlertDialog.Description>
          <div className="mt-5 flex justify-end gap-2">
            <AlertDialog.Cancel className="nexus-button-utility h-10 px-3 text-sm">取消</AlertDialog.Cancel>
            <AlertDialog.Action
              disabled={deleting}
              onClick={onConfirm}
              className="h-10 rounded-md bg-destructive px-3 text-sm text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
            >
              确认删除
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
