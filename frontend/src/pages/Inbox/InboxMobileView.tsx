import { cn } from '../../lib/utils'
import { INBOX_TABS, type InboxTab } from './inbox.shared'
import { BookmarkPanel, type BookmarkPanelProps } from './components/BookmarkPanel'
import { DocumentPanel, type DocumentPanelProps } from './components/DocumentPanel'
import { QuickNotePanel, type QuickNotePanelProps } from './components/QuickNotePanel'

export type InboxMobileViewProps = {
  activeTab: InboxTab
  onTabChange: (tab: InboxTab) => void
  bookmarkProps: BookmarkPanelProps
  documentProps: DocumentPanelProps
  noteProps: QuickNotePanelProps & { onClearResult: () => void }
}

// InboxMobileView 承载 Inbox 移动端紧凑布局，优先触控可达性。
export function InboxMobileView({
  activeTab,
  onTabChange,
  bookmarkProps,
  documentProps,
  noteProps,
}: InboxMobileViewProps) {
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
      {activeTab === 'bookmarks' && <BookmarkPanel {...bookmarkProps} />}
      {activeTab === 'documents' && <DocumentPanel {...documentProps} />}
      {activeTab === 'notes' && (
        <QuickNotePanel
          obsidianConfigured={noteProps.obsidianConfigured}
          onSave={noteProps.onSave}
          isSaving={noteProps.isSaving}
          saveError={noteProps.saveError}
          lastResult={noteProps.lastResult}
        />
      )}
    </div>
  )
}
