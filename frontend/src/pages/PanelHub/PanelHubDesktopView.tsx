import { useState } from 'react'
import { Plus } from 'lucide-react'
import { PageShell, PageHeader, Tabs } from '@/components/shell'
import type { ApiKey, Credential, Subscription, SubscriptionStats } from '../../types/domain.types'
import type { SubscriptionFilter, SubscriptionView } from './panelhub.shared'
import { PanelHubDashboard } from './components/PanelHubDashboard'
import { SubscriptionCard } from './components/SubscriptionCard'
import { ApiKeyTabView } from './apikeys/ApiKeyTabView'
import { PayAsYouGoCard } from './apikeys/PayAsYouGoCard'
import { PlanBasedCard } from './apikeys/PlanBasedCard'
import { CredentialTabView } from './credentials/CredentialTabView'
import { CredentialCard } from './credentials/CredentialCard'

type PanelHubDesktopViewProps = {
  view: SubscriptionView
  onViewChange: (view: SubscriptionView) => void
  stats: SubscriptionStats | null
  statsLoading: boolean
  expiringCount: number
  expiredCount: number
  filter: SubscriptionFilter
  onFilterChange: (filter: SubscriptionFilter) => void
  subscriptionItems: Subscription[]
  allSubscriptionItems: Subscription[]
  archivedSubscriptions: Subscription[]
  archivedCount: number
  deletingId: string | null
  isLoading: boolean
  apiKeyLowBalanceCount: number
  credentialExpiringCount: number
  onCreateClick: () => void
  onEdit: (item: Subscription) => void
  onUnarchive: (id: string) => void
  onDelete: (id: string) => void

  // API Key 数据与操作
  apiKeys: ApiKey[]
  apiKeysLoading: boolean
  apiKeySyncingId: string | null
  apiKeyCreating: boolean
  onCreateApiKey: (data: Parameters<typeof import('../../api/apiKey.api').apiKeyApi.create>[0]) => void
  onUpdateApiKey: (id: string, data: Record<string, unknown>) => void
  onDeleteApiKey: (id: string) => void
  onRechargeApiKey: (id: string, data: { amount: number; date?: string; note?: string }) => void
  onConsumeApiKey: (id: string, data: { amount: number; note?: string }) => void
  onSyncApiKeyBalance: (id: string) => void
  onUnarchiveApiKey: (id: string) => void

  // 账号数据与操作
  credentials: Credential[]
  credentialsLoading: boolean
  credentialCreating: boolean
  onCreateCredential: (data: Parameters<typeof import('../../api/credential.api').credentialApi.create>[0]) => void
  onUpdateCredential: (id: string, data: Record<string, unknown>) => void
  onDeleteCredential: (id: string) => void
  onUnarchiveCredential: (id: string) => void
}

/** Panel Hub 桌面端视图：5 个 Tab（概览/订阅/API Keys/账号/已归档），全部数据和操作由 index.tsx 通过 props 注入 */
export function PanelHubDesktopView(props: PanelHubDesktopViewProps) {
  const { view } = props
  const [apiKeyCreateRequestKey, setApiKeyCreateRequestKey] = useState(0)
  const [credentialCreateRequestKey, setCredentialCreateRequestKey] = useState(0)
  const showAddButton = view === 'subscriptions' || view === 'apikeys' || view === 'credentials'

  const archivedApiKeys = props.apiKeys.filter((k) => k.archived)
  const archivedCredentials = props.credentials.filter((c) => c.archived)

  const tabItems: { value: SubscriptionView; label: string; count?: number }[] = [
    { value: 'dashboard', label: '概览' },
    { value: 'subscriptions', label: '订阅' },
    { value: 'apikeys', label: 'API Keys', ...(props.apiKeyLowBalanceCount > 0 ? { count: props.apiKeyLowBalanceCount } : {}) },
    { value: 'credentials', label: '账号', ...(props.credentialExpiringCount > 0 ? { count: props.credentialExpiringCount } : {}) },
    { value: 'archived', label: '已归档', count: props.archivedCount },
  ]

  const actions = showAddButton ? (
    <button type="button"
      onClick={() => {
        if (view === 'subscriptions') props.onCreateClick()
        else if (view === 'apikeys') setApiKeyCreateRequestKey((key) => key + 1)
        else if (view === 'credentials') setCredentialCreateRequestKey((key) => key + 1)
      }}
      className="nexus-button-primary gap-1.5 px-4 text-sm">
      <Plus className="h-4 w-4" /> 新增
    </button>
  ) : undefined

  return (
    <div className="hidden md:block">
      <PageShell variant="full" header={
        <PageHeader eyebrow="CONTROL" title="Panel Hub" subtitle="订阅、密钥和账号，一处掌控。" actions={actions} />
      }>
        <Tabs variant="underline" value={view} onChange={props.onViewChange} items={tabItems} />

      {view === 'dashboard' && (
        <PanelHubDashboard stats={props.stats} statsLoading={props.statsLoading}
          expiringCount={props.expiringCount} expiredCount={props.expiredCount}
          filter={props.filter} subscriptionItems={props.allSubscriptionItems}
          onFilterChange={props.onFilterChange} apiKeys={props.apiKeys} credentials={props.credentials} />
      )}

      {view === 'subscriptions' && (
        props.isLoading ? (
          <section className="nexus-surface p-4 text-sm text-muted-foreground">加载中...</section>
        ) : props.subscriptionItems.length === 0 ? (
          <section className="nexus-surface p-8 text-center text-sm text-muted-foreground">暂无订阅记录</section>
        ) : (
          <section className="grid gap-3 lg:grid-cols-2">
            {props.subscriptionItems.map((item) => (
              <SubscriptionCard key={item.id} item={item} deleting={props.deletingId === item.id}
                onEdit={props.onEdit} onDelete={props.onDelete} />
            ))}
          </section>
        )
      )}

      {view === 'apikeys' && (
        <ApiKeyTabView
          isLoading={props.apiKeysLoading}
          createRequestKey={apiKeyCreateRequestKey}
          apiKeys={props.apiKeys}
          syncingId={props.apiKeySyncingId}
          creating={props.apiKeyCreating}
          onCreate={props.onCreateApiKey}
          onUpdate={props.onUpdateApiKey}
          onDelete={props.onDeleteApiKey}
          onRecharge={props.onRechargeApiKey}
          onConsume={props.onConsumeApiKey}
          onSyncBalance={props.onSyncApiKeyBalance}
        />
      )}

      {view === 'credentials' && (
        <CredentialTabView
          isLoading={props.credentialsLoading}
          createRequestKey={credentialCreateRequestKey}
          credentials={props.credentials}
          creating={props.credentialCreating}
          onCreate={props.onCreateCredential}
          onUpdate={props.onUpdateCredential}
          onDelete={props.onDeleteCredential}
        />
      )}

      {view === 'archived' && (
        props.isLoading ? (
          <section className="nexus-surface p-4 text-sm text-muted-foreground">加载中...</section>
        ) : (props.archivedSubscriptions.length === 0 && archivedApiKeys.length === 0 && archivedCredentials.length === 0) ? (
          <section className="nexus-surface p-8 text-center text-sm text-muted-foreground">暂无已归档项</section>
        ) : (
          <div className="space-y-5">
            {props.archivedSubscriptions.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">订阅</h3>
                <div className="grid gap-3 lg:grid-cols-2">
                  {props.archivedSubscriptions.map((item) => (
                    <SubscriptionCard key={item.id} item={item} deleting={props.deletingId === item.id}
                      onEdit={props.onEdit} onDelete={props.onDelete} onUnarchive={props.onUnarchive} />
                  ))}
                </div>
              </div>
            )}
            {archivedApiKeys.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">API Keys</h3>
                <div className="grid gap-3 lg:grid-cols-2">
                  {archivedApiKeys.map((k) => (
                    k.billingType === 'pay_as_you_go' ? (
                      <PayAsYouGoCard key={k.id} item={k} deleting={false} syncing={props.apiKeySyncingId === k.id}
                        onEdit={() => {}} onDelete={props.onDeleteApiKey}
                        onRecharge={(id, amount, note) => props.onRechargeApiKey(id, { amount, note })}
                        onSyncBalance={props.onSyncApiKeyBalance} />
                    ) : (
                      <PlanBasedCard key={k.id} item={k} deleting={false}
                        onEdit={() => {}} onDelete={props.onDeleteApiKey}
                        onUnarchive={props.onUnarchiveApiKey} />
                    )
                  ))}
                </div>
              </div>
            )}
            {archivedCredentials.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">账号</h3>
                <div className="grid gap-3 lg:grid-cols-2">
                  {archivedCredentials.map((c) => (
                    <CredentialCard key={c.id} item={c} deleting={false}
                      onEdit={() => {}} onDelete={props.onDeleteCredential}
                      onUnarchive={props.onUnarchiveCredential} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      )}
      </PageShell>
    </div>
  )
}
