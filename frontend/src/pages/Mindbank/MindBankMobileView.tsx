import { useState } from 'react'
import { Plus, Files, MessageSquare, Bot, ChevronRight } from 'lucide-react'
import { cn } from '../../lib/utils'
import {
  MINDBANK_TABS,
  type MindBankTab,
} from '../../types/mindbank.types'
import { WorkspaceDialog } from './components/WorkspaceDialog'
import { DocumentList } from './components/DocumentList'
import { MinioFilePicker } from './components/MinioFilePicker'
import type { MindBankViewProps } from './MindBankDesktopView'

const TAB_ICONS: Record<MindBankTab, typeof Files> = {
  documents: Files,
  qa: MessageSquare,
  agent: Bot,
}

/**
 * MindBankMobileView 移动端布局：顶部 workspace chip 横向滚动 + Tab 切换 + 全宽内容。
 * 与 DesktopView 共享同一组 props，确保业务逻辑一致；交互模式允许设备差异（chip 替代侧边栏）。
 */
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

  const isPlaceholderTab = activeTab === 'qa' || activeTab === 'agent'
  const TabIcon = TAB_ICONS[activeTab]

  return (
    <div className="nexus-page-enter flex h-[calc(100dvh-2rem)] flex-col md:hidden">
      {/* 标题 */}
      <div className="px-4 pb-2 pt-3">
        <p className="text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground">
          Knowledge memory
        </p>
        <h1 className="mt-0.5 text-2xl font-black leading-tight">Mindbank</h1>
      </div>

      {/* 横向 Workspace chip：移除外层 border-y 和 bg-muted/30,避免为 chip 区域再套一层 surface */}
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
                  // 长按进入编辑态（这里用单击触发简化交互，移动端后续可改为长按）
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
        <div className="grid h-10 grid-cols-3 rounded-lg border bg-card p-1 shadow-[var(--shadow-xs)]">
          {MINDBANK_TABS.map(({ key, label }) => {
            const Icon = TAB_ICONS[key]
            return (
              <button
                key={key}
                type="button"
                onClick={() => onTabChange(key)}
                className={cn(
                  'inline-flex h-full items-center justify-center gap-1 rounded-md text-xs font-bold transition-colors',
                  activeTab === key
                    ? 'bg-primary text-primary-foreground'
                    : 'text-accent-foreground hover:bg-accent',
                )}
              >
                <Icon className="h-3 w-3" />
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* 内容 */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'documents' && (
          <DocumentList
            workspace={selectedWorkspace}
            documents={documents}
            isLoading={isLoadingDocuments}
            onRetryStep={onRetryStep}
          />
        )}
        {isPlaceholderTab && (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
            <TabIcon className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-bold text-foreground">
              {activeTab === 'qa' ? 'Q&A 即将推出' : 'Agent 知识管家 即将推出'}
            </p>
            <p className="max-w-xs text-xs leading-5 text-muted-foreground">
              {activeTab === 'qa'
                ? 'Phase 6.6 接入 RAG 问答，基于 AnythingLLM workspace 回答知识库问题。'
                : 'Phase 6.7 接入 LangChain4j 自建 Agent 巡检 / 融合自检 / 知识库维护。'}
            </p>
          </div>
        )}
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
