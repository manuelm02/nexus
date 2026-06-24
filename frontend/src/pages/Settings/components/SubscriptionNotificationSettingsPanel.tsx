import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { settingsApi } from '../../../api/settings.api'
import { AlertCircle, Loader2, Save } from 'lucide-react'
import type { SubscriptionSettings } from '../../../types/domain.types'

// SubscriptionNotificationSettingsPanel 管理订阅到期前提醒天数，值更改后显式保存。
export function SubscriptionNotificationSettingsPanel() {
  const qc = useQueryClient()
  const [days, setDays] = useState(7)
  const [dirty, setDirty] = useState(false)

  const { data: settingsRes, isLoading, isError } = useQuery({
    queryKey: ['settings', 'subscription-notify'],
    queryFn: () => settingsApi.getSubscriptionSettings(),
  })

  const saveMutation = useMutation({
    mutationFn: () => settingsApi.saveSubscriptionSettings({ notifyDaysBefore: days }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings', 'subscription-notify'] })
      setDirty(false)
    },
  })

  // 远程数据加载后同步本地草稿
  useEffect(() => {
    const remote: SubscriptionSettings | undefined = settingsRes?.data?.data
    if (remote !== undefined) {
      setDays(remote.notifyDaysBefore)
      setDirty(false)
    }
  }, [settingsRes])

  const handleChange = (val: number) => {
    const clamped = Math.max(1, Math.min(90, val))
    setDays(clamped)
    setDirty(true)
  }

  if (isLoading) {
    return (
      <section className="nexus-surface space-y-4 p-4">
        <p className="text-sm text-muted-foreground">加载中…</p>
      </section>
    )
  }

  if (isError) {
    return (
      <section className="nexus-surface space-y-4 p-4">
        <p className="flex items-center gap-1.5 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" /> 加载订阅提醒设置失败
        </p>
      </section>
    )
  }

  return (
    <section className="nexus-surface space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-foreground">提醒策略</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            订阅到期前多少天开始发送提醒通知
          </p>
        </div>
        {dirty && (
          <span className="rounded-md bg-warning-soft px-2 py-1 text-xs font-bold text-warning">
            有未保存更改
          </span>
        )}
      </div>

      <div className="rounded-xl border border-border bg-muted/30 p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_200px] lg:items-center">
          <div>
            <h3 className="text-sm font-extrabold text-foreground">到期前提醒天数</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">范围 1-90 天</p>
          </div>
          <input
            type="number"
            min={1}
            max={90}
            value={days}
            onChange={(e) => handleChange(Number(e.target.value))}
            className="nexus-input h-10 px-3 text-sm"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card/95 p-3 shadow-[var(--shadow-xs)]">
        <button
          type="button"
          onClick={() => saveMutation.mutate()}
          disabled={!dirty || saveMutation.isPending}
          className="nexus-button-primary inline-flex items-center gap-1.5 px-4 text-xs disabled:opacity-50"
        >
          {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saveMutation.isPending ? '保存中…' : '保存设置'}
        </button>
        <button
          type="button"
          onClick={() => {
            const remote: SubscriptionSettings | undefined = settingsRes?.data?.data
            if (remote !== undefined) setDays(remote.notifyDaysBefore)
            setDirty(false)
          }}
          disabled={!dirty || saveMutation.isPending}
          className="nexus-button-utility px-4 text-xs disabled:opacity-50"
        >
          取消更改
        </button>
        {saveMutation.isError && (
          <span className="flex items-center gap-1 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5" /> 保存失败
          </span>
        )}
      </div>
    </section>
  )
}
