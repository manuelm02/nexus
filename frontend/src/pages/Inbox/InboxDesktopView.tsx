import { cn } from '../../lib/utils'
import { INBOX_TABS, type InboxTab } from './inbox.shared'
import { BookmarkPanel, type BookmarkPanelProps } from './components/BookmarkPanel'
import { DocumentPanel, type DocumentPanelProps } from './components/DocumentPanel'
import { QuickNotePanel, type QuickNotePanelProps } from './components/QuickNotePanel'

export type InboxDesktopViewProps = {
  activeTab: InboxTab
  onTabChange: (tab: InboxTab) => void
  bookmarkProps: BookmarkPanelProps
  documentProps: DocumentPanelProps
  noteProps: QuickNotePanelProps & { onClearResult: () => void }
}

// InboxDesktopView 承载 Inbox 桌面端三栏 tab 面板布局，保持紧凑工作台风格。
export function InboxDesktopView({
  activeTab,
  onTabChange,
  bookmarkProps,
  documentProps,
  noteProps,
}: InboxDesktopViewProps) {
  return (
    <div className="nexus-page-enter mx-auto hidden max-w-[1180px] space-y-4 p-4 md:block lg:p-6">
      {/* 页面标题区 */}
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
              'h-full rounded-md px-5 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
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
      <div className="max-w-[720px]">
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
    </div>
  )
}
