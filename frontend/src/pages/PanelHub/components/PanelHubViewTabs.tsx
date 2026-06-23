import { cn } from '../../../lib/utils'
import type { SubscriptionView } from '../panelhub.shared'

type PanelHubViewTabsProps = {
  view: SubscriptionView
  archivedCount: number
  apiKeyLowBalanceCount?: number
  credentialExpiringCount?: number
  onViewChange: (view: SubscriptionView) => void
}

const TABS: { key: SubscriptionView; label: string }[] = [
  { key: 'dashboard',     label: '概览' },
  { key: 'subscriptions', label: '订阅' },
  { key: 'apikeys',       label: 'API Keys' },
  { key: 'credentials',   label: '凭据' },
  { key: 'archived',      label: '已归档' },
]

/** PanelHubViewTabs 顶部 5 个视图切换：概览 / 订阅 / API Keys / 凭据 / 已归档 */
export function PanelHubViewTabs({ view, archivedCount, apiKeyLowBalanceCount, credentialExpiringCount, onViewChange }: PanelHubViewTabsProps) {
  return (
    <div className="inline-flex max-w-full overflow-x-auto rounded-lg border bg-muted/40 p-1">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onViewChange(tab.key)}
          className={cn(
            'relative h-9 shrink-0 rounded-md px-4 text-xs font-bold transition-colors',
            view === tab.key ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {tab.key === 'archived' ? `已归档 ${archivedCount}` : tab.label}
          {tab.key === 'apikeys' && (apiKeyLowBalanceCount ?? 0) > 0 && (
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[hsl(var(--warning))]" />
          )}
          {tab.key === 'credentials' && (credentialExpiringCount ?? 0) > 0 && (
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[hsl(var(--warning))]" />
          )}
        </button>
      ))}
    </div>
  )
}
