/** Inbox 共享类型定义 */
export type InboxTab = 'bookmarks' | 'documents' | 'notes'

export const INBOX_TABS: { key: InboxTab; label: string }[] = [
  { key: 'bookmarks', label: '书签' },
  { key: 'documents', label: '文档' },
  { key: 'notes', label: '笔记' },
]
