import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { chatApi } from '../../../api/chat.api'
import type { ChatSuggestion } from '../../../types/domain.types'

// useSuggestions 加载 Chat 首页动态推荐词条
export function useSuggestions() {
  const { data, isLoading } = useQuery({
    queryKey: ['chat-suggestions'],
    queryFn: () => chatApi.getSuggestions(),
  })

  const suggestions: ChatSuggestion[] = useMemo(() => data?.data?.data ?? [], [data])

  return {
    suggestions,
    isLoading,
  }
}
