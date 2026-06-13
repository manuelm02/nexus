import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { taskApi } from '../../api/task.api'
import type { TaskResponse } from '../../types/api.types'
import { formatRelative, cn } from '../../lib/utils'
import { Pin, Trash2, RefreshCw } from 'lucide-react'

const STATUS_COLOR: Record<string, string> = {
  pending:   'border-[hsl(var(--warning)/0.28)] bg-[hsl(var(--warning-soft))] text-[hsl(var(--warning))]',
  running:   'border-[hsl(var(--ring)/0.28)] bg-accent text-primary',
  completed: 'border-[hsl(var(--success)/0.25)] bg-[hsl(var(--success-soft))] text-[hsl(var(--success))]',
  failed:    'border-[hsl(var(--destructive)/0.24)] bg-[hsl(var(--destructive-soft))] text-destructive',
}
const STATUS_LABEL: Record<string, string> = {
  pending: '等待中', running: '执行中', completed: '已完成', failed: '失败',
}

// TasksPage 展示后台异步任务记录，入口收纳在 Settings 中以减少主导航噪音。
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
    <div className="nexus-page-enter mx-auto max-w-3xl space-y-4 p-4 md:p-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground">System jobs</p>
          <h1 className="mt-1 text-2xl font-black md:text-[28px]">Jobs</h1>
          <p className="mt-2 text-sm text-muted-foreground">后台异步任务记录、保留状态和错误信息。</p>
        </div>
        <button onClick={() => refetch()} className="nexus-button-utility h-10 w-10 text-muted-foreground" aria-label="刷新任务">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">加载中…</p>
      ) : (
        <ul className="space-y-2">
          {items.map((task) => (
            <li key={task.id} className="group space-y-2 rounded-xl border bg-card p-4 shadow-[var(--shadow-sm)]">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold">{task.type}</span>
                  <span className={cn('rounded-full border px-2 py-0.5 text-xs font-bold', STATUS_COLOR[task.status])}>
                    {STATUS_LABEL[task.status]}
                  </span>
                  {task.keepForever && <Pin className="h-3.5 w-3.5 text-primary" />}
                </div>
                <div className="flex gap-1.5 opacity-100 transition-all sm:opacity-0 sm:group-hover:opacity-100">
                  <button
                    onClick={() => toggleKeep.mutate(task.id)}
                    className={cn('nexus-button-utility h-8 w-8 hover:text-primary', task.keepForever ? 'text-primary' : 'text-muted-foreground')}
                    aria-label={task.keepForever ? '取消保留任务' : '保留任务'}
                  >
                    <Pin className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(task.id)}
                    className="nexus-button-utility h-8 w-8 text-muted-foreground hover:text-destructive"
                    aria-label="删除任务"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {task.status === 'running' && (
                <div className="h-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary rounded-full animate-pulse w-1/2" />
                </div>
              )}

              {task.resultText && (
                <p className="text-sm text-muted-foreground line-clamp-2">{task.resultText}</p>
              )}
              {task.errorMessage && (
                <p className="line-clamp-2 text-sm text-destructive">{task.errorMessage}</p>
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
