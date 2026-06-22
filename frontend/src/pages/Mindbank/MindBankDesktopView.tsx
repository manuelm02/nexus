import { Plus, Files, MessageSquare, Bot } from 'lucide-react'
import { cn } from '../../lib/utils'
import { MINDBANK_TABS, type MindBankTab, type Workspace, type MindBankDocument, type CreateWorkspaceRequest } from '../../types/mindbank.types'
import { WorkspaceList } from './components/WorkspaceList'
import { WorkspaceDialog } from './components/WorkspaceDialog'
import { DocumentList } from './components/DocumentList'
import { MinioFilePicker } from './components/MinioFilePicker'
import { MindBankQaView } from './components/MindBankQaView'

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

/**
 * MindBankDesktopView 桌面端布局：左侧 Workspace 列表 + 右侧 Tab 主区域。
 * 三 Tab 文件/入库 · Q&A · Agent 知识管家 共享同一组 Workspace 选择（切换 Tab 保留选中 workspace）。
 */
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
    <div className="hidden h-[calc(100dvh-2rem)] md:flex">
      {/* 左侧 Workspace 列表 */}
      <aside className="flex w-72 shrink-0 flex-col border-r border-border">
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

      {/* 右侧主区域 */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* 顶部：workspace 信息 + 添加文件按钮 */}
        <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
          <div className="min-w-0 flex-1">
            {selectedWorkspace ? (
              <>
                <h1 className="truncate text-[24px] font-black leading-tight text-foreground">
                  {selectedWorkspace.name}
                </h1>
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
                <h1 className="text-[24px] font-black leading-tight text-foreground">Mindbank</h1>
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

        {/* Tab 切换 */}
        <div className="border-b border-border px-6">
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

        {/* Tab 内容 */}
        <div className="flex-1 overflow-y-auto">
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
          {activeTab === 'agent' && (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
              <Bot className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm font-medium text-foreground">Agent 知识管家</p>
              <p className="max-w-md text-xs leading-5 text-muted-foreground">
                即将于下一阶段推出——AI 自动巡检知识库体系性、发现问题并提出建议
              </p>
            </div>
          )}
        </div>
      </main>

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
