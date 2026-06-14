import { AlertTriangle } from 'lucide-react'

/** 外部集成未配置时的面板内空状态提示，不阻塞应用启动。 */
export function IntegrationEmptyState({
  serviceName,
  description,
  actionLabel,
  actionHref,
}: {
  serviceName: string
  description: string
  actionLabel?: string
  actionHref?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border bg-card px-4 py-12 text-center shadow-[var(--shadow-xs)]">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
        <AlertTriangle className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-semibold text-foreground">{serviceName} 未配置</p>
      <p className="mt-1.5 max-w-xs text-xs text-muted-foreground">{description}</p>
      {actionLabel && actionHref && (
        <a
          href={actionHref}
          className="nexus-button-primary mt-4 inline-flex items-center px-4 text-xs"
        >
          {actionLabel}
        </a>
      )}
    </div>
  )
}
