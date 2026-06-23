import { Plus, Files, MessageSquare, Bot, FolderOpen } from 'lucide-react'
import { cn } from '../../lib/utils'
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

// 各 Tab 对应的图标
const TAB_ICONS: Record<MindBankTab, typeof Files> = {
  documents: Files,
  qa: MessageSquare,
  agent: Bot,
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

  return (
    <div className="nexus-page-enter mx-auto hidden max-w-[1180px] space-y-4 p-4 md:block lg:p-6">
      {/* 标准页面头部 */}
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground">Knowledge</p>
        <h1 className="mt-1 text-[28px] font-black leading-tight text-foreground">Mindbank</h1>
      </div>

      {/* 双栏 grid 布局：左侧 Workspace 列表 + 右侧内容面板 */}
      <div className="grid items-start gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        {/* 左侧 Workspace 列表，nexus-surface 提供面板外观，sticky 滚动时固定 */}
        <aside className="nexus-surface sticky top-4 overflow-hidden">
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
        </aside>

        {/* 右侧主区域：单块 .nexus-surface 面板，内含信息头 + Tab + 内容 */}
        <section className="nexus-surface flex flex-col overflow-hidden">
          {/* workspace 信息头 */}
          <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
            <div className="min-w-0 flex-1">
              {selectedWorkspace ? (
                <>
                  <h2 className="truncate text-[24px] font-black leading-tight text-foreground">
                    {selectedWorkspace.name}
                  </h2>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    {selectedWorkspace.domainTag && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 font-bold text-primary">
                        {selectedWorkspace.domainTag}
                      </span>
                    )}
                    <span>{selectedWorkspace.documentCount} 个文档</span>
                    {selectedWorkspace.anythingllmSlug && (
                      <span className="font-mono text-[10px] text-muted-foreground/60">
                        slug: {selectedWorkspace.anythingllmSlug}
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-[24px] font-black leading-tight text-foreground">Mindbank</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {isLoadingWorkspaces ? '加载中…' : '先在左侧创建一个 Workspace 开始'}
                  </p>
                </>
              )}
            </div>
            {selectedWorkspace && activeTab === 'documents' && (
              <button
                type="button"
                onClick={onOpenFilePicker}
                className="nexus-button-primary inline-flex h-9 items-center gap-1.5 px-3.5 text-sm font-bold"
              >
                <Plus className="h-4 w-4" />
                添加文件
              </button>
            )}
          </div>

          {/* Tab 栏 — 移入卡片内 */}
          {selectedWorkspace && (
            <div className="border-b border-border px-5 py-2">
              <div className="inline-grid h-10 grid-cols-3 rounded-lg border bg-card p-1 shadow-[var(--shadow-xs)]">
                {MINDBANK_TABS.map(({ key, label }) => {
                  const Icon = TAB_ICONS[key]
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => onTabChange(key)}
                      className={cn(
                        'inline-flex h-full items-center justify-center gap-1.5 rounded-md px-4 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        activeTab === key
                          ? 'bg-primary text-primary-foreground'
                          : 'text-accent-foreground hover:bg-accent',
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Tab 内容 / 空状态 */}
          {selectedWorkspace ? (
            <div className="flex-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
              {activeTab === 'documents' && (
                <DocumentList
                  workspace={selectedWorkspace}
                  documents={documents}
                  isLoading={isLoadingDocuments}
                  onRetryStep={onRetryStep}
                />
              )}
              {activeTab === 'qa' && selectedWorkspace && (
                <MindBankQaView workspace={selectedWorkspace} />
              )}
              {activeTab === 'agent' && <AgentTab />}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
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
        </section>
      </div>

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
