export interface ApiResponse<T> {
  success: boolean
  message?: string
  data?: T
  errorCode?: string
}

export interface TokenResponse {
  accessToken: string
  refreshToken: string
  expiresIn: number
  tokenType: string
  user: {
    id: string
    username: string
    nickname?: string
    avatarUrl?: string
    role: string
  }
}

export interface TaskResponse {
  id: string
  type: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  input?: unknown
  errorMessage?: string
  resultText?: string
  resultMarkdown?: string
  resultJson?: unknown
  resultFiles?: Array<{ url: string; name: string; storage: string; size: number }>
  keepForever: boolean
  archived: boolean
  expiresAt?: string
  createdAt: string
  updatedAt: string
}
