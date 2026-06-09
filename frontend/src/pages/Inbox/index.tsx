import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { inboxApi } from '../../api/inbox.api'
import type { InboxItem } from '../../types/domain.types'
import { formatRelative } from '../../lib/utils'
import { Plus, Trash2, Tag } from 'lucide-react'

// InboxPage 展示快速收纳的信息条目和新增入口。
export default function InboxPage() {
  const [content, setContent] = useState('')
  const [title, setTitle] = useState('')
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['inbox'],
    queryFn: () => inboxApi.list(),
  })

  const createMutation = useMutation({
    mutationFn: () => inboxApi.create({ title: title || undefined, content }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inbox'] })
      setContent('')
      setTitle('')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => inboxApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inbox'] }),
  })

  const items: InboxItem[] = data?.data?.data ?? []

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (content.trim()) createMutation.mutate()
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Inbox</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          最好的想法往往诞生在最糟糕的时机。在它消失之前，给它一个落脚的地方。
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-2 rounded-lg border bg-card p-4">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="标题（可选）"
          className="w-full bg-transparent text-sm font-medium placeholder:text-muted-foreground focus:outline-none"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="记下你的想法…"
          rows={3}
          className="w-full bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none resize-none"
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!content.trim() || createMutation.isPending}
            className="flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            保存
          </button>
        </div>
      </form>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">加载中…</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-lg border bg-card p-4 group relative">
              {item.title && <p className="text-sm font-medium mb-1">{item.title}</p>}
              <p className="text-sm whitespace-pre-wrap">{item.content}</p>
              {item.tags && item.tags.length > 0 && (
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {item.tags.map((tag) => (
                    <span key={tag} className="flex items-center gap-1 text-xs bg-accent text-accent-foreground rounded px-1.5 py-0.5">
                      <Tag className="h-3 w-3" />
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-2">{formatRelative(item.createdAt)}</p>
              <button
                onClick={() => deleteMutation.mutate(item.id)}
                className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">暂无笔记</p>
          )}
        </ul>
      )}
    </div>
  )
}
