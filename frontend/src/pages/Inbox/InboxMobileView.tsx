import { useState } from 'react'
import { Upload } from 'lucide-react'
import { cn } from '../../lib/utils'
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
import {
  NOTE_SECTIONS,
  type InboxDesktopBookmarkProps, type InboxDesktopDocumentProps, type NoteSectionProps,
} from './InboxDesktopView'

export type InboxMobileViewProps = {
  activeTab: InboxTab
  onTabChange: (tab: InboxTab) => void
  bookmarkProps: InboxDesktopBookmarkProps
  documentProps: InboxDesktopDocumentProps
  quickNoteProps: NoteSectionProps
  memoProps: NoteSectionProps
}

// InboxMobileView 承载 Inbox 移动端紧凑布局，集成新 Phase 3.1 组件。
export function InboxMobileView({
  activeTab,
  onTabChange,
  bookmarkProps: bp,
  documentProps: dp,
  quickNoteProps,
  memoProps,
}: InboxMobileViewProps) {
  // 笔记 Tab 内的二级 Tab：速记 / 备忘录，默认显示速记
  const [activeNoteSection, setActiveNoteSection] = useState<'quick_note' | 'memo'>('quick_note')
  const ns = activeNoteSection === 'quick_note' ? quickNoteProps : memoProps

  return (
    <div className="nexus-page-enter mx-auto max-w-full space-y-3 p-4 pb-20 md:hidden">
      {/* 页面标题区 — 紧凑 */}
      <h1 className="text-[22px] font-black leading-tight">Inbox</h1>
      <p className="text-sm text-muted-foreground">收集链接、文件和临时笔记。</p>

      {/* Tab 切换 — 全宽 */}
      <div className="grid h-11 grid-cols-3 rounded-lg border bg-card p-1 shadow-[var(--shadow-xs)]">
        {INBOX_TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => onTabChange(key)}
            className={cn(
              'h-full rounded-md text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              activeTab === key
                ? 'bg-primary text-primary-foreground'
                : 'text-accent-foreground hover:bg-accent',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 面板内容 */}
      {activeTab === 'bookmarks' && (
        <div className="space-y-3">
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

          {/* 移动端导入按钮 — 全宽按钮 */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={bp.onOpenImport}
              className="nexus-button-utility flex items-center gap-1.5 px-3 py-1.5 text-xs"
            >
              <Upload className="h-3.5 w-3.5" />
              批量导入
            </button>
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
        <div className="space-y-3">
          {/* 速记 / 备忘录 二级 Tab：结构完全对称，仅 kind 不同 */}
          <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/40 p-1">
            {NOTE_SECTIONS.map((section) => (
              <button
                key={section.key}
                type="button"
                onClick={() => setActiveNoteSection(section.key)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-bold transition-colors',
                  activeNoteSection === section.key
                    ? 'bg-card text-foreground shadow-[var(--shadow-xs)]'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {section.label}
              </button>
            ))}
          </div>

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

          {ns.aiResult && (
            <NoteAiSuggestionPanel
              suggestion={ns.aiResult}
              onApply={ns.onApplySuggestion}
              onDismiss={ns.resetAnalyze}
            />
          )}

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
      )}
    </div>
  )
}
