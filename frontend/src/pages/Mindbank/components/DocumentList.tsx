import { Loader2 } from 'lucide-react'
import type { MindBankDocument, Workspace } from '../../../types/mindbank.types'
import { DocumentCard } from './DocumentCard'
import { DocumentListEmpty } from './PipelineStatus'
import { MasterNotePanel } from './MasterNotePanel'
import { SessionNotesPanel } from './SessionNotesPanel'

// DocumentList 文档列表：顶部展示 Master Note + Session Notes panel，下方 grid 渲染文档卡片。
export function DocumentList({
  workspace,
  documents,
  isLoading,
  onRetryStep,
}: {
  workspace: Workspace | null
  documents: MindBankDocument[]
  isLoading: boolean
  onRetryStep: (docId: number, step: number) => void
}) {
  if (workspace == null) {
    return (
      <div className="p-4 md:p-6">
        <DocumentListEmpty workspaceId={null} />
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        加载文档…
      </div>
    )
  }

  if (documents.length === 0) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <div className="grid gap-3 lg:grid-cols-2">
          <MasterNotePanel workspaceId={workspace.id} />
          <SessionNotesPanel workspaceId={workspace.id} />
        </div>
        <DocumentListEmpty workspaceId={workspace.id} />
      </div>
    )
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="grid gap-3 lg:grid-cols-2">
        <MasterNotePanel workspaceId={workspace.id} />
        <SessionNotesPanel workspaceId={workspace.id} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {documents.map((doc) => (
          <DocumentCard
            key={doc.id}
            document={doc}
            onRetryStep={(step) => onRetryStep(doc.id, step)}
          />
        ))}
      </div>
    </div>
  )
}
