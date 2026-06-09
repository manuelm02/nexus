import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarPlus, Check, Circle, Pause, Play, Plus, RotateCcw, X } from 'lucide-react'
import { todoApi } from '../../api/todo.api'
import type { Todo } from '../../types/domain.types'
import { PRIORITY_LABELS, STATUS_LABELS } from '../../lib/constants'
import { cn } from '../../lib/utils'

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-slate-100 text-slate-600',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
}

const STATUS_FLOW: Todo['status'][] = ['not_started', 'in_progress', 'done']

const todayString = () => new Date().toISOString().slice(0, 10)

// TodoPage 承载待分配、今日执行、已过期和历史恢复四段 ToDo 减法工作流。
export default function TodoPage() {
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<Todo['priority']>('medium')
  const [historyStatus, setHistoryStatus] = useState<Todo['status'] | ''>('done')
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
    mutationFn: () => todoApi.create({ title: title.trim(), priority }),
    onSuccess: () => {
      invalidateTodo()
      setTitle('')
      setPriority('medium')
    },
  })
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Todo['status'] }) => todoApi.updateStatus(id, status),
    onSuccess: invalidateTodo,
  })
  const scheduleMutation = useMutation({
    mutationFn: ({ id, dueDate }: { id: string; dueDate?: string }) => todoApi.scheduleToday(id, dueDate),
    onSuccess: invalidateTodo,
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Todo> }) => todoApi.update(id, data),
    onSuccess: invalidateTodo,
  })

  const pendingItems = pendingQuery.data?.data?.data ?? []
  const todayItems = (todayQuery.data?.data?.data ?? []).filter((item) => item.status !== 'pending' && item.status !== 'cancelled')
  const overdueItems = overdueQuery.data?.data?.data ?? []
  const historyItems = historyQuery.data?.data?.data ?? []

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (title.trim()) createMutation.mutate()
  }

  const nextTodayStatus = (status: Todo['status']) => {
    const index = STATUS_FLOW.indexOf(status)
    return STATUS_FLOW[Math.min(index + 1, STATUS_FLOW.length - 1)] ?? 'not_started'
  }

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6 space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold">ToDo</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">待分配、今日、过期和历史恢复。</p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="写下要处理的事"
            className="h-10 min-w-0 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring sm:w-64"
          />
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as Todo['priority'])}
            className="h-10 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {(['low', 'medium', 'high', 'urgent'] as Todo['priority'][]).map((p) => (
              <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
            ))}
          </select>
          <button
            type="submit"
            disabled={!title.trim() || createMutation.isPending}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> 添加
          </button>
        </form>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <TodoSection title="待分配池" loading={pendingQuery.isLoading} empty="没有待分配任务">
          {pendingItems.map((item) => (
            <TodoRow
              key={item.id}
              item={item}
              actions={
                <>
                  <IconButton title="选入今日" onClick={() => scheduleMutation.mutate({ id: item.id })}>
                    <CalendarPlus className="h-4 w-4" />
                  </IconButton>
                  <IconButton title="取消" onClick={() => statusMutation.mutate({ id: item.id, status: 'cancelled' })}>
                    <X className="h-4 w-4" />
                  </IconButton>
                </>
              }
            />
          ))}
        </TodoSection>

        <TodoSection title="今日" loading={todayQuery.isLoading} empty="今天还没有执行项">
          {todayItems.map((item) => (
            <TodoRow
              key={item.id}
              item={item}
              actions={
                <IconButton title="推进状态" onClick={() => statusMutation.mutate({ id: item.id, status: nextTodayStatus(item.status) })}>
                  {item.status === 'done' ? <Check className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </IconButton>
              }
            />
          ))}
        </TodoSection>
      </section>

      <TodoSection title="已过期" loading={overdueQuery.isLoading} empty="没有过期任务">
        {overdueItems.map((item) => (
          <TodoRow
            key={item.id}
            item={item}
            actions={
              <div className="flex flex-wrap items-center justify-end gap-2">
                <select
                  value={item.status}
                  onChange={(e) => updateMutation.mutate({ id: item.id, data: { status: e.target.value as Todo['status'] } })}
                  className="h-8 rounded-md border bg-background px-2 text-xs"
                >
                  {(['not_started', 'in_progress', 'done', 'pending', 'cancelled'] as Todo['status'][]).map((s) => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                </select>
                <DateInput
                  label="计划"
                  value={item.scheduledDate}
                  onChange={(scheduledDate) => updateMutation.mutate({ id: item.id, data: { scheduledDate } })}
                />
                <DateInput
                  label="截止"
                  value={item.dueDate}
                  onChange={(dueDate) => updateMutation.mutate({ id: item.id, data: { dueDate } })}
                />
              </div>
            }
          />
        ))}
      </TodoSection>

      <TodoSection
        title="历史"
        loading={historyQuery.isLoading}
        empty="没有匹配的历史任务"
        toolbar={
          <select
            value={historyStatus}
            onChange={(e) => setHistoryStatus(e.target.value as Todo['status'] | '')}
            className="h-8 rounded-md border bg-background px-2 text-xs"
          >
            <option value="">全部</option>
            {(['done', 'cancelled', 'pending', 'not_started', 'in_progress'] as Todo['status'][]).map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
        }
      >
        {historyItems.map((item) => (
          <TodoRow
            key={item.id}
            item={item}
            actions={
              <IconButton title="恢复到待分配" onClick={() => statusMutation.mutate({ id: item.id, status: 'pending' })}>
                <RotateCcw className="h-4 w-4" />
              </IconButton>
            }
          />
        ))}
      </TodoSection>
    </div>
  )
}

function TodoSection({ title, loading, empty, toolbar, children }: {
  title: string
  loading: boolean
  empty: string
  toolbar?: React.ReactNode
  children: React.ReactNode[]
}) {
  const count = children.length

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium">{title} <span className="text-xs text-muted-foreground">{count}</span></h2>
        {toolbar}
      </div>
      {loading ? (
        <p className="rounded-md border px-3 py-6 text-center text-sm text-muted-foreground">加载中...</p>
      ) : count > 0 ? (
        <ul className="space-y-2">{children}</ul>
      ) : (
        <p className="rounded-md border px-3 py-6 text-center text-sm text-muted-foreground">{empty}</p>
      )}
    </section>
  )
}

function TodoRow({ item, actions }: { item: Todo; actions: React.ReactNode }) {
  return (
    <li className="flex flex-col gap-3 rounded-md border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {item.status === 'done' ? <Check className="h-4 w-4 text-primary" /> : item.status === 'cancelled' ? <Pause className="h-4 w-4 text-muted-foreground" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
          <p className={cn('truncate text-sm font-medium', item.status === 'done' && 'text-muted-foreground line-through')}>
            {item.title}
          </p>
        </div>
        <div className="mt-2 flex flex-wrap gap-2 pl-6">
          <span className={cn('rounded px-1.5 py-0.5 text-xs', PRIORITY_COLORS[item.priority])}>
            {PRIORITY_LABELS[item.priority]}
          </span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{STATUS_LABELS[item.status]}</span>
          {item.scheduledDate && <span className="text-xs text-muted-foreground">计划 {item.scheduledDate}</span>}
          {item.dueDate && <span className="text-xs text-muted-foreground">截止 {item.dueDate}</span>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">{actions}</div>
    </li>
  )
}

function IconButton({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      {children}
    </button>
  )
}

function DateInput({ label, value, onChange }: { label: string; value?: string; onChange: (value: string) => void }) {
  return (
    <label className="flex items-center gap-1 text-xs text-muted-foreground">
      {label}
      <input
        type="date"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 rounded-md border bg-background px-2 text-xs text-foreground"
      />
    </label>
  )
}
