import { AlertTriangle } from 'lucide-react'

/** 外部集成未配置时的面板内空状态提示，不阻塞应用启动。 */
export function IntegrationEmptyState({
  serviceName,
  description,
}: {
  serviceName: string
  description: string
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
        <AlertTriangle className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-semibold text-foreground">{serviceName} 未配置</p>
      <p className="mt-1.5 max-w-xs text-xs text-muted-foreground">{description}</p>
    </div>
  )
}
