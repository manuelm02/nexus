import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { todoApi } from '../../api/todo.api'
import type { Todo } from '../../types/domain.types'
import { TodoView } from './TodoView'
import { getNextRowStatus, isDueDateInvalid, type Priority, type TodoStatus, type TodoTab } from './todo.shared'

// TodoPage 承载看板驱动的 ToDo 工作流：ToDo List / 任务 / 历史。
export default function TodoPage() {
  const [activeTab, setActiveTab] = useState<TodoTab>('list')
  const [historyStatus, setHistoryStatus] = useState<TodoStatus | ''>('done')
  const [detailTarget, setDetailTarget] = useState<Todo | null>(null)
  const [overdueOpen, setOverdueOpen] = useState(true)
  const qc = useQueryClient()

  // 看板查询：today / future / overdue / tasks，由后端保证互斥
  const boardQuery = useQuery({
    queryKey: ['todo', 'board'],
    queryFn: () => todoApi.board(),
  })
  const historyQuery = useQuery({
    queryKey: ['todo', 'history', historyStatus],
    queryFn: () => todoApi.list({ status: historyStatus || undefined }),
  })

  const invalidateTodo = () => qc.invalidateQueries({ queryKey: ['todo'] })

  const createMutation = useMutation({
    mutationFn: async (input: { title: string; priority: Priority; scheduledDate?: string; dueDate?: string }) => {
      await todoApi.create({
        title: input.title,
        priority: input.priority,
        scheduledDate: input.scheduledDate || undefined,
        dueDate: input.dueDate || undefined,
      })
    },
    onSuccess: invalidateTodo,
  })
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TodoStatus }) => todoApi.updateStatus(id, status),
    onSuccess: invalidateTodo,
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Todo> & { clearScheduledDate?: boolean; clearDueDate?: boolean } }) =>
      todoApi.update(id, data),
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

  const board = boardQuery.data?.data?.data
  const boardItems = {
    today: board?.today ?? [],
    future: board?.future ?? [],
    overdue: board?.overdue ?? [],
    tasks: board?.tasks ?? [],
  }
  const historyItems = historyQuery.data?.data?.data ?? []

  // 合并日期校验结果供 UI 提示
  const dateValidation = useMemo(() => {
    if (!detailTarget) return null
    const s = detailTarget.scheduledDate
    const d = detailTarget.dueDate
    if (isDueDateInvalid(s, d)) return '截止日期不能早于计划日期'
    return null
  }, [detailTarget])

  const handleStatusStep = (item: Todo) => {
    const nextStatus = getNextRowStatus(item.status)
    if (nextStatus !== item.status) statusMutation.mutate({ id: item.id, status: nextStatus })
  }

  const headerMetrics = [
    { label: '今日', value: boardItems.today.length, tone: 'primary' as const },
    { label: '未来', value: boardItems.future.length, tone: 'success' as const },
    { label: '已过期', value: boardItems.overdue.length, tone: 'danger' as const },
    { label: '任务', value: boardItems.tasks.length, tone: 'warning' as const },
  ]

  return (
    <TodoView
      activeTab={activeTab}
      historyStatus={historyStatus}
      detailTarget={detailTarget}
      dateValidation={dateValidation}
      headerMetrics={headerMetrics}
      operationError={createMutation.isError || statusMutation.isError || updateMutation.isError || deleteMutation.isError}
      createPending={createMutation.isPending}
      saving={updateMutation.isPending}
      deleting={deleteMutation.isPending}
      boardLoading={boardQuery.isLoading}
      boardError={boardQuery.isError}
      historyLoading={historyQuery.isLoading}
      historyError={historyQuery.isError}
      todayItems={boardItems.today}
      futureItems={boardItems.future}
      overdueItems={boardItems.overdue}
      taskItems={boardItems.tasks}
      historyItems={historyItems}
      overdueOpen={overdueOpen}
      onCreate={(input) => createMutation.mutate(input)}
      onTabChange={setActiveTab}
      onHistoryStatusChange={setHistoryStatus}
      onOverdueOpenChange={setOverdueOpen}
      onStatusStep={handleStatusStep}
      onStatusChange={(item, status) => statusMutation.mutate({ id: item.id, status })}
      onScheduleTask={(id, date) => updateMutation.mutate({ id, data: { scheduledDate: date, dueDate: date } })}
      onOpenTodo={setDetailTarget}
      onCloseDetail={() => setDetailTarget(null)}
      onSave={(id, data) => updateMutation.mutate({ id, data })}
      onDelete={(id) => deleteMutation.mutate(id)}
    />
  )
}
