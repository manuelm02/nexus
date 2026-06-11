import { apiClient } from './client'
import { useAuthStore } from '../stores/authStore'
import type { TranslationResult } from '../types/domain.types'
import type { ApiResponse } from '../types/api.types'

type TranslatePayload = {
  sourceText: string
  targetLang: string
  sourceLang?: string
  style?: string
  context?: string
}

export type TranslationStreamEvent = {
  type: 'draft' | 'token' | 'enhanced' | 'done'
  payload: {
    translatedText: string
    explanation?: string
    keywords?: string[]
    alternatives?: string[]
    provider?: string
  }
}

export interface HistoryPageResponse {
  items: TranslationResult[]
  total: number
  page: number
  size: number
}

// Phase 2 结果字段会由后端逐步补齐，因此前端先把 keywords/alternatives 视为可选字段，避免前后端必须同步上线。
export function normalizeTranslationResult(input: TranslationResult): TranslationResult {
  return {
    ...input,
    keywords: Array.isArray(input.keywords) ? input.keywords : parseStringArray(input.keywords),
    alternatives: Array.isArray(input.alternatives) ? input.alternatives : parseStringArray(input.alternatives),
  }
}

function parseStringArray(value: unknown): string[] {
  if (!value) return []
  if (typeof value !== 'string') return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function normalizeApiResponse<T extends TranslationResult | TranslationResult[]>(response: { data: ApiResponse<T> }) {
  const payload = response.data.data
  if (Array.isArray(payload)) {
    response.data.data = payload.map(normalizeTranslationResult) as T
  } else if (payload) {
    response.data.data = normalizeTranslationResult(payload) as T
  }
  return response
}

export const translateApi = {
  translate: (data: TranslatePayload) =>
    apiClient.post<ApiResponse<TranslationResult>>('/translate/translate', data).then(normalizeApiResponse),

  // 后端分页查询翻译历史，返回 items / total / page / size
  history: (page: number = 1, size: number = 12) =>
    apiClient.get<ApiResponse<HistoryPageResponse>>('/translate/history', { params: { page, size } }),

  // 删除单条翻译记录
  deleteHistory: (id: string) =>
    apiClient.delete<ApiResponse<void>>(`/translate/history/${id}`),

  // SSE 使用 fetch 手动读取流，避免 EventSource 只能 GET 且难以携带请求体。
  stream: async (data: TranslatePayload, onEvent: (event: TranslationStreamEvent) => void) => {
    const token = useAuthStore.getState().accessToken
    const response = await fetch('/api/v1/translate/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(data),
    })
    if (!response.ok || !response.body) throw new Error(`Translate stream failed: ${response.status}`)

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
        onEvent({ type: eventType as TranslationStreamEvent['type'], payload: JSON.parse(eventData) })
      })
    }
  },
}
