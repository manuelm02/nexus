import { Upload, Folder, FileText, Sparkles } from 'lucide-react'
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
import type {
  BookmarkAnalyzeResponse, BookmarkSmartGroup, BookmarkSmartGroupRequest,
  BookmarkImportPreviewResponse, NoteAnalyzeResponse, ImportAction, MatchedBookmark,
  Paginated, Bookmark, InboxDocument,
} from '../../types/domain.types'

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
  smartGroups: BookmarkSmartGroup[]
  onGroupCreate: (data: BookmarkSmartGroupRequest) => void
  onGroupUpdate: (id: string, data: Partial<BookmarkSmartGroupRequest>) => void
  onGroupDelete: (id: string) => void
  onGroupPreview: (groupId: string) => void
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

export type InboxDesktopNoteProps = {
  noteContent: string
  noteTitle: string
  noteTags: string[]
  noteKind: 'quick_note' | 'memo'
  onContentChange: (v: string) => void
  onTitleChange: (v: string) => void
  onTagsChange: (v: string[]) => void
  onKindChange: (v: 'quick_note' | 'memo') => void
  aiAvailable: boolean
  onAnalyze: (data: { title?: string; content: string; kind?: string; tags?: string[] }) => void
  noteAiResult: NoteAnalyzeResponse | null
  isAnalyzing: boolean
  onApplySuggestion: (suggestion: NoteAnalyzeResponse) => void
  resetAnalyze: () => void
  obsidianConfigured: boolean
  onSave: () => void
  isSaving: boolean
  saveError?: string
  lastResult: { relativePath: string } | null
  onClearResult: () => void
}

export type InboxDesktopViewProps = {
  activeTab: InboxTab
  onTabChange: (tab: InboxTab) => void
  bookmarkProps: InboxDesktopBookmarkProps
  documentProps: InboxDesktopDocumentProps
  noteProps: InboxDesktopNoteProps
}

// InboxDesktopView 承载 Inbox 桌面端三栏 tab 面板布局，集成新 Phase 3.1 组件。
export function InboxDesktopView({
  activeTab,
  onTabChange,
  bookmarkProps: bp,
  documentProps: dp,
  noteProps: np,
}: InboxDesktopViewProps) {
  return (
    <div className="nexus-page-enter mx-auto hidden max-w-[1280px] space-y-4 p-4 md:block lg:p-6">
      {/* 页面标题区 */}
      <div className="flex items-end justify-between gap-6">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground">Capture workspace</p>
          <h1 className="mt-1 text-[28px] font-black leading-tight">Inbox</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            收集链接、文件和临时笔记。
          </p>
        </div>

        {/* Tab 切换 */}
        <div className="inline-grid h-11 grid-cols-3 rounded-lg border bg-card p-1 shadow-[var(--shadow-xs)]">
          {INBOX_TABS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => onTabChange(key)}
              className={cn(
                'h-full rounded-md px-6 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                activeTab === key
                  ? 'bg-primary text-primary-foreground'
                  : 'text-accent-foreground hover:bg-accent',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 面板内容 */}
      <div className={cn(
        'grid items-start gap-5',
        activeTab === 'notes'
          ? 'grid-cols-1'
          : 'grid-cols-[minmax(0,760px)_320px]',
      )}>
        <main className="min-w-0 space-y-3">
        {activeTab === 'bookmarks' && (
          <div className="space-y-3">
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

            {/* 导入按钮 */}
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
              onPasteSubmit={bp.onImportPasteSubmit}
              onCommit={bp.onImportCommit}
              isCommitting={bp.isImportCommitting}
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
          <div className="grid grid-cols-[minmax(0,1fr)_320px] items-start gap-4">
            <div className="min-w-0">
            <NoteComposer
              kind={np.noteKind}
              title={np.noteTitle}
              content={np.noteContent}
              tags={np.noteTags}
              onKindChange={np.onKindChange}
              onTitleChange={np.onTitleChange}
              onContentChange={np.onContentChange}
              onAddTag={(tag) => np.onTagsChange([...np.noteTags, tag])}
              onRemoveTag={(tag) => np.onTagsChange(np.noteTags.filter((t) => t !== tag))}
              onSave={np.onSave}
              onAnalyze={() => np.onAnalyze({
                content: np.noteContent,
                title: np.noteTitle || undefined,
                kind: np.noteKind,
                tags: np.noteTags.length > 0 ? np.noteTags : undefined,
              })}
              aiSuggestion={np.noteAiResult}
              onApplySuggestion={() => {
                if (np.noteAiResult) np.onApplySuggestion(np.noteAiResult!)
              }}
              isSaving={np.isSaving}
              isAnalyzing={np.isAnalyzing}
              aiAvailable={np.aiAvailable}
            />
            </div>

            <aside className="space-y-3">
              <div className="rounded-lg border bg-card p-3 shadow-[var(--shadow-xs)]">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <p className="text-sm font-extrabold text-foreground">AI 建议</p>
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  先写原文，再让 AI 生成标题、标签、目录和整理后的 Markdown。建议只会在你确认后应用。
                </p>
              </div>
            {np.noteAiResult ? (
              <NoteAiSuggestionPanel
                suggestion={np.noteAiResult}
                onApply={() => np.onApplySuggestion(np.noteAiResult!)}
                onDismiss={np.resetAnalyze}
              />
            ) : (
              <div className="rounded-lg border border-dashed bg-card/60 p-4 text-center text-xs text-muted-foreground">
                暂无建议
              </div>
            )}
            </aside>
          </div>
        )}
        </main>

        {activeTab !== 'notes' && (
        <aside className="sticky top-4 min-w-0 space-y-3">
          {activeTab === 'bookmarks' && (
            <>
              <div className="rounded-lg border bg-card p-3 shadow-[var(--shadow-xs)]">
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

              <div className="rounded-lg border bg-card p-3 shadow-[var(--shadow-xs)]">
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
                  onApply={() => {}}
                  isAiAvailable={bp.aiAvailable}
                  isCreating={false}
                  previewResult={bp.groupPreviewResult}
                  isPreviewing={bp.isPreviewingGroup}
                />
              </div>
            </>
          )}

          {activeTab === 'documents' && (
            <div className="rounded-lg border bg-card p-3 shadow-[var(--shadow-xs)]">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <p className="text-sm font-extrabold text-foreground">Paperless Gateway</p>
              </div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Nexus 只提供上传、最近文档和入口链接；文档事实源仍在 paperless-ngx。
              </p>
            </div>
          )}
        </aside>
        )}
      </div>
    </div>
  )
}
