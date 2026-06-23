import type { Credential } from '../../../types/domain.types'

/** 判断凭证是否即将到期（默认 30 天内） */
export function isExpiringSoon(credential: Credential, daysAhead = 30): boolean {
  if (!credential.expireDate) return false
  const expire = new Date(credential.expireDate)
  const threshold = new Date()
  threshold.setDate(threshold.getDate() + daysAhead)
  return expire <= threshold
}

/** 计算距到期还有几天（null 表示无到期日） */
export function daysUntilExpiry(credential: Credential): number | null {
  if (!credential.expireDate) return null
  const diff = new Date(credential.expireDate).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

/** 是否已过期 */
export function isExpired(credential: Credential): boolean {
  if (!credential.expireDate) return false
  return new Date(credential.expireDate) < new Date()
}

/** 按 category 分组 */
export function groupByCategory(credentials: Credential[]): Record<string, Credential[]> {
  const groups: Record<string, Credential[]> = {}
  for (const c of credentials) {
    const cat = c.category || '未分类'
    ;(groups[cat] ??= []).push(c)
  }
  return groups
}

/** Platform 名称到展示色的映射 */
export const PLATFORM_COLORS: Record<string, string> = {
  github: 'bg-gray-800 text-white',
  google: 'bg-blue-100 text-blue-700',
  aws: 'bg-amber-100 text-amber-700',
  azure: 'bg-sky-100 text-sky-700',
  vercel: 'bg-black text-white',
}
