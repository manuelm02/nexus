import type { ApiKey } from '../../../types/domain.types'

export type BalanceHealth = 'normal' | 'low' | 'empty'

/** 根据余额和阈值判断健康状态 */
export function balanceHealth(item: ApiKey): BalanceHealth {
  const balance = item.remainingBalance ?? 0
  if (balance <= 0) return 'empty'
  if (item.lowBalanceNotify && item.lowBalanceThreshold && balance < item.lowBalanceThreshold) return 'low'
  return 'normal'
}

/** 余额健康度比率（用于视觉指示器），以预警阈值的 3 倍为"满"刻度 */
export function balanceRatio(item: ApiKey): number {
  const balance = item.remainingBalance ?? 0
  const full = (item.lowBalanceThreshold ?? 1) * 3
  return Math.min(balance / full, 1)
}

/** Provider 名称到展示色的映射 */
export const PROVIDER_COLORS: Record<string, string> = {
  deepseek: 'bg-blue-100 text-blue-700',
  openai: 'bg-green-100 text-green-700',
  anthropic: 'bg-orange-100 text-orange-700',
  claude: 'bg-purple-100 text-purple-700',
}

/** Status 到展示色的映射 */
export const STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  exhausted: 'bg-red-100 text-red-700',
  disabled: 'bg-gray-100 text-gray-500',
}

export const STATUS_LABELS: Record<string, string> = {
  active: '可用',
  exhausted: '已耗尽',
  disabled: '已禁用',
}
