import { Loader2 } from 'lucide-react'
import type { MindBankDocument, Workspace } from '../../../types/mindbank.types'
import { DocumentCard } from './DocumentCard'
import { DocumentListEmpty } from './PipelineStatus'

/**
 * DocumentList 文档列表：grid 布局 + 加载态 + 空态。
 * workspace 未选择时显示空态引导。
 */
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
      <div className="p-4 md:p-6">
        <DocumentListEmpty workspaceId={workspace.id} />
      </div>
    )
  }

  return (
    <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 md:p-6">
      {documents.map((doc) => (
        <DocumentCard
          key={doc.id}
          document={doc}
          onRetryStep={(step) => onRetryStep(doc.id, step)}
        />
      ))}
    </div>
  )
}
