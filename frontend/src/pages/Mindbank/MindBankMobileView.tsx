import { useState } from 'react'
import { Plus, ChevronRight, FolderOpen } from 'lucide-react'
import { cn } from '../../lib/utils'
import { PageShell, PageHeader, Tabs } from '@/components/shell'
import {
  MINDBANK_TABS,
} from '../../types/mindbank.types'
import { WorkspaceDialog } from './components/WorkspaceDialog'
import { DocumentList } from './components/DocumentList'
import { MinioFilePicker } from './components/MinioFilePicker'
import { MindBankQaView } from './components/MindBankQaView'
import { AgentTab } from './components/AgentTab'
import type { MindBankViewProps } from './MindBankDesktopView'

// MindBankMobileView 移动端 Mindbank 布局：顶部 Workspace chip 横向滚动 + Tab 切换 + 全宽内容，与 DesktopView 共享 props。
export function MindBankMobileView(props: MindBankViewProps) {
  const {
    activeTab,
    onTabChange,
    workspaces,
    selectedWorkspaceId,
    selectedWorkspace,
    onSelectWorkspace,
    onOpenCreate,
    onDeleteWorkspace,
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

  // 移动端编辑模式标记：从 DesktopView 通过 onEditWorkspace 触发（这里保留简单实现）
  const [editingWsId, setEditingWsId] = useState<number | null>(null)
  const editingWs = editingWsId != null ? workspaces.find((w) => w.id === editingWsId) ?? null : null

  const tabItems = MINDBANK_TABS.map(({ key, label }) => ({ value: key, label }))

  return (
    <div className="md:hidden">
      <PageShell variant="full" header={
        <PageHeader eyebrow="KNOWLEDGE" title="Mindbank" subtitle="你的知识在这里沉淀、连接。" />
      }>
        {/* 横向 Workspace chip */}
        <div className="px-1 py-2">
          <div
            className="flex gap-2 overflow-x-auto pb-1"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {workspaces.map((w) => {
              const active = w.id === selectedWorkspaceId
              return (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => {
                    onSelectWorkspace(w.id)
                    if (w.id === selectedWorkspaceId) setEditingWsId(w.id)
                  }}
                  className={cn(
                    'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors',
                    active
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-card text-foreground hover:bg-accent',
                  )}
                >
                  {w.domainTag && (
                    <span className={cn('text-[10px] font-black', active ? 'opacity-90' : 'text-primary')}>
                      #{w.domainTag}
                    </span>
                  )}
                  <span className="max-w-[120px] truncate">{w.name}</span>
                  <span className={cn('text-[10px]', active ? 'opacity-80' : 'text-muted-foreground')}>
                    {w.documentCount}
                  </span>
                </button>
              )
            })}
            <button
              type="button"
              onClick={onOpenCreate}
              className="flex shrink-0 items-center gap-1 rounded-full border border-dashed border-border bg-card px-3 py-1.5 text-xs font-bold text-muted-foreground hover:border-primary hover:text-primary"
            >
              <Plus className="h-3 w-3" /> 新建
            </button>
          </div>
        </div>

        {/* 当前 workspace 信息条 */}
        {selectedWorkspace && (
          <div className="flex items-center justify-between border-b border-border px-4 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black">{selectedWorkspace.name}</p>
              <p className="text-[11px] text-muted-foreground">
                {selectedWorkspace.documentCount} 个文档
              </p>
            </div>
            {activeTab === 'documents' && (
              <button
                type="button"
                onClick={onOpenFilePicker}
                className="nexus-button-primary inline-flex h-9 items-center gap-1 px-3 text-xs font-bold"
              >
                <Plus className="h-3.5 w-3.5" /> 添加
              </button>
            )}
          </div>
        )}

        {/* Tab 切换 */}
        <div className="border-b border-border px-4 py-2">
          <Tabs value={activeTab} onChange={onTabChange} items={tabItems} />
        </div>

        {/* 内容 */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'documents' && !selectedWorkspace ? (
            <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/[0.06]">
                <FolderOpen className="h-7 w-7 text-primary/40" />
              </div>
              <h3 className="mt-4 text-base font-extrabold text-foreground">
                请先选择或创建一个 Workspace
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                顶部选择已有 Workspace，或新建开始管理知识。
              </p>
              <button
                type="button"
                onClick={onOpenCreate}
                className="nexus-button-primary mt-4 inline-flex h-9 items-center gap-1.5 px-4 text-sm font-bold"
              >
                <Plus className="h-4 w-4" />
                新建 Workspace
              </button>
            </div>
          ) : (
            <>
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
            </>
          )}
        </div>
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

      {/* 移动端删除入口：再次点击当前 chip 进入编辑态 */}
      {editingWs && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-card p-3 shadow-[0_-8px_24px_rgba(0,0,0,0.08)]">
          <div className="mx-auto flex max-w-md items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">操作：{editingWs.name}</span>
            <button
              type="button"
              onClick={() => {
                if (confirm(`确认删除 Workspace「${editingWs.name}」？\n\n仅删除 DB 记录，AnythingLLM 数据保留。`)) {
                  onDeleteWorkspace(editingWs.id)
                  setEditingWsId(null)
                }
              }}
              className="inline-flex h-9 items-center gap-1 rounded-md border border-destructive bg-destructive px-3 text-xs font-bold text-destructive-foreground"
            >
              <ChevronRight className="h-3.5 w-3.5" />
              删除
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
