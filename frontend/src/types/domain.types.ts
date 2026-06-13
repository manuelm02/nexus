export interface Todo {
  id: string
  title: string
  description?: string
  priority: 'low' | 'medium' | 'high'
  status: 'pending' | 'cancelled' | 'not_started' | 'in_progress' | 'done'
  scheduledDate?: string
  dueDate?: string
  notionPageUrl?: string
  notionSynced: boolean
  createdAt: string
  updatedAt: string
}

/** 看板分组响应，后端保证 today/future/overdue/tasks 四个分组互斥 */
export interface TodoBoardResponse {
  today: Todo[]
  future: Todo[]
  overdue: Todo[]
  tasks: Todo[]
}

export interface InboxItem {
  id: string
  title?: string
  content: string
  tags?: string[]
  notionPageUrl?: string
  notionSynced: boolean
  createdAt: string
  updatedAt: string
}

/** Nexus 原生书签 */
export interface Bookmark {
  id: string
  url: string
  title?: string
  description?: string
  notes?: string
  tagNames: string[]
  unread: boolean
  archived: boolean
  domain?: string
  createdAt: string
  updatedAt: string
}

/** paperless-ngx 文档 */
export interface InboxDocument {
  id: string
  title: string
  originalFileName?: string
  createdAt?: string
  addedAt?: string
  correspondent?: string
  documentType?: string
  tags: string[]
  downloadUrl?: string
  previewUrl?: string
}

/** Quick Note / Memo 请求 */
export interface QuickNoteRequest {
  title?: string
  content: string
  kind?: 'quick_note' | 'memo'
  tags?: string[]
}

/** Quick Note / Memo 响应 */
export interface QuickNoteResponse {
  path: string
  relativePath: string
  createdAt: string
}

/** 分页响应 */
export interface Paginated<T> {
  records: T[]
  total: number
  size: number
  current: number
  pages: number
}

export interface TranslationResult {
  id: string
  sourceText: string
  translatedText: string
  sourceLang?: string
  targetLang: string
  style?: string
  explanation?: string
  keywords?: string[]
  alternatives?: string[]
  provider?: string
  createdAt: string
}

export type Translation = TranslationResult

export interface Subscription {
  id: string
  name: string
  category?: string
  price?: number
  currency: string
  billingType?: string
  startDate?: string
  expireDate?: string
  nextBillingDate?: string
  usageLimit?: number
  usageUsed: number
  usageUnit?: string
  url?: string
  notes?: string
  status: 'active' | 'expired' | 'cancelled' | 'paused'
  notifyEnabled: boolean
  notifyDaysBefore: number
  createdAt: string
  updatedAt: string
}

export interface LlmProvider {
  id: string
  name: string
  provider: string
  baseUrl?: string
  model?: string
  defaultProvider: boolean
  enabled: boolean
  createdAt: string
}

export interface WorkflowLlmConfig {
  id: string
  workflowType: string
  providerId?: string
  modelOverride?: string
  temperature?: number
  updatedAt: string
}
