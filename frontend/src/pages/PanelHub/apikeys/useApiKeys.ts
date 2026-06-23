import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { apiKeyApi } from '../../../api/apiKey.api'
import type { ApiKey } from '../../../types/domain.types'

/** API Key 数据操作 Hook：集中管理列表、CRUD、充消、余额同步 */
export function useApiKeys() {
  const queryClient = useQueryClient()
  const [syncingId, setSyncingId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => apiKeyApi.list(),
  })

  const apiKeys: ApiKey[] = data?.data?.data ?? []

  const invalidate = (id?: string) => {
    queryClient.invalidateQueries({ queryKey: ['api-keys'] })
    if (id) {
      queryClient.invalidateQueries({ queryKey: ['api-key-ledger', id] })
      queryClient.invalidateQueries({ queryKey: ['api-key-balance-history', id] })
    }
  }

  const createMutation = useMutation({
    mutationFn: apiKeyApi.create,
    onSuccess: () => invalidate(),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      apiKeyApi.update(id, payload),
    onSuccess: () => invalidate(),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiKeyApi.remove(id),
    onSuccess: () => invalidate(),
  })

  const rechargeMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { amount: number; date?: string; note?: string } }) =>
      apiKeyApi.recharge(id, data),
    onSuccess: (_d, v) => invalidate(v.id),
  })

  const consumeMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { amount: number; note?: string } }) =>
      apiKeyApi.consume(id, data),
    onSuccess: (_d, v) => invalidate(v.id),
  })

  const syncBalanceMutation = useMutation({
    mutationFn: (id: string) => {
      setSyncingId(id)
      return apiKeyApi.syncBalance(id)
    },
    onSettled: () => setSyncingId(null),
    onSuccess: (_d, id) => invalidate(id),
  })

  return {
    apiKeys,
    isLoading,
    syncingId,
    create: createMutation.mutate,
    creating: createMutation.isPending,
    update: (id: string, payload: Record<string, unknown>) => updateMutation.mutate({ id, payload }),
    remove: deleteMutation.mutate,
    recharge: (id: string, data: { amount: number; date?: string; note?: string }) => rechargeMutation.mutate({ id, data }),
    consume: (id: string, data: { amount: number; note?: string }) => consumeMutation.mutate({ id, data }),
    syncBalance: syncBalanceMutation.mutate,
  }
}
