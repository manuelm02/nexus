import { apiClient } from './client'
import type { Translation } from '../types/domain.types'
import type { ApiResponse } from '../types/api.types'

export const translateApi = {
  translate: (data: { sourceText: string; targetLang: string; sourceLang?: string; style?: string }) =>
    apiClient.post<ApiResponse<Translation>>('/translate/translate', data),

  history: () =>
    apiClient.get<ApiResponse<Translation[]>>('/translate/history'),
}
