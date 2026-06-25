import type { LlmProvider, InboxSettings, InboxSettingsUpdateRequest, SubscriptionCategory, MindBankSettings, MindBankSettingsUpdateRequest } from '../../types/domain.types'
import { ProviderCard } from './components/ProviderCard'
import { ProviderForm, type ProviderFormData } from './components/ProviderForm'
import { TranslateSettingsPanel } from './components/TranslateSettingsPanel'
import { ChatModelPanel } from './components/ChatModelPanel'
import { SubscriptionModelPanel } from './components/SubscriptionModelPanel'

import { InboxSettingsPanel } from './components/InboxSettingsPanel'
import { SubscriptionCategoriesPanel } from './components/SubscriptionCategoriesPanel'
import { SubscriptionNotificationSettingsPanel } from './components/SubscriptionNotificationSettingsPanel'
import { MindBankSettingsPanel } from './components/MindBankSettingsPanel'
import { CrawlSettingsPanel } from './components/CrawlSettingsPanel'
import { NotesSettingsPanel } from './components/NotesSettingsPanel'
import { AlertCircle } from 'lucide-react'
import { cn } from '../../lib/utils'
import { PageHeader, PageShell } from '../../components/shell'

export type SettingsTab = 'models' | 'translate' | 'inbox' | 'subscriptions' | 'chat' | 'crawl' | 'notes' | 'mindbank'

export type SettingsViewProps = {
  activeSettingsTab: SettingsTab
  onSettingsTabChange: (tab: SettingsTab) => void
  providers: LlmProvider[]
  defaultProvider: LlmProvider | undefined
  translateSettings: {
    providerId: string
    dirty: boolean
    savePending: boolean
    saveError: boolean
    onProviderChange: (providerId: string) => void
    onSave: () => void
    onCancel: () => void
  }
  subscriptionsSettings: {
    providerId: string
    dirty: boolean
    savePending: boolean
    saveError: boolean
    onProviderChange: (providerId: string) => void
    onSave: () => void
    onCancel: () => void
  }
  chatSettings: {
    providerId: string
    dirty: boolean
    savePending: boolean
    saveError: boolean
    onProviderChange: (providerId: string) => void
    onSave: () => void
    onCancel: () => void
  }

  providersLoading: boolean
  providersError: boolean
  workflowsLoading: boolean
  workflowsError: boolean

  // Provider 表单状态
  editingId: string | null
  editForm: ProviderFormData
  onStartCreate: () => void
  onStartEdit: (provider: LlmProvider) => void
  onCancelEdit: () => void
  onEditFormChange: (form: ProviderFormData) => void

  // Provider mutations
  createPending: boolean
  createError: boolean
  updatePending: boolean
  updateError: boolean
  setDefaultPendingId: string | null
  deletePendingId: string | null
  onCreateSubmit: () => void
  onUpdateSubmit: () => void
  onSetDefault: (id: string) => void
  onDelete: (id: string) => void

  // Inbox settings
  inboxSettings: {
    settings: InboxSettings
    isLoading: boolean
    isUpdating: boolean
    updateError: boolean
    workflowProviderId: string
    isWorkflowUpdating: boolean
    workflowUpdateError: boolean
    onUpdate: (update: InboxSettingsUpdateRequest) => void
    onWorkflowProviderSave: (providerId: string) => void
  }

  subscriptionCategories: {
    categories: SubscriptionCategory[]
    isLoading: boolean
    isCreating: boolean
    isDeleting: string | null
    onCreate: (name: string) => void
    onDelete: (id: string) => void
  }

  // Mindbank 设置
  mindbankSettings: {
    settings: MindBankSettings
    isLoading: boolean
    isUpdating: boolean
    updateError: boolean
    onUpdate: (update: MindBankSettingsUpdateRequest) => void
  }
}

// SettingsDesktopView 按连续面板结构组织模型工作台，桌面端使用更宽松的分区间距。
export function SettingsDesktopView(props: SettingsViewProps) {
  const {
    activeSettingsTab, onSettingsTabChange,
    providers, defaultProvider,
    providersLoading, providersError, workflowsLoading, workflowsError,
    editingId, editForm,
    onStartCreate, onStartEdit, onCancelEdit, onEditFormChange,
    createPending, createError, updatePending, updateError,
    setDefaultPendingId, deletePendingId,
    onCreateSubmit, onUpdateSubmit, onSetDefault, onDelete,
    inboxSettings, subscriptionCategories, mindbankSettings,
    translateSettings, subscriptionsSettings, chatSettings,
  } = props

  const isEditing = editingId !== null
  const tabs: { key: SettingsTab; label: string }[] = [
    { key: 'models', label: '模型' },
    { key: 'translate', label: 'Translate' },
    { key: 'inbox', label: 'Inbox' },
    { key: 'subscriptions', label: 'Panel Hub' },
    { key: 'chat', label: 'Chat' },
    { key: 'crawl', label: 'Crawl' },
    { key: 'notes', label: 'Notes' },
    { key: 'mindbank', label: 'Mindbank' },
  ]

  return (
    <div className="hidden md:block">
      <PageShell variant="full" header={<PageHeader eyebrow="SYSTEM" title="Settings" />}>
      <div className="grid items-start gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="nexus-surface sticky top-4 space-y-1 p-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => onSettingsTabChange(tab.key)}
              className={cn(
                'flex h-10 w-full items-center rounded-md px-3 text-left text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                activeSettingsTab === tab.key
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              {tab.label}
            </button>
          ))}
        </aside>

        <div className="min-w-0 space-y-4">
          {activeSettingsTab === 'models' && (
          <>
          {/* 默认模型面板 */}
          <section className="nexus-surface space-y-4 p-4">
            <h2 className="text-lg font-extrabold text-foreground">默认模型</h2>
            {defaultProvider ? (
              <div className="rounded-xl border border-primary/15 bg-primary/[0.03] px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-foreground">{defaultProvider.name}</span>
                  <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-black text-primary-foreground">全局默认</span>
                  <span className={defaultProvider.enabled ? 'text-xs text-success font-bold' : 'text-xs text-muted-foreground font-bold'}>
                    · {defaultProvider.enabled ? '启用' : '禁用'}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {defaultProvider.provider} · {defaultProvider.model || '未指定模型'}
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-destructive/30 bg-destructive-soft p-4">
                <p className="flex items-center gap-2 text-sm font-bold text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  尚未设置默认模型
                </p>
                <p className="mt-1 text-xs leading-6 text-destructive/80">
                  请先添加模型并设为默认。
                </p>
              </div>
            )}
          </section>

          {/* 模型列表面板：每张卡片展示名称、类型、模型、状态和关键操作 */}
          <section className="nexus-surface space-y-4 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-extrabold text-foreground">模型列表</h2>
              </div>
              {!isEditing && (
                <button
                  type="button"
                  onClick={onStartCreate}
                  className="nexus-button-primary inline-flex items-center gap-1.5 px-4 py-2 text-xs"
                >
                  添加模型
                </button>
              )}
            </div>

            {/* 内联表单：创建或编辑模式时嵌入列表上方 */}
            {isEditing && (
              <ProviderForm
                form={editForm}
                mode={editingId === 'new' ? 'create' : 'edit'}
                pending={editingId === 'new' ? createPending : updatePending}
                error={editingId === 'new' ? createError : updateError}
                onChange={onEditFormChange}
                onSubmit={editingId === 'new' ? onCreateSubmit : onUpdateSubmit}
                onCancel={onCancelEdit}
              />
            )}

            {providersLoading && (
              <p className="py-4 text-center text-sm text-muted-foreground">加载中…</p>
            )}
            {providersError && (
              <p className="flex items-center gap-1.5 py-4 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" /> 加载模型失败，请刷新重试
              </p>
            )}
            {!providersLoading && !providersError && (
              <ul className="space-y-2">
                {providers.map((p) => (
                  <li key={p.id}>
                    <ProviderCard
                      provider={p}
                      isDefault={p.defaultProvider}
                      setDefaultPending={setDefaultPendingId === p.id}
                      deletePending={deletePendingId === p.id}
                      onEdit={() => onStartEdit(p)}
                      onSetDefault={() => onSetDefault(p.id)}
                      onDelete={() => onDelete(p.id)}
                    />
                  </li>
                ))}
                {providers.length === 0 && !isEditing && (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    尚未配置模型
                  </p>
                )}
              </ul>
            )}
          </section>
          </>
          )}

          {activeSettingsTab === 'translate' && (
            <TranslateSettingsPanel
              providers={providers}
              providerId={translateSettings.providerId}
              dirty={translateSettings.dirty}
              workflowsLoading={workflowsLoading}
              workflowsError={workflowsError}
              savePending={translateSettings.savePending}
              saveError={translateSettings.saveError}
              onProviderChange={translateSettings.onProviderChange}
              onSave={translateSettings.onSave}
              onCancel={translateSettings.onCancel}
            />
          )}

          {activeSettingsTab === 'inbox' && !inboxSettings.isLoading && (
            <section className="nexus-surface space-y-4 p-4">
              <InboxSettingsPanel
                settings={inboxSettings.settings}
                providers={providers}
                workflowProviderId={inboxSettings.workflowProviderId}
                onUpdate={inboxSettings.onUpdate}
                onWorkflowProviderSave={inboxSettings.onWorkflowProviderSave}
                isUpdating={inboxSettings.isUpdating}
                isWorkflowUpdating={inboxSettings.isWorkflowUpdating}
                updateError={inboxSettings.updateError}
                workflowUpdateError={inboxSettings.workflowUpdateError}
              />
            </section>
          )}

          {activeSettingsTab === 'subscriptions' && (
            <section className="space-y-4">
              <SubscriptionModelPanel
                providers={providers}
                providerId={subscriptionsSettings.providerId}
                dirty={subscriptionsSettings.dirty}
                workflowsLoading={workflowsLoading}
                workflowsError={workflowsError}
                savePending={subscriptionsSettings.savePending}
                saveError={subscriptionsSettings.saveError}
                onProviderChange={subscriptionsSettings.onProviderChange}
                onSave={subscriptionsSettings.onSave}
                onCancel={subscriptionsSettings.onCancel}
              />
              <SubscriptionNotificationSettingsPanel />
              <section className="nexus-surface space-y-4 p-4">
                <SubscriptionCategoriesPanel
                  categories={subscriptionCategories.categories}
                  isLoading={subscriptionCategories.isLoading}
                  onCreate={subscriptionCategories.onCreate}
                  onDelete={subscriptionCategories.onDelete}
                  isCreating={subscriptionCategories.isCreating}
                  isDeleting={subscriptionCategories.isDeleting}
                />
              </section>
            </section>
          )}

          {activeSettingsTab === 'chat' && (
            <ChatModelPanel
              providers={providers}
              providerId={chatSettings.providerId}
              dirty={chatSettings.dirty}
              workflowsLoading={workflowsLoading}
              workflowsError={workflowsError}
              savePending={chatSettings.savePending}
              saveError={chatSettings.saveError}
              onProviderChange={chatSettings.onProviderChange}
              onSave={chatSettings.onSave}
              onCancel={chatSettings.onCancel}
            />
          )}

          {activeSettingsTab === 'crawl' && (
            <CrawlSettingsPanel />
          )}

          {activeSettingsTab === 'notes' && (
            <NotesSettingsPanel />
          )}

          {activeSettingsTab === 'mindbank' && !mindbankSettings.isLoading && (
            <MindBankSettingsPanel
              settings={mindbankSettings.settings}
              providers={providers}
              isLoading={mindbankSettings.isLoading}
              isUpdating={mindbankSettings.isUpdating}
              updateError={mindbankSettings.updateError}
              onUpdate={mindbankSettings.onUpdate}
            />
          )}
        </div>
      </div>
      </PageShell>
    </div>
  )
}
