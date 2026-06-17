import { useCallback, useState } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { chatApi, type ChatStreamEvent } from '../../../api/chat.api'
import type { ChatMessage } from '../../../types/domain.types'

// useStreamingMessage 封装 Chat SSE 流状态：乐观追加消息、累积内容、流中标志、错误信息。
// 直接操作 queryClient 而非依赖外部回调，避免 React 重渲染导致闭包捕获过期 conversationId，
// 使 done 事件中 appendToCache 始终用 send() 调用时的局部变量 targetId。
export function useStreamingMessage(activeId: string | null) {
  const queryClient = useQueryClient()
  const [streamingContent, setStreamingContent] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingError, setStreamingError] = useState<string | null>(null)

  const send = useCallback(
    async (message: string, conversationId?: string) => {
      const targetId = conversationId ?? activeId
      if (!targetId || isStreaming) return
      setStreamingContent('')
      setStreamingError(null)
      setIsStreaming(true)

      // 乐观追加 user 消息，避免等待 GET 刷新才显示
      appendToCache(queryClient, targetId, {
        id: `optimistic-${Date.now()}`,
        conversationId: targetId,
        role: 'user',
        content: message,
        createdAt: new Date().toISOString(),
      })

      try {
        await chatApi.stream(targetId, message, (event: ChatStreamEvent) => {
          if (event.type === 'token') {
            setStreamingContent((prev) => prev + event.payload.token)
          } else if (event.type === 'done') {
            appendToCache(queryClient, targetId, event.payload.message)
            setStreamingContent('')
            setIsStreaming(false)
            // 立即刷新侧边栏（updated_at），3s 后再次刷新等待后端 AI 命名异步完成
            queryClient.invalidateQueries({ queryKey: ['chat-conversations'] })
            setTimeout(() => queryClient.invalidateQueries({ queryKey: ['chat-conversations'] }), 3000)
          } else if (event.type === 'error') {
            setStreamingError(event.payload.error)
            setIsStreaming(false)
          }
        })
      } catch (e) {
        setStreamingError(e instanceof Error ? e.message : '发送失败')
        setIsStreaming(false)
      }
    },
    [activeId, isStreaming, queryClient],
  )

  return {
    streamingContent,
    isStreaming,
    streamingError,
    send,
  }
}

function appendToCache(queryClient: QueryClient, conversationId: string, message: ChatMessage) {
  queryClient.setQueryData(
    ['chat-messages', conversationId],
    (old: { data: { data: ChatMessage[] } } | undefined) => {
      const existing = old?.data?.data ?? []
      return {
        ...(old ?? {}),
        data: {
          ...(old?.data ?? {}),
          data: [...existing, message],
        },
      }
    },
  )
}
