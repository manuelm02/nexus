import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { chatApi } from '../../../api/chat.api'
import type { ChatConversation } from '../../../types/domain.types'

// useConversations 管理对话列表的查询、新建、删除与本地搜索过滤
export function useConversations() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['chat-conversations'],
    queryFn: () => chatApi.listConversations(),
  })

  const conversations: ChatConversation[] = useMemo(() => data?.data?.data ?? [], [data])

  const filteredConversations = useMemo(() => {
    if (!search.trim()) return conversations
    const keyword = search.trim().toLowerCase()
    return conversations.filter((c) => c.title.toLowerCase().includes(keyword))
  }, [conversations, search])

  const createMutation = useMutation({
    mutationFn: () => chatApi.createConversation(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['chat-conversations'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => chatApi.deleteConversation(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['chat-conversations'] }),
  })

  const renameMutation = useMutation({
    mutationFn: ({ id, title, titleAi }: { id: string; title: string; titleAi: boolean }) =>
      chatApi.renameConversation(id, title, titleAi),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['chat-conversations'] }),
  })

  const generateTitleMutation = useMutation({
    mutationFn: (id: string) => chatApi.generateTitle(id),
  })

  return {
    conversations,
    filteredConversations,
    isLoading,
    search,
    setSearch,
    createConversation: createMutation.mutateAsync,
    deleteConversation: deleteMutation.mutate,
    renameConversation: renameMutation.mutate,
    generateTitle: generateTitleMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isRenaming: renameMutation.isPending,
    isGeneratingTitle: generateTitleMutation.isPending,
  }
}
