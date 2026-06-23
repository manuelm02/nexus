import { useQuery } from '@tanstack/react-query'
import { BookOpen, ExternalLink, Loader2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { mindbankApi } from '../../../api/mindbank.api'

/** MasterNotePanel 展示当前 Workspace 的 Master Note 内容和本地路径。 */
export function MasterNotePanel({ workspaceId }: { workspaceId: number }) {
  const query = useQuery({
    queryKey: ['mindbank', 'master-note', workspaceId],
    queryFn: async () => {
      const res = await mindbankApi.getMasterNote(workspaceId)
      return res.data.data ?? null
    },
  })

  if (query.isLoading) {
    return (
      <section className="nexus-surface p-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          加载 Master Note...
        </div>
      </section>
    )
  }

  const note = query.data
  const hasContent = note?.content && note.content.trim().length > 0

  return (
    <section className="nexus-surface overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-extrabold text-foreground">Master Note</h3>
        </div>
        {note?.path && (
          <span className="min-w-0 truncate font-mono text-[10px] text-muted-foreground" title={note.path}>
            {note.path}
          </span>
        )}
      </div>
      {hasContent ? (
        <div className="max-h-80 overflow-y-auto px-3 py-3">
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{note.content ?? ''}</ReactMarkdown>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 px-3 py-4 text-xs text-muted-foreground">
          <ExternalLink className="h-3.5 w-3.5" />
          {note?.message ?? '尚未生成 Master Note'}
        </div>
      )}
    </section>
  )
}
