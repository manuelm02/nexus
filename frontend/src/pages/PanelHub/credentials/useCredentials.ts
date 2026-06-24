import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { credentialApi } from '../../../api/credential.api'
import type { Credential } from '../../../types/domain.types'

/** 账号数据操作 Hook：集中管理列表和 CRUD */
export function useCredentials() {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['credentials'],
    queryFn: () => credentialApi.list(),
  })

  const credentials: Credential[] = data?.data?.data ?? []

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['credentials'] })
  }

  const createMutation = useMutation({
    mutationFn: credentialApi.create,
    onSuccess: () => invalidate(),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      credentialApi.update(id, payload),
    onSuccess: () => invalidate(),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => credentialApi.remove(id),
    onSuccess: () => invalidate(),
  })

  return {
    credentials,
    isLoading,
    create: createMutation.mutate,
    creating: createMutation.isPending,
    update: (id: string, payload: Record<string, unknown>) => updateMutation.mutate({ id, payload }),
    remove: deleteMutation.mutate,
  }
}
