import { useState } from 'react'
import { Upload } from 'lucide-react'
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

  const headerContent = (
    <>
      <PageHeader eyebrow="CAPTURE" title="Inbox" subtitle="收集链接、文件和临时笔记。" />
      <Tabs
        items={INBOX_TABS.map(({ key, label }) => ({ value: key, label }))}
        value={activeTab}
        onChange={onTabChange}
      />
    </>
  )

  return (
    <div className="pb-20 md:hidden">
      <PageShell variant="full" header={headerContent}>
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

            {/* 移动端导入按钮 */}
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
            {/* 速记 / 备忘录 二级 Tab */}
            <Tabs
              items={NOTE_SECTIONS.map((section) => ({ value: section.key, label: section.label }))}
              value={activeNoteSection}
              onChange={setActiveNoteSection}
            />

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
      </PageShell>
    </div>
  )
}
