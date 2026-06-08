import { apiClient } from './client'
import type { Translation } from '../types/domain.types'
import type { ApiResponse } from '../types/api.types'

export const prismApi = {
  translate: (data: { sourceText: string; targetLang: string; sourceLang?: string; style?: string }) =>
    apiClient.post<ApiResponse<Translation>>('/prism/translate', data),

  history: () =>
    apiClient.get<ApiResponse<Translation[]>>('/prism/history'),
}
