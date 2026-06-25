import { Plus, FolderOpen } from 'lucide-react'
import { PageShell, PageHeader, Tabs } from '@/components/shell'
import { MINDBANK_TABS, type MindBankTab, type Workspace, type MindBankDocument, type CreateWorkspaceRequest } from '../../types/mindbank.types'
import { WorkspaceList } from './components/WorkspaceList'
import { WorkspaceDialog } from './components/WorkspaceDialog'
import { DocumentList } from './components/DocumentList'
import { MinioFilePicker } from './components/MinioFilePicker'
import { MindBankQaView } from './components/MindBankQaView'
import { AgentTab } from './components/AgentTab'

/** Mindbank Desktop 视图的全部 props，由 index.tsx 数据编排层注入 */
export type MindBankViewProps = {
  activeTab: MindBankTab
  onTabChange: (tab: MindBankTab) => void
  workspaces: Workspace[]
  selectedWorkspaceId: number | null
  selectedWorkspace: Workspace | null
  onSelectWorkspace: (id: number) => void
  onOpenCreate: () => void
  onEditWorkspace: (workspace: Workspace) => void
  onDeleteWorkspace: (id: number) => void
  isLoadingWorkspaces: boolean
  documents: MindBankDocument[]
  isLoadingDocuments: boolean
  onOpenFilePicker: () => void
  onRetryStep: (docId: number, step: number) => void
  isCreatingWorkspace: boolean
  isUpdatingWorkspace: boolean
  isDeletingWorkspace: boolean
  workspaceDialogOpen: boolean
  editingWorkspace: Workspace | null
  onCloseWorkspaceDialog: () => void
  onSubmitWorkspace: (data: CreateWorkspaceRequest) => void
  workspaceSubmitError?: string
  filePickerOpen: boolean
  onCloseFilePicker: () => void
  onImported: () => void
}

// MindBankDesktopView 桌面端 Mindbank 双栏布局：左侧 Workspace 列表 + 右侧三 Tab（文档/Q&A/Agent）内容面板。
export function MindBankDesktopView(props: MindBankViewProps) {
  const {
    activeTab,
    onTabChange,
    workspaces,
    selectedWorkspaceId,
    selectedWorkspace,
    onSelectWorkspace,
    onOpenCreate,
    onEditWorkspace,
    onDeleteWorkspace,
    isLoadingWorkspaces,
    documents,
    isLoadingDocuments,
    onOpenFilePicker,
    onRetryStep,
    isCreatingWorkspace,
    isUpdatingWorkspace,
    workspaceDialogOpen,
    editingWorkspace,
    onCloseWorkspaceDialog,
    onSubmitWorkspace,
    workspaceSubmitError,
    filePickerOpen,
    onCloseFilePicker,
    onImported,
  } = props

  const tabItems = MINDBANK_TABS.map(({ key, label }) => ({ value: key, label }))

  const actions = selectedWorkspace && activeTab === 'documents' ? (
    <button
      type="button"
      onClick={onOpenFilePicker}
      className="nexus-button-primary inline-flex h-9 items-center gap-1.5 px-3.5 text-sm font-bold"
    >
      <Plus className="h-4 w-4" />
      添加文件
    </button>
  ) : undefined

  // 左栏：Workspace 列表（外框由 PageShell list-detail 统一提供，内部独立滚动）
  const list = (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <WorkspaceList
        workspaces={workspaces}
        selectedId={selectedWorkspaceId}
        onSelect={onSelectWorkspace}
        onEdit={onEditWorkspace}
        onDelete={onDeleteWorkspace}
        onCreate={onOpenCreate}
        isLoading={isLoadingWorkspaces}
        isDeleting={props.isDeletingWorkspace}
      />
    </div>
  )

  return (
    // 2 栏 list-detail：workspace 列表 + 宽内容；workspace 详情并入内容区顶部，取代稀疏的右侧详情栏
    <div className="hidden h-full md:flex md:flex-col">
      <PageShell variant="list-detail" header={
        <PageHeader eyebrow="KNOWLEDGE" title="Mindbank" subtitle="你的知识在这里沉淀、连接。" actions={actions} />
      } list={list}>
        {selectedWorkspace ? (
          <>
            {/* workspace 详情并入内容区顶部一行 + tab */}
            <div className="border-b border-border px-5 py-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-foreground">{selectedWorkspace.name}</h3>
                {selectedWorkspace.domainTag && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                    {selectedWorkspace.domainTag}
                  </span>
                )}
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {selectedWorkspace.documentCount} 个文档
                {selectedWorkspace.description ? ` · ${selectedWorkspace.description}` : ''}
                {selectedWorkspace.createdAt ? ` · 创建于 ${selectedWorkspace.createdAt.slice(0, 10)}` : ''}
              </p>
              <div className="mt-3">
                <Tabs value={activeTab} onChange={onTabChange} items={tabItems} />
              </div>
            </div>

            {/* tab 内容：在面板内独立滚动（取代 maxHeight 魔法数） */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              {activeTab === 'documents' && (
                <DocumentList
                  workspace={selectedWorkspace}
                  documents={documents}
                  isLoading={isLoadingDocuments}
                  onRetryStep={onRetryStep}
                />
              )}
              {activeTab === 'qa' && <MindBankQaView workspace={selectedWorkspace} />}
              {activeTab === 'agent' && <AgentTab />}
            </div>
          </>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/[0.06]">
              <FolderOpen className="h-7 w-7 text-primary/40" />
            </div>
            <h3 className="mt-4 text-lg font-extrabold text-foreground">
              请先选择或创建一个 Workspace
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              左侧列表选择已有 Workspace，或新建一个开始管理知识。
            </p>
            <button
              type="button"
              onClick={onOpenCreate}
              className="nexus-button-primary mt-5 inline-flex h-9 items-center gap-1.5 px-4 text-sm font-bold"
            >
              <Plus className="h-4 w-4" />
              新建 Workspace
            </button>
          </div>
        )}
      </PageShell>

      {/* Dialogs */}
      <WorkspaceDialog
        open={workspaceDialogOpen}
        editing={editingWorkspace}
        onClose={onCloseWorkspaceDialog}
        onSubmit={onSubmitWorkspace}
        isSubmitting={isCreatingWorkspace || isUpdatingWorkspace}
        submitError={workspaceSubmitError}
      />

      {selectedWorkspace && (
        <MinioFilePicker
          open={filePickerOpen}
          workspaceId={selectedWorkspace.id}
          onClose={onCloseFilePicker}
          onImported={onImported}
        />
      )}
    </div>
  )
}
