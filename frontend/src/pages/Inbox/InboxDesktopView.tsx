import { useState } from 'react'
import { Upload, Folder, FileText, Sparkles } from 'lucide-react'
import { PageShell, PageHeader, Tabs } from '@/components/shell'
import { INBOX_TABS, type InboxTab } from './inbox.shared'
import { BookmarkPanel } from './components/BookmarkPanel'
import { BookmarkCaptureBar } from './components/bookmarks/BookmarkCaptureBar'
import { BookmarkAiReviewPanel } from './components/bookmarks/BookmarkAiReviewPanel'
import { BookmarkImportDrawer } from './components/bookmarks/BookmarkImportDrawer'
import { BookmarkSmartGroupPanel } from './components/bookmarks/BookmarkSmartGroupPanel'
import { PaperlessGateway } from './components/documents/PaperlessGateway'
import { NoteComposer } from './components/notes/NoteComposer'
import { NoteAiSuggestionPanel } from './components/notes/NoteAiSuggestionPanel'
import { NoteSummaryPanel } from './components/notes/NoteSummaryPanel'
import type { NoteSectionState } from './hooks/useNoteSection'
import type {
  BookmarkAnalyzeResponse, BookmarkSmartGroup, BookmarkSmartGroupRequest,
  BookmarkImportPreviewResponse, ImportAction, MatchedBookmark,
  Paginated, Bookmark, InboxDocument,
} from '../../types/domain.types'

/** 笔记二级 Tab：速记 / 备忘录，结构完全对称，仅 kind 不同。导出供 InboxMobileView 复用 */
export const NOTE_SECTIONS: { key: 'quick_note' | 'memo'; label: string }[] = [
  { key: 'quick_note', label: '速记' },
  { key: 'memo', label: '备忘录' },
]

// Phase 3.1 扩展的 booklet props：包含 capture bar / AI 审查 / 导入 / 分组 / 列表所需全部字段
export type InboxDesktopBookmarkProps = {
  captureUrl: string
  captureTitle: string
  onCaptureUrlChange: (v: string) => void
  onCaptureTitleChange: (v: string) => void
  onAnalyze: (url: string, title?: string) => void
  analyzeResult: BookmarkAnalyzeResponse | null
  isAnalyzing: boolean
  resetAnalyze: () => void
  editedTitle: string
  editedDescription: string
  editedTags: string[]
  onEditedTitleChange: (v: string) => void
  onEditedDescriptionChange: (v: string) => void
  onEditedTagsChange: (v: string[]) => void
  aiAvailable: boolean
  showImportDrawer: boolean
  importPreview: BookmarkImportPreviewResponse | null
  isPreViewImporting: boolean
  isImportCommitting: boolean
  importDecisions: Map<number, ImportAction>
  onImportDecisionChange: (sourceIndex: number, action: ImportAction) => void
  onOpenImport: () => void
  onCloseImport: () => void
  onImportPasteSubmit: (text: string) => void
  onImportCommit: () => void
  previewError?: string
  commitError?: string
  smartGroups: BookmarkSmartGroup[]
  onGroupCreate: (data: BookmarkSmartGroupRequest) => void
  onGroupUpdate: (id: string, data: Partial<BookmarkSmartGroupRequest>) => void
  onGroupDelete: (id: string) => void
  onGroupPreview: (groupId: string) => void
  onGroupApply: (bookmarkIds: string[], groupIds: string[]) => void
  isApplyingGroup: boolean
  groupApplyError?: string
  groupPreviewResult: { groupId: string; matchedBookmarks: MatchedBookmark[] } | null
  isPreviewingGroup: boolean
  // 原有 BookmarkPanel 字段
  bookmarks: Paginated<Bookmark> | undefined
  isLoading: boolean
  isError: boolean
  queryParams: { q?: string; tag?: string; archived?: boolean; unread?: boolean; page: number; size: number }
  onQueryChange: (params: Record<string, unknown>) => void
  onCreate: (data: { url: string; title?: string; description?: string; notes?: string; tags?: string[] }) => void
  onUpdate: (id: string, data: Partial<Bookmark>) => void
  onDelete: (id: string) => void
  isCreating: boolean
  createError?: string
}

export type InboxDesktopDocumentProps = {
  gatewayStatus: 'connected' | 'not_configured' | 'unauthorized' | 'unreachable'
  lastChecked?: string
  entryLinks: { key: string; label: string; description: string; url: string }[]
  documents: InboxDocument[]
  onUpload: (file: File, title?: string, tags?: string[]) => void
  isUploading: boolean
  uploadError?: string
}

/** 速记 / 备忘录单个分区的全部 props，来自 useNoteSection 的返回值 */
export type NoteSectionProps = NoteSectionState

export type InboxDesktopViewProps = {
  activeTab: InboxTab
  onTabChange: (tab: InboxTab) => void
  bookmarkProps: InboxDesktopBookmarkProps
  documentProps: InboxDesktopDocumentProps
  quickNoteProps: NoteSectionProps
  memoProps: NoteSectionProps
}

// InboxDesktopView 承载 Inbox 桌面端三栏 tab 面板布局，集成新 Phase 3.1 组件。
export function InboxDesktopView({
  activeTab,
  onTabChange,
  bookmarkProps: bp,
  documentProps: dp,
  quickNoteProps,
  memoProps,
}: InboxDesktopViewProps) {
  // 笔记 Tab 内的二级 Tab：速记 / 备忘录，默认显示速记
  const [activeNoteSection, setActiveNoteSection] = useState<'quick_note' | 'memo'>('quick_note')
  const ns = activeNoteSection === 'quick_note' ? quickNoteProps : memoProps

  // tab 放到页眉右侧 actions，避免在标题与内容间形成一条全宽空带，并让主区/面板顶部对齐
  const headerContent = (
    <PageHeader
      eyebrow="CAPTURE"
      title="Inbox"
      subtitle="收集链接、文件和临时笔记。"
      actions={
        <Tabs
          items={INBOX_TABS.map(({ key, label }) => ({ value: key, label }))}
          value={activeTab}
          onChange={onTabChange}
        />
      }
    />
  )

  const panelContent = activeTab !== 'notes' ? (
    <div className="sticky top-4 space-y-4">
      {activeTab === 'bookmarks' && (
        <>
          <div className="nexus-surface p-4">
            <div className="flex items-center gap-2">
              <Upload className="h-4 w-4 text-primary" />
              <p className="text-sm font-extrabold text-foreground">导入</p>
            </div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              批量导入会先生成预览，冲突和分组都需要确认后才写入。
            </p>
            <button
              type="button"
              onClick={bp.onOpenImport}
              className="nexus-button-utility mt-3 flex w-full items-center justify-center gap-1.5 px-3 text-xs"
            >
              <Upload className="h-3.5 w-3.5" />
              批量导入
            </button>
          </div>

          <div className="nexus-surface p-4">
            <div className="mb-3 flex items-center gap-2">
              <Folder className="h-4 w-4 text-primary" />
              <div>
                <p className="text-sm font-extrabold text-foreground">智能分组</p>
                <p className="text-[11px] text-muted-foreground">规则匹配和 AI 建议归类</p>
              </div>
            </div>
            <BookmarkSmartGroupPanel
              groups={bp.smartGroups}
              onCreate={bp.onGroupCreate}
              onUpdate={(id, req) => bp.onGroupUpdate(id, req)}
              onDelete={bp.onGroupDelete}
              onPreview={bp.onGroupPreview}
              onApply={bp.onGroupApply}
              isAiAvailable={bp.aiAvailable}
              isCreating={false}
              isApplying={bp.isApplyingGroup}
              applyError={bp.groupApplyError}
              previewResult={bp.groupPreviewResult}
              isPreviewing={bp.isPreviewingGroup}
            />
          </div>
        </>
      )}

      {activeTab === 'documents' && (
        <div className="nexus-surface p-4">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <p className="text-sm font-extrabold text-foreground">Paperless Gateway</p>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Nexus 只提供上传、最近文档和入口链接；文档事实源仍在 paperless-ngx。
          </p>
        </div>
      )}
    </div>
  ) : undefined

  return (
    <PageShell
      variant="with-panel"
      header={headerContent}
      panel={panelContent}
    >
      {activeTab === 'bookmarks' && (
        <div className="space-y-4">
          {/* 快速捕获栏 */}
          <BookmarkCaptureBar
            url={bp.captureUrl}
            title={bp.captureTitle}
            onUrlChange={bp.onCaptureUrlChange}
            onTitleChange={bp.onCaptureTitleChange}
            onSave={() => bp.onCreate({ url: bp.captureUrl, title: bp.captureTitle || undefined })}
            onAnalyze={() => bp.onAnalyze(bp.captureUrl, bp.captureTitle)}
            isAnalyzing={bp.isAnalyzing}
            aiAvailable={bp.aiAvailable}
            isCreating={bp.isCreating}
          />

          {/* AI 审查面板 */}
          <BookmarkAiReviewPanel
            analyzeResponse={bp.analyzeResult}
            editedTitle={bp.editedTitle}
            editedDescription={bp.editedDescription}
            editedTags={bp.editedTags}
            onTitleChange={bp.onEditedTitleChange}
            onDescriptionChange={bp.onEditedDescriptionChange}
            onAddTag={(tag) => bp.onEditedTagsChange([...bp.editedTags, tag])}
            onRemoveTag={(tag) => bp.onEditedTagsChange(bp.editedTags.filter((t) => t !== tag))}
            onConfirmSave={() => {
              if (bp.analyzeResult) {
                bp.onCreate({
                  url: bp.analyzeResult.normalizedUrl,
                  title: bp.editedTitle || undefined,
                  description: bp.editedDescription || undefined,
                  tags: bp.editedTags.length > 0 ? bp.editedTags : undefined,
                })
                bp.resetAnalyze()
              }
            }}
            onSaveRaw={() => bp.onCreate({ url: bp.captureUrl, title: bp.captureTitle || undefined })}
            isSaving={bp.isCreating}
          />

          {/* 书签列表 */}
          <BookmarkPanel
            bookmarks={bp.bookmarks}
            isLoading={bp.isLoading}
            isError={bp.isError}
            queryParams={bp.queryParams}
            onQueryChange={bp.onQueryChange}
            onCreate={bp.onCreate}
            onUpdate={bp.onUpdate}
            onDelete={bp.onDelete}
            isCreating={bp.isCreating}
            createError={bp.createError}
            hideCreate
          />

          {/* 批量导入抽屉 */}
          <BookmarkImportDrawer
            open={bp.showImportDrawer}
            onClose={bp.onCloseImport}
            preview={bp.importPreview}
            isPreviewing={bp.isPreViewImporting}
            previewError={bp.previewError}
            onPasteSubmit={bp.onImportPasteSubmit}
            onCommit={bp.onImportCommit}
            isCommitting={bp.isImportCommitting}
            commitError={bp.commitError}
            decisions={bp.importDecisions}
            onDecisionChange={bp.onImportDecisionChange}
          />
        </div>
      )}

      {activeTab === 'documents' && (
        <PaperlessGateway
          status={dp.gatewayStatus}
          lastChecked={dp.lastChecked}
          entryLinks={dp.entryLinks}
          recentDocuments={dp.documents}
          onUpload={dp.onUpload}
          isUploading={dp.isUploading}
          uploadError={dp.uploadError}
        />
      )}

      {activeTab === 'notes' && (
        <div className="space-y-4">
          {/* 速记 / 备忘录 二级 Tab */}
          <Tabs
            items={NOTE_SECTIONS.map((section) => ({ value: section.key, label: section.label }))}
            value={activeNoteSection}
            onChange={setActiveNoteSection}
          />

          <div className="grid grid-cols-[minmax(0,1fr)_320px] items-start gap-4">
            <div className="min-w-0 space-y-4">
              <NoteComposer
                title={ns.title}
                content={ns.content}
                selectedTags={ns.selectedTags}
                onTagsChange={ns.onTagsChange}
                availableTags={ns.availableTags}
                onTitleChange={ns.onTitleChange}
                onContentChange={ns.onContentChange}
                onSave={ns.onSave}
                onAnalyze={ns.onAnalyze}
                aiSuggestion={ns.aiResult}
                onApplySuggestion={ns.onApplySuggestion}
                isSaving={ns.isSaving}
                isAnalyzing={ns.isAnalyzing}
                aiAvailable={ns.aiAvailable}
                onClearDraft={ns.onClearDraft}
              />

              <NoteSummaryPanel
                titleQuery={ns.summaryTitleQuery}
                onTitleQueryChange={ns.onSummaryTitleQueryChange}
                availableTags={ns.availableTags}
                selectedTags={ns.summaryTags}
                onTagsChange={ns.onSummaryTagsChange}
                onSummarize={ns.onSummarize}
                isSummarizing={ns.isSummarizing}
                result={ns.summaryResult}
                onReorganize={ns.onReorganize}
                isReorganizing={ns.isReorganizing}
                reorganizeResult={ns.reorganizeResult}
              />
            </div>

            <aside className="space-y-4">
              <div className="nexus-surface p-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <p className="text-sm font-extrabold text-foreground">AI 建议</p>
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  先写原文，再让 AI 生成标题、标签和整理后的 Markdown。建议只会在你确认后应用。
                </p>
              </div>
              {ns.aiResult ? (
                <NoteAiSuggestionPanel
                  suggestion={ns.aiResult}
                  onApply={ns.onApplySuggestion}
                  onDismiss={ns.resetAnalyze}
                />
              ) : (
                <div className="rounded-lg border border-dashed bg-card/60 p-4 text-center text-xs text-muted-foreground">
                  暂无建议
                </div>
              )}
            </aside>
          </div>
        </div>
      )}
    </PageShell>
  )
}
