import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { todoApi } from '../../api/todo.api'
import type { Todo } from '../../types/domain.types'
import { TodoView } from './TodoView'
import { getNextRowStatus, todayString, type Priority, type TodoStatus, type TodoTab } from './todo.shared'

// TodoPage 承载今日优先的 ToDo 工作流，并把历史任务拆到独立页签。
export default function TodoPage() {
  const [activeTab, setActiveTab] = useState<TodoTab>('today')
  const [historyStatus, setHistoryStatus] = useState<TodoStatus | ''>('done')
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
    onSuccess: invalidateTodo,
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

  const headerMetrics = [
    { label: '今日', value: todayItems.length, tone: 'default' },
    { label: '待分配', value: pendingItems.length, tone: 'default' },
    { label: '过期', value: overdueItems.length, tone: 'danger' },
  ] as const

  return (
    <TodoView
      activeTab={activeTab}
      historyStatus={historyStatus}
      detailTarget={detailTarget}
      today={today}
      headerMetrics={headerMetrics}
      operationError={createMutation.isError || statusMutation.isError || scheduleMutation.isError || updateMutation.isError || deleteMutation.isError}
      createPending={createMutation.isPending}
      schedulePending={scheduleMutation.isPending}
      saving={updateMutation.isPending}
      deleting={deleteMutation.isPending}
      todayLoading={todayQuery.isLoading}
      todayError={todayQuery.isError}
      pendingLoading={pendingQuery.isLoading}
      pendingError={pendingQuery.isError}
      overdueLoading={overdueQuery.isLoading}
      overdueError={overdueQuery.isError}
      historyLoading={historyQuery.isLoading}
      historyError={historyQuery.isError}
      todayInProgress={todayInProgress}
      todayNotStarted={todayNotStarted}
      pendingItems={pendingItems}
      overdueItems={overdueItems}
      historyItems={historyItems}
      poolOpen={poolOpen}
      overdueOpen={overdueOpen}
      onCreate={(input) => createMutation.mutate(input)}
      onTabChange={setActiveTab}
      onHistoryStatusChange={setHistoryStatus}
      onPoolOpenChange={setPoolOpen}
      onOverdueOpenChange={setOverdueOpen}
      onStatusStep={handleStatusStep}
      onStatusChange={handleStatusChange}
      onScheduleToday={(item, dueDate) => scheduleMutation.mutate({ id: item.id, dueDate })}
      onOpenTodo={setDetailTarget}
      onCloseDetail={() => setDetailTarget(null)}
      onSave={(id, data) => updateMutation.mutate({ id, data })}
      onDelete={(id) => deleteMutation.mutate(id)}
    />
  )
}
