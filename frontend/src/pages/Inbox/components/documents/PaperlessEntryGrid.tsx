import { FileText } from 'lucide-react'
import type { EntryLink } from '../../../../types/domain.types'

export type PaperlessEntryGridProps = {
  entryLinks: EntryLink[]
  onOpen: (url: string) => void
}

// paperless 入口网格：8 个入口卡片组成的 2x4 或 4x2 响应式网格。
export function PaperlessEntryGrid({ entryLinks, onOpen }: PaperlessEntryGridProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      {entryLinks.map((link) => (
        <button
          key={link.key}
          type="button"
          onClick={() => onOpen(link.url)}
          className="flex flex-col items-center gap-1.5 rounded-lg border bg-card p-3 shadow-[var(--shadow-xs)] text-center transition-colors hover:border-primary/30 hover:bg-accent"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded bg-primary/10">
            <FileText className="h-4 w-4 text-primary" />
          </div>
          <span className="text-xs font-bold text-foreground truncate w-full">{link.label}</span>
          {link.description && (
            <span className="text-[10px] text-muted-foreground leading-tight line-clamp-2">
              {link.description}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
