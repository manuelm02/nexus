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
  /** AI 本次分析新建的标签说明（key 为标签名），保存时后端写回标签索引 */
  newTagDescriptions?: Record<string, string>
}

/** Quick Note / Memo 响应 */
export interface QuickNoteResponse {
  path: string
  relativePath: string
  createdAt: string
  /** 最终写入的标签（恰好 1 个），留空提交时由后端 AI 自动打标签 */
  tag?: string
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
  status: 'active' | 'expired' | 'paused'
  notifyEnabled: boolean
  notifyDaysBefore: number
  autoRenew: boolean
  archived: boolean
  remainingBalance?: number
  monthlySpend: number
  lowBalanceNotify: boolean
  lowBalanceThreshold?: number
  apiProvider?: string
  apiFetchEnabled: boolean
  apiLastFetchedAt?: string
  apiBalanceJson?: { is_available?: boolean; balance_infos?: Array<{ currency: string; total_balance: string; granted_balance: string; topped_up_balance: string }> } | null
  createdAt: string
  updatedAt: string
}

/** 按量订阅充值/消费流水条目 */
export interface LedgerEntry {
  id: string
  type: 'recharge' | 'consume'
  amount: number
  balanceAfter: number
  note?: string
  occurredOn: string
  createdAt: string
}

/** 订阅分类 */
export interface SubscriptionCategory {
  id: string
  name: string
  createdAt: string
}

/** 订阅统计 */
export interface SubscriptionStats {
  activeCount: number
  monthlyTotal: Record<string, number>
  yearlyTotal: Record<string, number>
  dueThisMonth: Record<string, number>
}

/** API 余额监控历史快照点 */
export interface BalanceSnapshot {
  balance: number
  currency: string
  snapshottedAt: string
}

/** 各币种兑 CNY 的实时汇率，CNY 自身固定为 1 */
export type ExchangeRates = Record<string, number>

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

// ==================== Chat 日常问答 ====================

export interface ChatConversation {
  id: string
  title: string
  titleAi: boolean
  workflowType: string
  messageCount: number
  createdAt: string
  updatedAt: string
}

export interface ChatMessage {
  id: string
  conversationId: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

export interface ChatSuggestion {
  text: string
}

// ==================== Inbox AI Workspace 新类型 ====================

/** 书签 AI 分析请求 */
export interface BookmarkAnalyzeRequest {
  url: string
  title?: string
  existingTags?: string[]
}

/** 书签 AI 分析响应 */
export interface BookmarkAnalyzeResponse {
  originalUrl: string
  normalizedUrl: string
  trackingParamsRemoved: string[]
  domain: string
  suggestedTitle?: string
  suggestedDescription?: string
  suggestedTags?: string[]
  suggestedGroupId?: string
  suggestedGroupName?: string
  duplicateStatus: 'none' | 'exact_duplicate' | 'possible_conflict'
  conflictCandidate?: Bookmark
  aiAvailable: boolean
  confidence?: 'high' | 'medium' | 'low'
  matchedGroups: GroupSuggestion[]
}

export interface GroupSuggestion {
  groupId: string
  groupName: string
  matchReason: string
}

/** 批量导入 */
export interface ImportItem {
  url: string
  title?: string
}

export interface BookmarkImportPreviewRequest {
  items: ImportItem[]
}

export interface ImportSummary {
  totalCount: number
  createCount: number
  skipCount: number
  conflictCount: number
  invalidCount: number
}

export interface ImportPreviewItem {
  sourceIndex: number
  url: string
  title?: string
  normalizedUrl: string
  domain: string
  suggestedTitle?: string
  suggestedDescription?: string
  suggestedTags?: string[]
  suggestedGroupId?: string
  suggestedGroupName?: string
  aiAvailable: boolean
}

export interface ConflictPreviewItem {
  sourceIndex: number
  url: string
  title?: string
  normalizedUrl: string
  existingBookmarkId: string
  existingTitle?: string
  existingUrl: string
  aiAvailable: boolean
  aiVerdict?: 'same' | 'different' | 'low_confidence'
}

export interface InvalidPreviewItem {
  sourceIndex: number
  url: string
  title?: string
  reason: string
}

export interface BookmarkImportPreviewResponse {
  importSessionId: string
  summary: ImportSummary
  createItems: ImportPreviewItem[]
  skipItems: ImportPreviewItem[]
  conflictItems: ConflictPreviewItem[]
  invalidItems: InvalidPreviewItem[]
}

export type ImportAction = 'create' | 'update' | 'skip'

export interface ImportDecision {
  sourceIndex: number
  action: ImportAction
  finalTitle?: string
  finalTags?: string[]
  finalDescription?: string
  acceptSuggestedGroup?: boolean
}

export interface BookmarkImportCommitRequest {
  importSessionId: string
  decisions: ImportDecision[]
}

export interface BookmarkImportCommitResponse {
  createdCount: number
  updatedCount: number
  skippedCount: number
  createdBookmarkIds: string[]
}

/** 标签汇总 */
export interface TagInfo {
  name: string
  count: number
}

export interface BookmarkTagSummaryResponse {
  tags: TagInfo[]
}

/** 智能分组 */
export interface BookmarkSmartGroup {
  id: string
  name: string
  description?: string
  matchMode: 'any_tag' | 'all_tags' | 'domain' | 'url_pattern'
  matchValue: string
  orderIndex: number
  enabled: boolean
  bookmarkCount: number
  createdAt: string
  updatedAt: string
}

export interface BookmarkSmartGroupRequest {
  name: string
  description?: string
  matchMode: string
  matchValue: string
  orderIndex: number
  enabled?: boolean
}

export interface BookmarkGroupPreviewRequest {
  bookmarkIds?: string[]
  groupIds?: string[]
}

export interface MatchedBookmark {
  bookmarkId: string
  title?: string
  url: string
  domain?: string
  alreadyAssigned: boolean
}

export interface GroupPreview {
  groupId: string
  groupName: string
  matchMode: string
  matchedCount: number
  matchedBookmarks: MatchedBookmark[]
}

export interface BookmarkGroupPreviewResponse {
  groups: GroupPreview[]
}

export interface BookmarkGroupApplyRequest {
  bookmarkIds: string[]
  groupIds: string[]
}

/** paperless 网关 */
export interface EntryLink {
  key: string
  label: string
  description: string
  url: string
}

export interface PaperlessGatewayStatusResponse {
  configured: boolean
  reachable: boolean
  status: string
  message: string
  entryLinks: EntryLink[]
}

/** 笔记 AI */
export interface NoteAnalyzeRequest {
  title?: string
  content: string
  kind?: string
  tags?: string[]
}

export interface ActionItem {
  description: string
  priority: 'high' | 'medium' | 'low'
}

export interface NoteAnalyzeResponse {
  suggestedTitle?: string
  suggestedKind?: string
  suggestedTags?: string[]
  suggestedCategory?: string
  suggestedFolder?: string
  cleanedMarkdown?: string
  actionItems?: ActionItem[]
  aiAvailable: boolean
  confidence?: string
  /** AI 本次新建标签的范围说明，key 为标签名；仅包含索引中尚不存在的标签 */
  newTagDescriptions?: Record<string, string>
}

/** 标签索引条目：标签名 + 适用范围说明 */
export interface NoteTagEntry {
  name: string
  description: string
}

/** 笔记汇总请求：按标题关键词和/或标签筛选笔记 */
export interface NoteSummarizeRequest {
  kind: 'quick_note' | 'memo'
  titleQuery?: string
  tags?: string[]
}

/** 笔记汇总响应：匹配数量 + AI 生成的 Markdown 汇总 */
export interface NoteSummarizeResponse {
  markdown?: string
  matchedCount: number
}

/** 笔记标签整理请求：对指定 kind 下所有笔记重新评估标签并归位 */
export interface NoteReorganizeRequest {
  kind: 'quick_note' | 'memo'
}

/** 单条标签整理变更记录 */
export interface NoteReorganizeChange {
  title?: string
  oldTag: string
  newTag: string
  oldPath: string
  newPath: string
}

/** 笔记标签整理结果 */
export interface NoteReorganizeResponse {
  scannedCount: number
  changes: NoteReorganizeChange[]
  /** AI 不可用时为 true，此时不执行任何变更，changes 为空 */
  aiUnavailable: boolean
}

/** Inbox 设置 */
export interface InboxSettings {
  paperlessEnabled: boolean
  paperlessBaseUrl?: string
  paperlessTokenConfigured: boolean
  paperlessOpenInNewTab: boolean
  paperlessDefaultUploadTags?: string
  obsidianEnabled: boolean
  obsidianVaultPath?: string
  obsidianInboxDir: string
  obsidianMemoDir: string
  obsidianFileNamingPattern?: string
  bookmarksAiAssistEnabled: boolean
  bookmarksBulkImportEnabled: boolean
  bookmarksStripTrackingParams: boolean
  bookmarksDefaultUnread: boolean
  bookmarksSmartGroupsEnabled: boolean
  inboxAiAvailable: boolean
}

export interface InboxSettingsUpdateRequest {
  paperlessEnabled?: boolean
  paperlessBaseUrl?: string
  paperlessApiToken?: string | null
  paperlessOpenInNewTab?: boolean
  paperlessDefaultUploadTags?: string
  obsidianEnabled?: boolean
  obsidianVaultPath?: string
  obsidianInboxDir?: string
  bookmarksAiAssistEnabled?: boolean
  bookmarksBulkImportEnabled?: boolean
  bookmarksStripTrackingParams?: boolean
  bookmarksDefaultUnread?: boolean
  bookmarksSmartGroupsEnabled?: boolean
}

// ==================== Mindbank Settings ====================

/** Mindbank 配置响应（API Key 类字段仅返回是否已配置，不暴露实际值） */
export interface MindBankSettings {
  // 服务地址
  anythingllmUrl: string
  minioUrl: string
  minioBucket: string
  obsidianSubFolder: string
  // 认证（脱敏标记）
  anythingllmApiKeyConfigured: boolean
  minioAccessKeyConfigured: boolean
  minioSecretKeyConfigured: boolean
  // AI 模型（三个工作流的 providerId，空串表示继承全局默认）
  mindbankClassifyProviderId: string
  mindbankOrganizeProviderId: string
  mindbankCondenseProviderId: string
  // 流水线行为
  pipelineAutoSessionNote: boolean
  /** 可用的 Provider 列表，供模型下拉选择 */
  providers: LlmProvider[]
}

/** Mindbank 配置更新请求（PATCH 语义：仅非 null/undefined 字段被更新） */
export interface MindBankSettingsUpdateRequest {
  anythingllmUrl?: string
  minioUrl?: string
  minioBucket?: string
  obsidianSubFolder?: string
  // Key 类字段：undefined=不变，空串=清除，非空=加密存储
  anythingllmApiKey?: string | null
  minioAccessKey?: string | null
  minioSecretKey?: string | null
  // 模型 providerId：undefined=不变，空串=清除绑定
  mindbankClassifyProviderId?: string
  mindbankOrganizeProviderId?: string
  mindbankCondenseProviderId?: string
  pipelineAutoSessionNote?: boolean
}
