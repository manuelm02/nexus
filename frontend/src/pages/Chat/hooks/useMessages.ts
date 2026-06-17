import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { chatApi } from '../../../api/chat.api'
import type { ChatMessage } from '../../../types/domain.types'

// useMessages 加载指定对话的历史消息；消息写入由 useStreamingMessage 直接操作 queryClient 完成
export function useMessages(conversationId: string | null) {
  const { data, isLoading } = useQuery({
    queryKey: ['chat-messages', conversationId],
    queryFn: () => chatApi.getMessages(conversationId!),
    enabled: !!conversationId,
  })

  const messages: ChatMessage[] = useMemo(() => data?.data?.data ?? [], [data])

  return {
    messages,
    isLoading,
  }
}
