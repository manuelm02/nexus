import { apiClient } from './client'
import { useAuthStore } from '../stores/authStore'
import type { ApiResponse } from '../types/api.types'
import type { ChatConversation, ChatMessage, ChatSuggestion } from '../types/domain.types'

export type ChatStreamEvent =
  | { type: 'token'; payload: { token: string } }
  | { type: 'done'; payload: { message: ChatMessage } }
  | { type: 'error'; payload: { error: string } }

export const chatApi = {
  listConversations: () =>
    apiClient.get<ApiResponse<ChatConversation[]>>('/chat/conversations'),

  createConversation: () =>
    apiClient.post<ApiResponse<ChatConversation>>('/chat/conversations'),

  deleteConversation: (id: string) =>
    apiClient.delete<ApiResponse<void>>(`/chat/conversations/${id}`),

  renameConversation: (id: string, title: string, titleAi: boolean) =>
    apiClient.patch<ApiResponse<void>>(`/chat/conversations/${id}/title`, { title, titleAi }),

  generateTitle: (id: string) =>
    apiClient.post<ApiResponse<string>>(`/chat/conversations/${id}/title/ai`),

  getMessages: (id: string) =>
    apiClient.get<ApiResponse<ChatMessage[]>>(`/chat/conversations/${id}/messages`),

  getSuggestions: () =>
    apiClient.get<ApiResponse<ChatSuggestion[]>>('/chat/suggestions'),

  // SSE 使用 fetch 手动读取流，避免 EventSource 只能 GET 且难以携带请求体；与 translateApi.stream 同构。
  stream: async (
    conversationId: string,
    message: string,
    onEvent: (event: ChatStreamEvent) => void,
  ) => {
    const token = useAuthStore.getState().accessToken
    const response = await fetch(`/api/v1/chat/conversations/${conversationId}/messages/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ message }),
    })
    if (!response.ok || !response.body) {
      throw new Error(`Chat stream failed: ${response.status}`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const chunks = buffer.split('\n\n')
      buffer = chunks.pop() ?? ''
      chunks.forEach((chunk) => {
        const eventType = chunk.split('\n').find((line) => line.startsWith('event:'))?.replace('event:', '').trim()
        const eventData = chunk.split('\n').find((line) => line.startsWith('data:'))?.replace('data:', '').trim()
        if (!eventType || !eventData) return
        onEvent({ type: eventType as ChatStreamEvent['type'], payload: JSON.parse(eventData) } as ChatStreamEvent)
      })
    }
  },
}
