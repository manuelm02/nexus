import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { subscriptionApi } from '../../api/subscription.api'
import { subscriptionCategoryApi } from '../../api/subscriptionCategory.api'
import type { Subscription } from '../../types/domain.types'
import { isExpired, isExpiringSoon, type SubscriptionFilter, type SubscriptionView } from './panelhub.shared'
import { PanelHubDesktopView } from './PanelHubDesktopView'
import { PanelHubMobileView } from './PanelHubMobileView'
import { SubscriptionFormDialog } from './components/SubscriptionFormDialog'
import type { SubscriptionPayload } from './components/SubscriptionFormFields'
import { useApiKeys } from './apikeys/useApiKeys'
import { useCredentials } from './credentials/useCredentials'

/** PanelHubPage 编排订阅、API Key、账号的全部数据查询和操作，桌面/移动视图共享 */
export default function PanelHubPage() {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<SubscriptionFilter>('all')
  const [view, setView] = useState<SubscriptionView>('dashboard')
  const [formOpen, setFormOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Subscription | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: () => subscriptionApi.list(),
  })

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['subscription-stats'],
    queryFn: () => subscriptionApi.stats(),
  })

  const { data: categoriesData } = useQuery({
    queryKey: ['subscription-categories'],
    queryFn: () => subscriptionCategoryApi.list(),
  })

  // API Keys 和账号完整 Hook：index.tsx 是唯一数据源，Desktop/Mobile 通过 props 接收全部数据和操作
  const apiKeyHook = useApiKeys()
  const credentialHook = useCredentials()
  const { apiKeys, isLoading: apiKeysLoading } = apiKeyHook
  const { credentials, isLoading: credentialsLoading } = credentialHook

  const items: Subscription[] = useMemo(() => data?.data?.data ?? [], [data])
  const stats = statsData?.data?.data ?? null
  const categories = useMemo(() => categoriesData?.data?.data ?? [], [categoriesData])
  const categoryNames = useMemo(() => categories.map((c) => c.name), [categories])

  const nonArchivedItems = useMemo(() => items.filter((i) => !i.archived), [items])
  const subscriptionItems = useMemo(() => nonArchivedItems.filter((i) => i.billingType !== 'per_token'), [nonArchivedItems])
  const archivedSubscriptions = useMemo(() => items.filter((i) => i.archived && i.billingType !== 'per_token'), [items])
  const expiringSoonItems = useMemo(() => subscriptionItems.filter(isExpiringSoon), [subscriptionItems])
  const expiredItems = useMemo(() => subscriptionItems.filter(isExpired), [subscriptionItems])

  // 归档总数（三种类型之和）
  const archivedCount = archivedSubscriptions.length + apiKeys.filter((k) => k.archived).length + credentials.filter((c) => c.archived).length

  // Badge 计数
  const apiKeyLowBalanceCount = (apiKeys ?? []).filter((k) =>
    !k.archived && k.lowBalanceNotify && k.remainingBalance != null &&
    k.lowBalanceThreshold != null && k.remainingBalance < k.lowBalanceThreshold
  ).length

  const credentialExpiringCount = (credentials ?? []).filter((c) => {
    if (c.archived || !c.expireDate) return false
    const expire = new Date(c.expireDate)
    const threshold = new Date()
    threshold.setDate(threshold.getDate() + 30)
    return expire <= threshold
  }).length

  const filteredSubscriptionItems = useMemo(() => {
    if (filter === 'expiring') return expiringSoonItems
    if (filter === 'expired') return expiredItems
    return subscriptionItems
  }, [expiredItems, expiringSoonItems, filter, subscriptionItems])

  const closeForm = () => {
    setFormOpen(false)
    setEditingItem(null)
  }

  const createMutation = useMutation({
    mutationFn: (payload: SubscriptionPayload) => subscriptionApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
      queryClient.invalidateQueries({ queryKey: ['subscription-stats'] })
      closeForm()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: SubscriptionPayload }) => subscriptionApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
      queryClient.invalidateQueries({ queryKey: ['subscription-stats'] })
      closeForm()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => subscriptionApi.delete(id),
    onMutate: (id) => setDeletingId(id),
    onSettled: () => setDeletingId(null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
      queryClient.invalidateQueries({ queryKey: ['subscription-stats'] })
    },
  })

  const suggestCategoryMutation = useMutation({
    mutationFn: ({ name, notes }: { name: string; notes?: string }) =>
      subscriptionApi.suggestCategory({ name, notes }),
    onSuccess: (res) => {
      if (res.data?.data?.isNew) {
        queryClient.invalidateQueries({ queryKey: ['subscription-categories'] })
      }
    },
  })

  const handleCreateClick = () => {
    setEditingItem(null)
    setFormOpen(true)
  }

  const handleEdit = (item: Subscription) => {
    setEditingItem(item)
    setFormOpen(true)
  }

  const handleSubmit = (payload: SubscriptionPayload, id?: string) => {
    if (id) updateMutation.mutate({ id, payload })
    else createMutation.mutate(payload)
  }

  const handleUnarchive = (id: string) => {
    updateMutation.mutate({ id, payload: { archived: false } })
  }

  const handleFilterChange = (next: SubscriptionFilter) => {
    setFilter(next)
    setView('subscriptions')
  }

  // 取消归档操作：由 index.tsx 统一管理，Desktop/Mobile 通过 props 调用
  const handleUnarchiveApiKey = (id: string) => apiKeyHook.update(id, { archived: false })
  const handleUnarchiveCredential = (id: string) => credentialHook.update(id, { archived: false })

  const handleAiSuggestCategory = async (name: string, notes?: string): Promise<string | undefined> => {
    try {
      const res = await suggestCategoryMutation.mutateAsync({ name, notes })
      return res.data?.data?.category
    } catch {
      return undefined
    }
  }

  const sharedProps = {
    view,
    onViewChange: setView,
    stats,
    statsLoading,
    expiringCount: expiringSoonItems.length,
    expiredCount: expiredItems.length,
    filter,
    onFilterChange: handleFilterChange,
    subscriptionItems: filteredSubscriptionItems,
    allSubscriptionItems: subscriptionItems,
    archivedSubscriptions,
    archivedCount,
    deletingId,
    isLoading,
    apiKeyLowBalanceCount,
    credentialExpiringCount,
    onCreateClick: handleCreateClick,
    onEdit: handleEdit,
    onUnarchive: handleUnarchive,
    onDelete: (id: string) => deleteMutation.mutate(id),

    // API Key 数据与操作（F2：统一提升到 index.tsx，避免 Desktop/Mobile 重复调用 Hook）
    apiKeys: apiKeyHook.apiKeys,
    apiKeysLoading,
    apiKeySyncingId: apiKeyHook.syncingId,
    apiKeyCreating: apiKeyHook.creating,
    onCreateApiKey: apiKeyHook.create,
    onUpdateApiKey: apiKeyHook.update,
    onDeleteApiKey: apiKeyHook.remove,
    onRechargeApiKey: apiKeyHook.recharge,
    onConsumeApiKey: apiKeyHook.consume,
    onSyncApiKeyBalance: apiKeyHook.syncBalance,
    onUnarchiveApiKey: handleUnarchiveApiKey,

    // 账号（Credential）数据与操作
    credentials: credentialHook.credentials,
    credentialsLoading,
    credentialCreating: credentialHook.creating,
    onCreateCredential: credentialHook.create,
    onUpdateCredential: credentialHook.update,
    onDeleteCredential: credentialHook.remove,
    onUnarchiveCredential: handleUnarchiveCredential,
  }

  return (
    <div className="nexus-page-enter p-4 md:p-0">
      <PanelHubDesktopView {...sharedProps} />
      <PanelHubMobileView {...sharedProps} />
      <SubscriptionFormDialog
        open={formOpen}
        item={editingItem}
        initialBillingType="monthly"
        saving={createMutation.isPending || updateMutation.isPending}
        categories={categoryNames}
        onAiSuggestCategory={handleAiSuggestCategory}
        isAiSuggesting={suggestCategoryMutation.isPending}
        onOpenChange={(open: boolean) => {
          if (!open) closeForm()
          else setFormOpen(true)
        }}
        onSubmit={handleSubmit}
      />
    </div>
  )
}
