import { useEffect, useState } from 'react'
import { ArchiveRestore, Copy, Eye, EyeOff, ExternalLink, Pencil } from 'lucide-react'
import { TOTP } from 'otpauth'
import type { Credential } from '../../../types/domain.types'
import { cn } from '../../../lib/utils'
import { credentialApi } from '../../../api/credential.api'
import { isExpiringSoon, isExpired, daysUntilExpiry, PLATFORM_COLORS } from './credentials.shared'
import { DeleteConfirm } from '../components/DeleteConfirm'

type CredentialCardProps = {
  item: Credential
  deleting: boolean
  onEdit: (item: Credential) => void
  onDelete: (id: string) => void
  onUnarchive?: (id: string) => void
}

/** 账号卡片：展示平台、用户名、密码打码/揭示/复制、TOTP 实时验证码 */
export function CredentialCard({ item, deleting, onEdit, onDelete, onUnarchive }: CredentialCardProps) {
  const [passwordRevealed, setPasswordRevealed] = useState(false)
  const [passwordText, setPasswordText] = useState('')
  const [passwordCopied, setPasswordCopied] = useState(false)
  const [usernameCopied, setUsernameCopied] = useState(false)

  // TOTP 状态
  const [totpSecret, setTotpSecret] = useState<string | null>(null)
  const [totpCode, setTotpCode] = useState('')
  const [totpRemaining, setTotpRemaining] = useState(30)

  const expiryDays = daysUntilExpiry(item)
  const showExpiryBadge = (isExpired(item) || isExpiringSoon(item)) && expiryDays != null

  const handleRevealPassword = async () => {
    if (passwordRevealed) { setPasswordRevealed(false); setPasswordText(''); return }
    try {
      const res = await credentialApi.revealPassword(item.id)
      const pw = res.data?.data ?? ''
      setPasswordText(pw)
      setPasswordRevealed(true)
      // 5 秒后自动隐藏
      setTimeout(() => { setPasswordRevealed(false); setPasswordText('') }, 5000)
    } catch { /* 静默处理 */ }
  }

  const handleCopyPassword = async () => {
    try {
      // 如果密码已 reveal，直接复用本地缓存，避免重复调用 API
      let pw = passwordText
      if (!pw) {
        const res = await credentialApi.revealPassword(item.id)
        pw = res.data?.data ?? ''
      }
      await navigator.clipboard.writeText(pw)
      setPasswordCopied(true)
      setTimeout(() => setPasswordCopied(false), 1500)
    } catch { /* 静默处理 */ }
  }

  const handleUsernameCopy = async () => {
    if (!item.username) return
    await navigator.clipboard.writeText(item.username)
    setUsernameCopied(true)
    setTimeout(() => setUsernameCopied(false), 1500)
  }

  const handleRevealTotp = async () => {
    try {
      const res = await credentialApi.revealTotp(item.id)
      const secret = res.data?.data ?? ''
      setTotpSecret(secret)
    } catch { /* 静默处理 */ }
  }

  // TOTP 定时器
  useEffect(() => {
    if (!totpSecret) return
    const totp = new TOTP({ issuer: item.platform, label: item.username || item.label || '', secret: totpSecret })
    const tick = () => {
      setTotpCode(totp.generate())
      setTotpRemaining(totp.period - (Math.floor(Date.now() / 1000) % totp.period))
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [totpSecret, item.platform, item.username, item.label])

  const handleCopyTotp = () => {
    if (totpCode) navigator.clipboard.writeText(totpCode)
  }

  return (
    <article className="rounded-lg border bg-card p-4 shadow-[var(--shadow-xs)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold',
              PLATFORM_COLORS[item.platform.toLowerCase()] ?? 'bg-muted text-muted-foreground')}>
              {item.platform}
            </span>
            <h3 className="truncate text-base font-bold text-foreground">{item.label || item.platform}</h3>
            {showExpiryBadge && (
              <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold',
                expiryDays != null && expiryDays <= 0
                  ? 'bg-red-100 text-red-700'
                  : 'bg-yellow-100 text-yellow-700')}>
                {expiryDays != null && expiryDays <= 0 ? '已过期' : `还有 ${expiryDays} 天`}
              </span>
            )}
          </div>

          {item.username && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{item.username}</span>
              <button type="button" onClick={handleUsernameCopy} className="nexus-button-utility h-6 px-1.5 text-[11px]">
                {usernameCopied ? '已复制' : <><Copy className="h-3 w-3 inline mr-0.5" />复制</>}
              </button>
            </div>
          )}

          {item.passwordSet && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>密码：</span>
              <span className="font-mono text-[11px]">{passwordRevealed && passwordText ? passwordText : '••••••••••'}</span>
              <button type="button" onClick={handleRevealPassword} className="nexus-button-utility h-6 px-1.5 text-[11px]" aria-label={passwordRevealed ? '隐藏密码' : '显示密码'}>
                {passwordRevealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              </button>
              <button type="button" onClick={handleCopyPassword} className="nexus-button-utility h-6 px-1.5 text-[11px]">
                {passwordCopied ? '已复制' : <><Copy className="h-3 w-3 inline mr-0.5" />复制</>}
              </button>
            </div>
          )}

          {item.totpSet && (
            <div className="flex items-center gap-2 text-xs">
              {totpSecret ? (
                <>
                  <span className="font-mono text-lg font-bold tracking-widest">{totpCode || '------'}</span>
                  <span className={cn('font-mono text-[11px]', totpRemaining <= 10 ? 'text-red-500' : 'text-muted-foreground')}>
                    ({totpRemaining}s)
                  </span>
                  <button type="button" onClick={handleCopyTotp} className="nexus-button-utility h-6 px-1.5 text-[11px]" aria-label="复制验证码">
                    <Copy className="h-3 w-3" />
                  </button>
                </>
              ) : (
                <button type="button" onClick={handleRevealTotp} className="nexus-button-utility h-7 px-2 text-[11px] font-bold">
                  点击显示验证码
                </button>
              )}
            </div>
          )}

          {item.url && (
            <a href={item.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-[11px] text-[hsl(var(--primary))] hover:underline">
              {item.url} <ExternalLink className="h-3 w-3" />
            </a>
          )}

          {item.category && (
            <span className="inline-block rounded-full border bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
              {item.category}
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={() => onEdit(item)} className="nexus-button-utility h-9 w-9 text-muted-foreground" aria-label="编辑">
            <Pencil className="h-4 w-4" />
          </button>
          {onUnarchive && (
            <button type="button" onClick={() => onUnarchive(item.id)} className="nexus-button-utility h-9 w-9 text-muted-foreground" aria-label="取消归档">
              <ArchiveRestore className="h-4 w-4" />
            </button>
          )}
          <DeleteConfirm deleting={deleting} onConfirm={() => onDelete(item.id)} />
        </div>
      </div>
    </article>
  )
}
