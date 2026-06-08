import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { focusApi } from '../../api/focus.api'
import type { Focus } from '../../types/domain.types'
import { STATUS_LABELS, PRIORITY_LABELS } from '../../lib/constants'
import { cn } from '../../lib/utils'
import { Plus, Check, Trash2 } from 'lucide-react'

const PRIORITY_COLORS: Record<string, string> = {
  low:    'bg-slate-100 text-slate-600',
  medium: 'bg-blue-100 text-blue-700',
  high:   'bg-orange-100 text-orange-700',
  urgent: 'bg-red-100 text-red-700',
}

export default function FocusPage() {
  const [title, setTitle] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['focus', filterStatus],
    queryFn: () => focusApi.list({ status: filterStatus || undefined }),
  })

  const createMutation = useMutation({
    mutationFn: (t: string) => focusApi.create({ title: t }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['focus'] })
      setTitle('')
    },
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      focusApi.updateStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['focus'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => focusApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['focus'] }),
  })

  const items: Focus[] = data?.data?.data ?? []

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (title.trim()) createMutation.mutate(title.trim())
  }

  const toggleDone = (item: Focus) => {
    const next = item.status === 'done' ? 'not_started' : 'done'
    statusMutation.mutate({ id: item.id, status: next })
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Focus</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          不是所有事情都值得今天去做，但今天值得做的事，值得你全力以赴。
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="添加任务…"
          className="flex-1 rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="submit"
          disabled={!title.trim() || createMutation.isPending}
          className="rounded-md bg-primary text-primary-foreground px-3 py-2 hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          <Plus className="h-4 w-4" />
        </button>
      </form>

      <div className="flex gap-2 flex-wrap">
        {['', 'not_started', 'in_progress', 'done'].map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={cn(
              'rounded-full px-3 py-1 text-xs border transition-colors',
              filterStatus === s ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent',
            )}
          >
            {s === '' ? '全部' : STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">加载中…</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-start gap-3 rounded-lg border bg-card p-3 group"
            >
              <button
                onClick={() => toggleDone(item)}
                className={cn(
                  'mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors',
                  item.status === 'done'
                    ? 'bg-primary border-primary text-primary-foreground'
                    : 'border-muted-foreground hover:border-primary',
                )}
              >
                {item.status === 'done' && <Check className="h-3 w-3" />}
              </button>
              <div className="flex-1 min-w-0">
                <p className={cn('text-sm', item.status === 'done' && 'line-through text-muted-foreground')}>
                  {item.title}
                </p>
                <div className="flex gap-2 mt-1">
                  <span className={cn('text-xs rounded px-1.5 py-0.5', PRIORITY_COLORS[item.priority])}>
                    {PRIORITY_LABELS[item.priority]}
                  </span>
                  <span className="text-xs text-muted-foreground">{STATUS_LABELS[item.status]}</span>
                </div>
              </div>
              <button
                onClick={() => deleteMutation.mutate(item.id)}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">暂无任务</p>
          )}
        </ul>
      )}
    </div>
  )
}
