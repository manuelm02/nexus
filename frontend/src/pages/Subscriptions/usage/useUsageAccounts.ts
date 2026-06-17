import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { subscriptionApi } from '../../../api/subscription.api'
import { subscriptionCategoryApi } from '../../../api/subscriptionCategory.api'
import type { Subscription } from '../../../types/domain.types'

// useUsageAccounts 集中管理"用量面板"Tab 的全部数据与操作：列表、统计、充值/消费、余额同步、流水、分类
export function useUsageAccounts() {
  const queryClient = useQueryClient()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: () => subscriptionApi.list(),
  })

  const { data: categoriesData } = useQuery({
    queryKey: ['subscription-categories'],
    queryFn: () => subscriptionCategoryApi.list(),
  })

  const items: Subscription[] = useMemo(() => data?.data?.data ?? [], [data])
  const usageItems = useMemo(() => items.filter((i) => i.billingType === 'per_token' && !i.archived), [items])
  const archivedUsageItems = useMemo(() => items.filter((i) => i.billingType === 'per_token' && i.archived), [items])
  const categories = useMemo(() => (categoriesData?.data?.data ?? []).map((c) => c.name), [categoriesData])

  const invalidate = (id?: string) => {
    queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
    queryClient.invalidateQueries({ queryKey: ['subscription-stats'] })
    if (id) {
      queryClient.invalidateQueries({ queryKey: ['subscription-ledger', id] })
      queryClient.invalidateQueries({ queryKey: ['subscription-balance-history', id] })
    }
  }

  const createMutation = useMutation({
    mutationFn: subscriptionApi.createUsageAccount,
    onSuccess: () => invalidate(),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Subscription> }) => subscriptionApi.update(id, payload),
    onSuccess: () => invalidate(),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => subscriptionApi.delete(id),
    onMutate: (id) => setDeletingId(id),
    onSettled: () => setDeletingId(null),
    onSuccess: () => invalidate(),
  })

  const rechargeMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { amount: number; date?: string; note?: string } }) =>
      subscriptionApi.recharge(id, data),
    onSuccess: (_d, v) => invalidate(v.id),
  })

  const consumeMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { amount: number; note?: string } }) =>
      subscriptionApi.consume(id, data),
    onSuccess: (_d, v) => invalidate(v.id),
  })

  const syncBalanceMutation = useMutation({
    mutationFn: (id: string) => subscriptionApi.syncBalance(id),
    onSuccess: (_d, id) => invalidate(id),
  })

  return {
    isLoading,
    usageItems,
    archivedUsageItems,
    categories,
    deletingId,
    createUsageAccount: createMutation.mutate,
    creating: createMutation.isPending,
    createError: createMutation.error as Error | null,
    createSuccess: createMutation.isSuccess,
    updateAccount: updateMutation.mutate,
    deleteAccount: deleteMutation.mutate,
    recharge: (id: string, data: { amount: number; date?: string; note?: string }) => rechargeMutation.mutate({ id, data }),
    consume: (id: string, data: { amount: number; note?: string }) => consumeMutation.mutate({ id, data }),
    syncBalance: syncBalanceMutation.mutate,
    syncingId: syncBalanceMutation.isPending ? (syncBalanceMutation.variables as string | undefined) : undefined,
  }
}
