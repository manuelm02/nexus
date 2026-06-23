import { useState } from 'react'
import { Plus } from 'lucide-react'
import type { ApiKey, Credential, Subscription, SubscriptionStats } from '../../types/domain.types'
import type { SubscriptionFilter, SubscriptionView } from './panelhub.shared'
import { PanelHubDashboard } from './components/PanelHubDashboard'
import { SubscriptionCard } from './components/SubscriptionCard'
import { PanelHubViewTabs } from './components/PanelHubViewTabs'
import { ApiKeyTabView } from './apikeys/ApiKeyTabView'
import { ApiKeyCard } from './apikeys/ApiKeyCard'
import { CredentialTabView } from './credentials/CredentialTabView'
import { CredentialCard } from './credentials/CredentialCard'

type PanelHubMobileViewProps = {
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
  apiKeySyncingId: string | null
  apiKeyCreating: boolean
  onCreateApiKey: (data: Parameters<typeof import('../../api/apiKey.api').apiKeyApi.create>[0]) => void
  onUpdateApiKey: (id: string, data: Record<string, unknown>) => void
  onDeleteApiKey: (id: string) => void
  onRechargeApiKey: (id: string, data: { amount: number; date?: string; note?: string }) => void
  onConsumeApiKey: (id: string, data: { amount: number; note?: string }) => void
  onSyncApiKeyBalance: (id: string) => void
  onUnarchiveApiKey: (id: string) => void

  // Credential 数据与操作
  credentials: Credential[]
  credentialCreating: boolean
  onCreateCredential: (data: Parameters<typeof import('../../api/credential.api').credentialApi.create>[0]) => void
  onUpdateCredential: (id: string, data: Record<string, unknown>) => void
  onDeleteCredential: (id: string) => void
  onUnarchiveCredential: (id: string) => void
}

/** Panel Hub 移动端视图：5 个 Tab（概览/订阅/API Keys/凭据/已归档），全部数据和操作由 index.tsx 通过 props 注入 */
export function PanelHubMobileView(props: PanelHubMobileViewProps) {
  const { view } = props
  const [apiKeyCreateRequestKey, setApiKeyCreateRequestKey] = useState(0)
  const [credentialCreateRequestKey, setCredentialCreateRequestKey] = useState(0)
  const showAddButton = view === 'subscriptions' || view === 'apikeys' || view === 'credentials'

  const archivedApiKeys = props.apiKeys.filter((k) => k.archived)
  const archivedCredentials = props.credentials.filter((c) => c.archived)

  return (
    <div className="space-y-4 p-4 md:hidden">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-black">Panel Hub</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">密钥和凭证，一处掌控。</p>
        </div>
        {showAddButton && (
          <button type="button"
            onClick={() => {
              if (view === 'subscriptions') props.onCreateClick()
              else if (view === 'apikeys') setApiKeyCreateRequestKey((key) => key + 1)
              else if (view === 'credentials') setCredentialCreateRequestKey((key) => key + 1)
            }}
            className="nexus-button-primary h-10 w-10 p-0" aria-label="新增">
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>

      <PanelHubViewTabs view={view} archivedCount={props.archivedCount}
        apiKeyLowBalanceCount={props.apiKeyLowBalanceCount}
        credentialExpiringCount={props.credentialExpiringCount}
        onViewChange={props.onViewChange} />

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
          <section className="space-y-3">
            {props.subscriptionItems.map((item) => (
              <SubscriptionCard key={item.id} item={item} deleting={props.deletingId === item.id}
                onEdit={props.onEdit} onDelete={props.onDelete} />
            ))}
          </section>
        )
      )}

      {view === 'apikeys' && (
        <ApiKeyTabView
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
                <div className="space-y-3">
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
                <div className="space-y-3">
                  {archivedApiKeys.map((k) => (
                    <ApiKeyCard key={k.id} item={k} deleting={false} syncing={props.apiKeySyncingId === k.id}
                      onEdit={() => {}} onDelete={props.onDeleteApiKey}
                      onRecharge={(id, amount, note) => props.onRechargeApiKey(id, { amount, note })}
                      onConsume={(id, amount, note) => props.onConsumeApiKey(id, { amount, note })}
                      onSyncBalance={props.onSyncApiKeyBalance}
                      onUnarchive={props.onUnarchiveApiKey} />
                  ))}
                </div>
              </div>
            )}
            {archivedCredentials.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">凭据</h3>
                <div className="space-y-3">
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
    </div>
  )
}
