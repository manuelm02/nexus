import { useEffect, useState } from 'react'
import { AlertCircle, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { cn } from '../../../lib/utils'
import type { InboxSettings, InboxSettingsUpdateRequest, LlmProvider } from '../../../types/domain.types'
import { WorkflowModelSelect } from './WorkflowModelSelect'

export type InboxSettingsPanelProps = {
  settings: InboxSettings
  providers: LlmProvider[]
  workflowProviderId: string
  onUpdate: (update: InboxSettingsUpdateRequest) => void
  onWorkflowProviderSave: (providerId: string) => void
  onTestPaperless?: () => void
  onTestObsidian?: () => void
  testResult?: { service: string; success: boolean; message?: string } | null
  isTesting?: boolean
  isUpdating?: boolean
  isWorkflowUpdating?: boolean
  updateError?: boolean
  workflowUpdateError?: boolean
}

// Inbox 设置面板容器：包含书签、Paperless、Obsidian 三个设置子卡片。
export function InboxSettingsPanel({
  settings,
  providers,
  workflowProviderId,
  onUpdate,
  onWorkflowProviderSave,
  onTestPaperless,
  onTestObsidian,
  testResult,
  isTesting,
  isUpdating,
  isWorkflowUpdating,
  updateError,
  workflowUpdateError,
}: InboxSettingsPanelProps) {
  const [draft, setDraft] = useState<InboxSettingsUpdateRequest>(() => createDraft(settings))
  const [tokenDraftState, setTokenDraftState] = useState<'unchanged' | 'replace' | 'clear'>('unchanged')
  const [workflowProviderDraft, setWorkflowProviderDraft] = useState(workflowProviderId)
  const [activeInnerTab, setActiveInnerTab] = useState<'model' | 'bookmarks' | 'paperless' | 'obsidian'>('model')

  // Settings 页面采用显式保存：后端数据变化时重置草稿，输入过程不触发远程请求。
  useEffect(() => {
    setDraft(createDraft(settings))
    setTokenDraftState('unchanged')
  }, [settings])

  useEffect(() => {
    setWorkflowProviderDraft(workflowProviderId)
  }, [workflowProviderId])

  const settingsDirty = JSON.stringify(draft) !== JSON.stringify(createDraft(settings)) || tokenDraftState !== 'unchanged'
  const workflowDirty = workflowProviderDraft !== workflowProviderId
  const dirty = settingsDirty || workflowDirty
  const saving = Boolean(isUpdating || isWorkflowUpdating)

  const updateDraft = (update: InboxSettingsUpdateRequest) => {
    setDraft((prev) => ({ ...prev, ...update }))
    if ('paperlessApiToken' in update) {
      setTokenDraftState(update.paperlessApiToken === null ? 'clear' : 'replace')
    }
  }

  const handleCancel = () => {
    setDraft(createDraft(settings))
    setTokenDraftState('unchanged')
    setWorkflowProviderDraft(workflowProviderId)
  }

  const handleSave = () => {
    if (settingsDirty) {
      onUpdate(draft)
    }
    if (workflowDirty) {
      onWorkflowProviderSave(workflowProviderDraft)
    }
  }

  const innerTabs: { key: typeof activeInnerTab; label: string }[] = [
    { key: 'model', label: '专用模型' },
    { key: 'bookmarks', label: '书签' },
    { key: 'paperless', label: '文档' },
    { key: 'obsidian', label: '笔记' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-foreground">Inbox 设置</h2>
        </div>
        {dirty && (
          <span className="rounded-md bg-warning-soft px-2 py-1 text-xs font-bold text-warning">
            有未保存更改
          </span>
        )}
      </div>

      <div className="grid gap-2 rounded-lg border bg-muted/40 p-1 md:grid-cols-4">
        {innerTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveInnerTab(tab.key)}
            className={cn(
              'rounded-md px-3 py-2 text-left transition-colors',
              activeInnerTab === tab.key ? 'bg-card shadow-[var(--shadow-xs)]' : 'hover:bg-card/70',
            )}
          >
            <span className={cn(
              'block text-sm font-extrabold',
              activeInnerTab === tab.key ? 'text-foreground' : 'text-muted-foreground',
            )}>
              {tab.label}
            </span>
          </button>
        ))}
      </div>

      {/* 测试结果提示 */}
      {testResult && (
        <div className={cn(
          'flex items-center gap-2 rounded-lg border px-3 py-2 text-xs',
          testResult.success
            ? 'bg-success-soft/30 border-success/20'
            : 'bg-destructive/5 border-destructive/20',
        )}>
          {testResult.success ? (
            <CheckCircle2 className="h-4 w-4 text-success" />
          ) : (
            <XCircle className="h-4 w-4 text-destructive" />
          )}
          <span className={cn('font-semibold', testResult.success ? 'text-success' : 'text-destructive')}>
            {testResult.service}{' '}
            {testResult.success ? '连接成功' : `连接失败${testResult.message ? `：${testResult.message}` : ''}`}
          </span>
        </div>
      )}

      <div className="space-y-4">
        {activeInnerTab === 'model' && (
          <InboxAiModelCard
            providers={providers}
            providerId={workflowProviderDraft}
            onProviderChange={setWorkflowProviderDraft}
          />
        )}

        {activeInnerTab === 'bookmarks' && (
          <BookmarkSettingsCard
            settings={settings}
            draft={draft}
            onDraftChange={updateDraft}
          />
        )}

        {activeInnerTab === 'paperless' && (
          <PaperlessSettingsCard
            settings={settings}
            draft={draft}
            tokenDraftState={tokenDraftState}
            onDraftChange={updateDraft}
            onTest={onTestPaperless}
            isTesting={isTesting}
          />
        )}

        {activeInnerTab === 'obsidian' && (
          <ObsidianSettingsCard
            draft={draft}
            onDraftChange={updateDraft}
            onTest={onTestObsidian}
            isTesting={isTesting}
          />
        )}
      </div>

      <div className="sticky bottom-3 z-10 flex items-center gap-2 rounded-lg border bg-card/95 p-3 shadow-[var(--shadow-sm)] backdrop-blur">
        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty || saving}
          className="nexus-button-primary px-4 text-xs disabled:opacity-50"
        >
          {saving ? '保存中…' : '保存设置'}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={!dirty || saving}
          className="nexus-button-utility px-4 text-xs disabled:opacity-50"
        >
          取消更改
        </button>
        {(updateError || workflowUpdateError) && (
          <span className="flex items-center gap-1 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5" /> 保存失败
          </span>
        )}
      </div>
    </div>
  )
}

function createDraft(settings: InboxSettings): InboxSettingsUpdateRequest {
  return {
    paperlessEnabled: settings.paperlessEnabled,
    paperlessBaseUrl: settings.paperlessBaseUrl || '',
    paperlessOpenInNewTab: settings.paperlessOpenInNewTab,
    paperlessDefaultUploadTags: settings.paperlessDefaultUploadTags || '',
    obsidianEnabled: settings.obsidianEnabled,
    obsidianVaultPath: settings.obsidianVaultPath || '',
    obsidianInboxDir: settings.obsidianInboxDir || 'Inbox',
    bookmarksAiAssistEnabled: settings.bookmarksAiAssistEnabled,
    bookmarksBulkImportEnabled: settings.bookmarksBulkImportEnabled,
    bookmarksStripTrackingParams: settings.bookmarksStripTrackingParams,
    bookmarksDefaultUnread: settings.bookmarksDefaultUnread,
    bookmarksSmartGroupsEnabled: settings.bookmarksSmartGroupsEnabled,
  }
}

/* ======================== BookmarkSettingsCard ======================== */

type InboxAiModelCardProps = {
  providers: LlmProvider[]
  providerId: string
  onProviderChange: (providerId: string) => void
}

// Inbox AI 模型卡片：统一控制书签分析、笔记建议和整合等 Inbox AI 能力的模型来源。
function InboxAiModelCard({ providers, providerId, onProviderChange }: InboxAiModelCardProps) {
  return (
    <div className="space-y-4 rounded-lg border bg-card p-4 shadow-[var(--shadow-xs)]">
      <div>
        <h3 className="text-sm font-extrabold text-foreground">专用模型</h3>
      </div>
      <WorkflowModelSelect
        providers={providers}
        value={providerId}
        onChange={onProviderChange}
      />
      {providers.length === 0 && (
        <p className="text-xs text-muted-foreground">添加模型后可指定专用模型。</p>
      )}
    </div>
  )
}

type BookmarkSettingsCardProps = {
  settings: InboxSettings
  draft: InboxSettingsUpdateRequest
  onDraftChange: (update: InboxSettingsUpdateRequest) => void
}

// 书签设置卡片：AI 辅助 / 批量导入 / 追踪参数剥离 / 默认未读 / 智能分组。
function BookmarkSettingsCard({ settings, draft, onDraftChange }: BookmarkSettingsCardProps) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-[var(--shadow-xs)] space-y-4">
      <div>
        <h3 className="text-sm font-extrabold text-foreground">书签设置</h3>
      </div>

      <div className="space-y-3">
        <ToggleRow
          label="AI 辅助分析"
          description="启用后保存书签时自动调用 AI 解析标题、标签和分组建议"
          enabled={Boolean(draft.bookmarksAiAssistEnabled)}
          onChange={(v) => onDraftChange({ bookmarksAiAssistEnabled: v })}
          statusIndicator={!settings.inboxAiAvailable ? 'AI 服务不可用' : undefined}
        />

        <ToggleRow
          label="批量导入"
          description="允许粘贴 YAML/JSON 格式批量导入书签"
          enabled={Boolean(draft.bookmarksBulkImportEnabled)}
          onChange={(v) => onDraftChange({ bookmarksBulkImportEnabled: v })}
        />

        <ToggleRow
          label="剥离追踪参数"
          description="自动移除 URL 中的 utm_source、fbclid 等追踪参数"
          enabled={Boolean(draft.bookmarksStripTrackingParams)}
          onChange={(v) => onDraftChange({ bookmarksStripTrackingParams: v })}
        />

        <ToggleRow
          label="默认标记为未读"
          description="新保存的书签默认标记为未读状态"
          enabled={Boolean(draft.bookmarksDefaultUnread)}
          onChange={(v) => onDraftChange({ bookmarksDefaultUnread: v })}
        />

        <ToggleRow
          label="智能分组"
          description="启用 AI 自动分析书签并匹配到已有分组"
          enabled={Boolean(draft.bookmarksSmartGroupsEnabled)}
          onChange={(v) => onDraftChange({ bookmarksSmartGroupsEnabled: v })}
        />
      </div>
    </div>
  )
}

/* ======================== PaperlessSettingsCard ======================== */

type PaperlessSettingsCardProps = {
  settings: InboxSettings
  draft: InboxSettingsUpdateRequest
  tokenDraftState: 'unchanged' | 'replace' | 'clear'
  onDraftChange: (update: InboxSettingsUpdateRequest) => void
  onTest?: () => void
  isTesting?: boolean
}

// 文档 Paperless 设置卡片：启用开关 / Base URL / API Token / 新标签页打开 / 默认标签 / 测试连接。
function PaperlessSettingsCard({ settings, draft, tokenDraftState, onDraftChange, onTest, isTesting }: PaperlessSettingsCardProps) {
  const [tokenValue, setTokenValue] = useState('')
  const [showReplace, setShowReplace] = useState(false)

  const handleSetToken = () => {
    if (tokenValue.trim()) {
      onDraftChange({ paperlessApiToken: tokenValue.trim() })
      setTokenValue('')
      setShowReplace(false)
    }
  }

  const handleClearToken = () => {
    onDraftChange({ paperlessApiToken: null })
  }

  const tokenConfigured = tokenDraftState === 'clear'
    ? false
    : settings.paperlessTokenConfigured || tokenDraftState === 'replace'

  return (
    <div className="rounded-lg border bg-card p-4 shadow-[var(--shadow-xs)] space-y-4">
      <div>
        <h3 className="text-sm font-extrabold text-foreground">文档设置</h3>
      </div>

      <div className="space-y-3">
        <ToggleRow
          label="启用 Paperless"
          description="在 Inbox 中显示 paperless 文档管理和上传功能"
          enabled={Boolean(draft.paperlessEnabled)}
          onChange={(v) => onDraftChange({ paperlessEnabled: v })}
        />

        {/* Base URL */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-foreground">Base URL</label>
          <input
            value={draft.paperlessBaseUrl || ''}
            onChange={(e) => onDraftChange({ paperlessBaseUrl: e.target.value })}
            placeholder="https://paperless.example.com"
            className="nexus-input w-full px-3 py-1.5 text-sm"
          />
        </div>

        {/* API Token */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-foreground">API Token</label>
          {tokenConfigured ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-success font-medium">
                  {tokenDraftState === 'replace' ? '新 token 待保存' : '已保存 token'}
                </span>
                <button
                  type="button"
                  onClick={() => setShowReplace(!showReplace)}
                  className="text-xs text-primary hover:underline"
                >
                  替换 token
                </button>
                {settings.paperlessTokenConfigured && (
                  <button
                    type="button"
                    onClick={handleClearToken}
                    className="text-xs text-destructive hover:underline"
                  >
                    清除 token
                  </button>
                )}
              </div>
              {showReplace && (
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    value={tokenValue}
                    onChange={(e) => setTokenValue(e.target.value)}
                    placeholder="输入新 token"
                    className="nexus-input flex-1 px-3 py-1.5 text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleSetToken}
                    disabled={!tokenValue.trim()}
                    className="nexus-button-primary px-3 py-1.5 text-xs"
                  >
                    暂存
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowReplace(false); setTokenValue('') }}
                    className="nexus-button-utility px-3 py-1.5 text-xs"
                  >
                    取消
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="password"
                value={tokenValue}
                onChange={(e) => setTokenValue(e.target.value)}
                placeholder="输入 API token"
                className="nexus-input flex-1 px-3 py-1.5 text-sm"
              />
              <button
                type="button"
                onClick={handleSetToken}
                disabled={!tokenValue.trim()}
                className="nexus-button-primary px-3 py-1.5 text-xs"
              >
                暂存
              </button>
            </div>
          )}
        </div>

        {/* Open in New Tab */}
        <ToggleRow
          label="在新标签页打开"
          description="paperless 入口链接在新标签页中打开"
          enabled={Boolean(draft.paperlessOpenInNewTab)}
          onChange={(v) => onDraftChange({ paperlessOpenInNewTab: v })}
        />

        {/* Default Upload Tags */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-foreground">默认上传标签</label>
          <input
            value={draft.paperlessDefaultUploadTags || ''}
            onChange={(e) => onDraftChange({ paperlessDefaultUploadTags: e.target.value })}
            placeholder="逗号分隔，如：inbox,待处理"
            className="nexus-input w-full px-3 py-1.5 text-sm"
          />
          <p className="text-[10px] text-muted-foreground">上传文档时自动添加的标签</p>
        </div>

        {/* 测试连接 */}
        {onTest && (
          <div>
            <button
              type="button"
              onClick={onTest}
              disabled={isTesting}
              className="nexus-button-utility flex items-center gap-1.5 px-3 py-1.5 text-xs"
            >
              {isTesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              测试连接
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ======================== ObsidianSettingsCard ======================== */

type ObsidianSettingsCardProps = {
  draft: InboxSettingsUpdateRequest
  onDraftChange: (update: InboxSettingsUpdateRequest) => void
  onTest?: () => void
  isTesting?: boolean
}

// 笔记 Obsidian 设置卡片：用户只配置 Vault 和 Inbox 根目录，子目录由系统固定派生。
function ObsidianSettingsCard({ draft, onDraftChange, onTest, isTesting }: ObsidianSettingsCardProps) {
  const inboxRoot = draft.obsidianInboxDir || 'Inbox'
  const derivedDirs = [
    `${inboxRoot}/Quick Note`,
    `${inboxRoot}/Memo`,
    `${inboxRoot}/Consolidated`,
  ]

  return (
    <div className="rounded-lg border bg-card p-4 shadow-[var(--shadow-xs)] space-y-4">
      <div>
        <h3 className="text-sm font-extrabold text-foreground">笔记设置</h3>
      </div>

      <div className="space-y-3">
        <ToggleRow
          label="启用 Obsidian"
          description="在 Inbox 中显示 Quick Note / Memo 编辑器和保存功能"
          enabled={Boolean(draft.obsidianEnabled)}
          onChange={(v) => onDraftChange({ obsidianEnabled: v })}
        />

        {/* Vault 路径 */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-foreground">Vault 路径</label>
          <input
            value={draft.obsidianVaultPath || ''}
            onChange={(e) => onDraftChange({ obsidianVaultPath: e.target.value })}
            placeholder="/Users/xxx/Obsidian/Vault"
            className="nexus-input w-full px-3 py-1.5 text-sm"
          />
          <p className="text-[10px] text-muted-foreground">Obsidian vault 在文件系统中的绝对路径</p>
        </div>

        {/* Inbox Root Dir */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-foreground">Inbox 相对路径</label>
          <input
            value={draft.obsidianInboxDir || ''}
            onChange={(e) => onDraftChange({ obsidianInboxDir: e.target.value })}
            placeholder='Inbox'
            className="nexus-input w-full px-3 py-1.5 text-sm"
          />
          <p className="text-[10px] text-muted-foreground">相对于 Vault 根目录；修改后旧文件不会自动迁移</p>
        </div>

        <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
          <p className="text-xs font-semibold text-foreground">系统目录</p>
          <div className="space-y-1">
            {derivedDirs.map((dir) => (
              <p key={dir} className="font-mono text-xs text-muted-foreground">{dir}</p>
            ))}
          </div>
        </div>

        {/* 测试连接 */}
        {onTest && (
          <div>
            <button
              type="button"
              onClick={onTest}
              disabled={isTesting}
              className="nexus-button-utility flex items-center gap-1.5 px-3 py-1.5 text-xs"
            >
              {isTesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              测试连接
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ======================== 共享组件 ======================== */

/** 开关行：标签 + 描述 + toggle */
function ToggleRow({
  label,
  description,
  enabled,
  onChange,
  statusIndicator,
}: {
  label: string
  description?: string
  enabled: boolean
  onChange: (v: boolean) => void
  statusIndicator?: string
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground">{label}</span>
          {statusIndicator && (
            <span className="inline-flex items-center gap-1 rounded bg-yellow-500/10 px-1.5 py-0.5 text-[10px] text-yellow-600">
              <AlertCircle className="h-2.5 w-2.5" />
              {statusIndicator}
            </span>
          )}
        </div>
        {description && (
          <p className="mt-0.5 text-[11px] text-muted-foreground">{description}</p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={() => onChange(!enabled)}
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          enabled ? 'bg-primary' : 'bg-muted-foreground/30',
        )}
      >
        <span
          className={cn(
            'inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform',
            enabled ? 'translate-x-[18px]' : 'translate-x-[3px]',
          )}
        />
      </button>
    </div>
  )
}
