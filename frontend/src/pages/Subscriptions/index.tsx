import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { subscriptionApi } from '../../api/subscription.api'
import { subscriptionCategoryApi } from '../../api/subscriptionCategory.api'
import type { Subscription } from '../../types/domain.types'
import { isExpired, isExpiringSoon, type SubscriptionFilter, type SubscriptionView } from './subscriptions.shared'
import { SubscriptionsDesktopView } from './SubscriptionsDesktopView'
import { SubscriptionsMobileView } from './SubscriptionsMobileView'
import { SubscriptionFormDialog } from './components/SubscriptionFormDialog'
import type { SubscriptionPayload } from './components/SubscriptionFormFields'

// SubscriptionsPage 编排订阅数据查询、mutation、筛选、统计和分类，桌面/移动视图共享状态；用量面板 Tab 自包含。
export default function SubscriptionsPage() {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<SubscriptionFilter>('all')
  const [view, setView] = useState<SubscriptionView>('dashboard')
  const [formOpen, setFormOpen] = useState(false)
  const [usageCreateOpen, setUsageCreateOpen] = useState(false)
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

  const items: Subscription[] = useMemo(() => data?.data?.data ?? [], [data])
  const stats = statsData?.data?.data ?? null
  const categories = useMemo(() => categoriesData?.data?.data ?? [], [categoriesData])
  const categoryNames = useMemo(() => categories.map((c) => c.name), [categories])

  const nonArchivedItems = useMemo(() => items.filter((i) => !i.archived), [items])
  const subscriptionItems = useMemo(() => nonArchivedItems.filter((i) => i.billingType !== 'per_token'), [nonArchivedItems])
  const archivedItems = useMemo(() => items.filter((i) => i.archived), [items])
  const archivedCount = archivedItems.length
  const expiringSoonItems = useMemo(() => subscriptionItems.filter(isExpiringSoon), [subscriptionItems])
  const expiredItems = useMemo(() => subscriptionItems.filter(isExpired), [subscriptionItems])

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

  const handleCreateUsageClick = () => {
    setUsageCreateOpen(true)
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
    usageCreateOpen,
    onUsageCreateOpenChange: setUsageCreateOpen,
    stats,
    statsLoading,
    expiringCount: expiringSoonItems.length,
    expiredCount: expiredItems.length,
    filter,
    onFilterChange: handleFilterChange,
    subscriptionItems: filteredSubscriptionItems,
    allSubscriptionItems: subscriptionItems,
    archivedItems,
    archivedCount,
    deletingId,
    isLoading,
    onCreateClick: handleCreateClick,
    onCreateUsageClick: handleCreateUsageClick,
    onEdit: handleEdit,
    onUnarchive: handleUnarchive,
    onDelete: (id: string) => deleteMutation.mutate(id),
    onAiSuggestCategory: handleAiSuggestCategory,
  }

  return (
    <>
      <SubscriptionsDesktopView {...sharedProps} />
      <SubscriptionsMobileView {...sharedProps} />
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
    </>
  )
}
