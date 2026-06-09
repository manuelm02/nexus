import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { taskApi } from '../../api/task.api'
import type { TaskResponse } from '../../types/api.types'
import { formatRelative, cn } from '../../lib/utils'
import { Pin, Trash2, RefreshCw } from 'lucide-react'

const STATUS_COLOR: Record<string, string> = {
  pending:   'bg-yellow-100 text-yellow-700',
  running:   'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  failed:    'bg-red-100 text-red-700',
}
const STATUS_LABEL: Record<string, string> = {
  pending: '等待中', running: '执行中', completed: '已完成', failed: '失败',
}

// TasksPage 展示后台异步任务记录，导航中命名为 Jobs 以区别 ToDo。
export default function TasksPage() {
  const qc = useQueryClient()
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => taskApi.list(),
    refetchInterval: (query) => {
      const items = query.state.data?.data?.data ?? []
      const hasRunning = items.some((t: TaskResponse) => t.status === 'pending' || t.status === 'running')
      return hasRunning ? 3000 : false
    },
  })

  const toggleKeep = useMutation({
    mutationFn: (id: string) => taskApi.toggleKeep(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => taskApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })

  const items: TaskResponse[] = data?.data?.data ?? []

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Jobs</h1>
        <button onClick={() => refetch()} className="text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">加载中…</p>
      ) : (
        <ul className="space-y-2">
          {items.map((task) => (
            <li key={task.id} className="rounded-lg border bg-card p-4 group space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{task.type}</span>
                  <span className={cn('text-xs rounded px-1.5 py-0.5', STATUS_COLOR[task.status])}>
                    {STATUS_LABEL[task.status]}
                  </span>
                  {task.keepForever && <Pin className="h-3.5 w-3.5 text-primary" />}
                </div>
                <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                  <button
                    onClick={() => toggleKeep.mutate(task.id)}
                    className={cn('hover:text-primary transition-colors', task.keepForever ? 'text-primary' : 'text-muted-foreground')}
                  >
                    <Pin className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(task.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {task.status === 'running' && (
                <div className="h-1 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full animate-pulse w-1/2" />
                </div>
              )}

              {task.resultText && (
                <p className="text-sm text-muted-foreground line-clamp-2">{task.resultText}</p>
              )}
              {task.errorMessage && (
                <p className="text-sm text-red-500 line-clamp-2">{task.errorMessage}</p>
              )}

              <p className="text-xs text-muted-foreground">{formatRelative(task.createdAt)}</p>
            </li>
          ))}
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">暂无任务记录</p>
          )}
        </ul>
      )}
    </div>
  )
}
