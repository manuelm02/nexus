import { useEffect, useMemo, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import * as Popover from '@radix-ui/react-popover'
import * as Select from '@radix-ui/react-select'
import {
  CalendarPlus, Check, ChevronDown, Info, Pause, Plus, Trash2, X,
} from 'lucide-react'
import type { Todo } from '../../types/domain.types'
import { PRIORITY_LABELS, STATUS_LABELS } from '../../lib/constants'
import { cn } from '../../lib/utils'
import {
  PRIORITIES,
  PRIORITY_ROW_STYLES,
  PRIORITY_STYLES,
  TODO_STATUSES,
  normalizePriority,
  type Priority,
  type TodoStatus,
} from './todo.shared'

// QuickCreate 提供 ToDo 快速录入入口；移动端保持紧凑，复杂日期选择下沉到待分配操作。
export function QuickCreate({ today, pending, onCreate }: {
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
    <form onSubmit={handleSubmit} className="nexus-surface rounded-xl p-2 sm:rounded-2xl sm:p-4">
      <div className="grid gap-2 xl:grid-cols-[minmax(320px,1fr)_204px_auto_auto] xl:items-center">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="写下要处理的事"
          className="nexus-input h-9 w-full min-w-0 rounded-lg px-3 text-sm font-semibold sm:h-12 sm:rounded-xl sm:px-4 xl:min-w-[320px]"
        />
        <div className="min-w-0">
          <PriorityPicker
            value={priority}
            onChange={(nextPriority) => {
              setPriority(nextPriority)
              setPriorityError(false)
            }}
            compact
          />
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:grid-cols-[auto_auto] sm:justify-end xl:justify-start">
          <label className="nexus-button-utility h-9 justify-start gap-2 px-3 text-sm text-foreground sm:h-11">
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
            className="nexus-button-primary h-9 gap-2 px-4 text-sm sm:h-12 sm:px-6"
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
          <label className="grid gap-1.5 text-xs font-bold text-muted-foreground sm:max-w-xs">
            截止日期
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="nexus-input h-10 px-3 text-sm font-semibold text-foreground"
            />
          </label>
        </div>
      )}
    </form>
  )
}

// PriorityPicker 渲染低/中/高三档优先级选择，供快速创建和详情编辑复用。
export function PriorityPicker({ value, onChange, compact = false }: { value?: Priority | null; onChange: (value: Priority) => void; compact?: boolean }) {
  return (
    <div className={cn('grid grid-cols-3 gap-2', compact && 'w-full')}>
      {PRIORITIES.map((priority) => (
        <button
          key={priority}
          type="button"
          onClick={() => onChange(priority)}
          className={cn(
            'h-9 min-w-0 rounded-lg border px-3 text-sm font-black transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:h-10 sm:rounded-xl',
            PRIORITY_STYLES[priority],
            value === priority ? 'ring-2 ring-ring ring-offset-1' : 'opacity-78 hover:opacity-100',
            compact && 'h-9 rounded-lg px-2 text-sm sm:h-12 sm:rounded-xl',
          )}
        >
          {PRIORITY_LABELS[priority]}
        </button>
      ))}
    </div>
  )
}

// StatusFilterSelect 提供历史列表的状态筛选入口。
export function StatusFilterSelect({ value, onChange }: { value: TodoStatus | ''; onChange: (value: TodoStatus | '') => void }) {
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
      className="h-9 w-full px-3 text-sm sm:h-10"
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

// TodoSection 统一 ToDo 分组标题、计数、加载、空状态和折叠行为。
export function TodoSection({ title, loading, empty, toolbar, children, collapsible = false, open = true, onOpenChange }: {
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
    <section className="space-y-2.5 md:space-y-3">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          disabled={!collapsible}
          onClick={() => collapsible && onOpenChange?.(!(open ?? true))}
          className={cn(
            'flex min-h-8 items-center gap-2 rounded-lg text-left text-base font-black md:min-h-9 md:text-lg',
            collapsible && 'pr-2 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          )}
        >
          {collapsible && <ChevronDown className={cn('h-4 w-4 transition-transform', open === false && '-rotate-90')} />}
          {title}
          <span className="text-xs font-bold text-muted-foreground">{rendered.filter(isTodoItemNode).length}</span>
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

// TodoGroupLabel 标记今日列表内的状态小分组。
export function TodoGroupLabel({ label }: { label: string }) {
  return (
    <li data-group-label className="px-1 pt-1 text-xs font-bold text-muted-foreground">
      {label}
    </li>
  )
}

function ReactChildren(children: React.ReactNode) {
  return Array.isArray(children) ? children.flat().filter(Boolean) : [children].filter(Boolean)
}

// ErrorRow 在列表区域内展示局部加载失败提示。
export function ErrorRow({ text }: { text: string }) {
  return (
    <li className="rounded-xl border border-[hsl(var(--destructive)/0.24)] bg-[hsl(var(--destructive-soft))] px-4 py-3 text-sm font-semibold text-destructive">
      {text}
    </li>
  )
}

// TodoRow 渲染桌面端 ToDo 单行，并保留状态流转和详情入口。
export function TodoRow({ item, trailing, onOpen, onStatusStep }: {
  item: Todo
  trailing?: React.ReactNode
  onOpen: () => void
  onStatusStep: () => void
}) {
  const priority = normalizePriority(item.priority)

  return (
    <li className={cn('group flex min-h-12 items-center gap-2.5 rounded-xl border border-l-4 bg-card px-3 py-1.5 shadow-[var(--shadow-sm)] transition-colors hover:border-input sm:min-h-14 sm:gap-3 sm:px-4 sm:py-2', PRIORITY_ROW_STYLES[priority])}>
      <StatusCycleButton status={item.status} onClick={onStatusStep} />
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        <p className={cn('min-w-0 flex-1 truncate text-sm font-bold', item.status === 'done' && 'text-muted-foreground line-through')}>
          {item.title}
        </p>
        <span className={cn('hidden rounded-full border px-2 py-1 text-xs font-bold sm:inline-flex', PRIORITY_STYLES[priority])}>
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
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
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

// ScheduleTodayPopover 让待分配任务在原地选择截止日期后加入今日。
export function ScheduleTodayPopover({ item, today, pending, onConfirm }: {
  item: Todo
  today: string
  pending: boolean
  onConfirm: (dueDate: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [dueDate, setDueDate] = useState(today)

  useEffect(() => {
    if (open) setDueDate(item.dueDate || today)
  }, [item.dueDate, open, today])

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="nexus-button-utility h-9 shrink-0 gap-1.5 px-2.5 text-xs text-muted-foreground"
        >
          <CalendarPlus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">加入今日</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          align="end"
          sideOffset={8}
          className="z-[70] w-[min(calc(100vw-2rem),20rem)] rounded-xl border bg-popover p-4 text-popover-foreground shadow-xl"
        >
          <div className="space-y-3">
            <div>
              <Popover.Close asChild>
                <button
                  type="button"
                  aria-label="关闭"
                  className="float-right flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </Popover.Close>
              <p className="text-sm font-bold">选择截止日期</p>
              <p className="mt-1 truncate text-xs text-muted-foreground">{item.title}</p>
            </div>
            <label className="grid gap-2 text-xs font-bold text-muted-foreground">
              截止日期
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="nexus-input h-10 w-full px-3 text-sm font-normal text-foreground"
              />
            </label>
          </div>
          <div className="mt-4 flex items-center justify-end gap-2">
            <Popover.Close asChild>
              <button
                type="button"
                className="inline-flex h-9 min-w-16 items-center justify-center rounded-md border bg-card px-3 text-xs font-semibold text-foreground transition-colors hover:bg-accent"
              >
                取消
              </button>
            </Popover.Close>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                onConfirm(dueDate || today)
                setOpen(false)
              }}
              className="nexus-button-primary h-9 px-4 text-xs"
            >
              确认加入
            </button>
          </div>
          <Popover.Arrow className="fill-popover" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

// TodoDetailDialog 在桌面表现为居中弹窗，在移动端转为底部 sheet，避免移动端照搬桌面弹窗。
export function TodoDetailDialog({ item, saving, deleting, onOpenChange, onSave, onDelete }: {
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
        <Dialog.Content className="nexus-surface fixed inset-x-0 bottom-0 top-auto z-50 max-h-[82dvh] w-full translate-x-0 translate-y-0 overflow-y-auto rounded-b-none rounded-t-2xl p-3 sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:w-[calc(100vw-2rem)] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg sm:p-4">
          <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-muted-foreground/25 sm:hidden" />
          <div className="flex items-center justify-between gap-3">
            <Dialog.Title className="text-sm font-black sm:text-base sm:font-semibold">ToDo 详情</Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" className="nexus-button-utility hidden h-9 w-9 text-muted-foreground sm:inline-flex" aria-label="关闭">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="mt-3 space-y-2.5 sm:mt-4 sm:space-y-4">
            <label className="block space-y-2">
              <span className="text-xs font-medium text-muted-foreground">标题</span>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="nexus-input h-9 w-full rounded-lg px-3 text-base sm:h-10 sm:rounded-md sm:text-sm"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-xs font-medium text-muted-foreground">备注</span>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                className="nexus-input min-h-16 w-full resize-y rounded-lg px-3 py-2 text-base sm:min-h-32 sm:rounded-md sm:text-sm"
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

            <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-3">
              <label className="block space-y-2">
                <span className="text-xs font-medium text-muted-foreground">计划日期</span>
                <input
                  type="date"
                  value={form.scheduledDate}
                  onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })}
                  className="nexus-input h-9 w-full rounded-lg px-3 text-base sm:h-10 sm:rounded-md sm:text-sm"
                />
              </label>
              <label className="block space-y-2">
                <span className="text-xs font-medium text-muted-foreground">截止日期</span>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                  className="nexus-input h-9 w-full rounded-lg px-3 text-base sm:h-10 sm:rounded-md sm:text-sm"
                />
              </label>
            </div>
          </div>

          <div className="mt-3 grid gap-2 border-t pt-3 sm:mt-5 sm:flex sm:flex-row sm:items-center sm:justify-between sm:pt-4">
            {item && (
              <div className="order-2 sm:order-none">
                <DeleteTodoConfirm deleting={deleting} onConfirm={() => onDelete(item.id)} />
              </div>
            )}
            <div className="order-1 grid grid-cols-2 gap-2 sm:order-none sm:flex sm:justify-end">
              <Dialog.Close asChild>
                <button type="button" className="nexus-button-utility h-9 px-3 text-sm sm:h-10">取消</button>
              </Dialog.Close>
              <button
                type="button"
                disabled={saving || !form.title.trim()}
                onClick={handleSave}
                className="nexus-button-primary h-9 px-4 text-sm sm:h-10"
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
  const [open, setOpen] = useState(false)

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-destructive/40 px-3 text-sm text-destructive transition-colors hover:bg-destructive/10 sm:h-10 sm:w-auto"
        >
          <Trash2 className="h-4 w-4" /> 删除
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          align="start"
          sideOffset={8}
          className="z-[70] w-[min(calc(100vw-2rem),18rem)] rounded-xl border bg-popover p-4 text-popover-foreground shadow-xl"
        >
          <p className="text-sm font-bold">确认删除这个 ToDo？</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">此操作无法撤销。</p>
          <div className="mt-4 flex items-center justify-end gap-2">
            <Popover.Close asChild>
              <button
                type="button"
                className="inline-flex h-9 min-w-16 items-center justify-center rounded-md border bg-card px-3 text-xs font-semibold text-foreground transition-colors hover:bg-accent"
              >
                取消
              </button>
            </Popover.Close>
            <button
              type="button"
              disabled={deleting}
              onClick={() => {
                onConfirm()
                setOpen(false)
              }}
              className="inline-flex h-9 min-w-20 items-center justify-center rounded-md border border-destructive bg-destructive px-3 text-xs font-semibold text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50"
            >
              确认删除
            </button>
          </div>
          <Popover.Arrow className="fill-popover" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
