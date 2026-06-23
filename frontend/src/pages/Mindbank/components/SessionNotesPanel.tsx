import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { mindbankApi } from '../../../api/mindbank.api'

/** SessionNotesPanel 按导入时间展示当前 Workspace 的 Session Note 列表。 */
export function SessionNotesPanel({ workspaceId }: { workspaceId: number }) {
  const [expandedPath, setExpandedPath] = useState<string | null>(null)
  const query = useQuery({
    queryKey: ['mindbank', 'session-notes', workspaceId],
    queryFn: async () => {
      const res = await mindbankApi.getSessionNotes(workspaceId)
      return res.data.data ?? []
    },
  })

  if (query.isLoading) {
    return (
      <section className="nexus-surface p-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          加载 Session Notes...
        </div>
      </section>
    )
  }

  const notes = query.data ?? []

  return (
    <section className="nexus-surface overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-extrabold text-foreground">Session Notes</h3>
        </div>
        <span className="text-[10px] font-bold text-muted-foreground">{notes.length} 条</span>
      </div>

      {notes.length === 0 ? (
        <p className="px-3 py-4 text-xs text-muted-foreground">暂无导入速记。</p>
      ) : (
        <div className="divide-y divide-border">
          {notes.map((note) => {
            const expanded = expandedPath === note.path
            return (
              <div key={note.path}>
                <button
                  type="button"
                  onClick={() => setExpandedPath(expanded ? null : note.path)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground">{note.date}</p>
                    <p className="truncate font-mono text-[10px] text-muted-foreground">{note.path}</p>
                  </div>
                  {expanded ? (
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                </button>
                {expanded && (
                  <div className="max-h-64 overflow-y-auto bg-muted/20 px-3 py-3">
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{note.content}</ReactMarkdown>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
