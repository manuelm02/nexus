import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { subscriptionApi } from '../../api/subscription.api'
import type { Subscription } from '../../types/domain.types'
import { groupMonthlyTotalsByCurrency, isExpired, isExpiringSoon, type SubscriptionFilter } from './subscriptions.shared'
import { SubscriptionsDesktopView } from './SubscriptionsDesktopView'
import { SubscriptionsMobileView } from './SubscriptionsMobileView'
import type { SubscriptionPayload } from './components/SubscriptionFormFields'

// SubscriptionsPage 编排订阅数据查询、mutation、筛选和桌面/移动视图共享状态。
export default function SubscriptionsPage() {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<SubscriptionFilter>('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Subscription | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [usageSavingId, setUsageSavingId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: () => subscriptionApi.list(),
  })

  const items: Subscription[] = data?.data?.data ?? []
  const monthlyTotals = useMemo(() => groupMonthlyTotalsByCurrency(items), [items])
  const expiringSoonItems = useMemo(() => items.filter(isExpiringSoon), [items])
  const expiredItems = useMemo(() => items.filter(isExpired), [items])
  const filteredItems = useMemo(() => {
    if (filter === 'expiring') return expiringSoonItems
    if (filter === 'expired') return expiredItems
    return items
  }, [expiredItems, expiringSoonItems, filter, items])

  const closeForm = () => {
    setFormOpen(false)
    setEditingItem(null)
  }

  const createMutation = useMutation({
    mutationFn: (payload: SubscriptionPayload) => subscriptionApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
      closeForm()
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: SubscriptionPayload }) => subscriptionApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
      closeForm()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => subscriptionApi.delete(id),
    onMutate: (id) => setDeletingId(id),
    onSettled: () => setDeletingId(null),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['subscriptions'] }),
  })

  const usageMutation = useMutation({
    mutationFn: ({ id, usageUsed }: { id: string; usageUsed: number }) => subscriptionApi.updateUsage(id, usageUsed),
    onMutate: ({ id }) => setUsageSavingId(id),
    onSettled: () => setUsageSavingId(null),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['subscriptions'] }),
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

  const sharedProps = {
    items: filteredItems,
    monthlyTotals,
    expiringCount: expiringSoonItems.length,
    expiredCount: expiredItems.length,
    filter,
    formOpen,
    editingItem,
    saving: createMutation.isPending || updateMutation.isPending,
    deletingId,
    usageSavingId,
    isLoading,
    onFilterChange: setFilter,
    onCreateClick: handleCreateClick,
    onEdit: handleEdit,
    onFormOpenChange: (open: boolean) => {
      if (!open) closeForm()
      else setFormOpen(true)
    },
    onSubmit: handleSubmit,
    onDelete: (id: string) => deleteMutation.mutate(id),
    onUpdateUsage: (id: string, usageUsed: number) => usageMutation.mutate({ id, usageUsed }),
  }

  return (
    <>
      <SubscriptionsDesktopView {...sharedProps} />
      <SubscriptionsMobileView {...sharedProps} />
    </>
  )
}
