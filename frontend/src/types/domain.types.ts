export interface Focus {
  id: string
  title: string
  description?: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  status: 'not_started' | 'in_progress' | 'done' | 'archived'
  scheduledDate?: string
  dueDate?: string
  notionPageUrl?: string
  notionSynced: boolean
  createdAt: string
  updatedAt: string
}

export interface Fleeting {
  id: string
  title?: string
  content: string
  tags?: string[]
  notionPageUrl?: string
  notionSynced: boolean
  createdAt: string
  updatedAt: string
}

export interface Translation {
  id: string
  sourceText: string
  translatedText: string
  sourceLang?: string
  targetLang: string
  style?: string
  createdAt: string
}

export interface Ledger {
  id: string
  name: string
  category?: string
  price?: number
  currency: string
  billingType?: string
  startDate?: string
  expireDate?: string
  nextBillingDate?: string
  usageLimit?: number
  usageUsed: number
  usageUnit?: string
  url?: string
  notes?: string
  status: 'active' | 'expired' | 'cancelled' | 'paused'
  notifyEnabled: boolean
  notifyDaysBefore: number
  createdAt: string
  updatedAt: string
}

export interface LlmProvider {
  id: string
  name: string
  provider: string
  baseUrl?: string
  model?: string
  defaultProvider: boolean
  enabled: boolean
  createdAt: string
}

export interface WorkflowLlmConfig {
  id: string
  workflowType: string
  providerId?: string
  modelOverride?: string
  temperature?: number
  updatedAt: string
}
