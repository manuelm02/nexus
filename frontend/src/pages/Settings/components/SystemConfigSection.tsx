import { Link } from 'react-router-dom'
import { ListTodo, Save, Loader2, AlertCircle } from 'lucide-react'

export type SystemConfigSectionProps = {
  systemConfigData: Record<string, string> | undefined
  systemConfigLoading: boolean
  systemConfigError: boolean
  overrides: Record<string, string>
  dirty: boolean
  savePending: boolean
  saveError: boolean
  onOverrideChange: (key: string, val: string) => void
  onOverridesSave: () => void
  onOverridesCancel: () => void
}

// SystemConfigSection 负责展示 Jobs/Tasks 入口和系统参数键值编辑区，视觉权重低于模型管理区。
export function SystemConfigSection({
  systemConfigData, systemConfigLoading, systemConfigError,
  overrides, dirty, savePending, saveError,
  onOverrideChange, onOverridesSave, onOverridesCancel,
}: SystemConfigSectionProps) {
  const merged: Record<string, string> = { ...(systemConfigData ?? {}), ...overrides }

  if (systemConfigLoading) {
    return (
      <section className="nexus-surface p-4">
        <p className="text-sm text-muted-foreground">加载中…</p>
      </section>
    )
  }

  if (systemConfigError) {
    return (
      <section className="nexus-surface p-4">
        <p className="flex items-center gap-1.5 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" /> 加载系统配置失败
        </p>
      </section>
    )
  }

  return (
    <section className="nexus-surface space-y-4 p-4">
      <div>
        <h2 className="text-lg font-extrabold text-foreground">系统</h2>
        <p className="text-sm leading-7 text-muted-foreground">Jobs / Tasks 入口与系统级键值参数。</p>
      </div>

      {/* Jobs / Tasks 入口 */}
      <Link
        to="/tasks"
        className="flex items-center justify-between gap-3 rounded-xl border border-border px-4 py-3 transition-colors hover:border-input hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ListTodo className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold">Jobs / Tasks</span>
            <span className="block truncate text-xs text-muted-foreground">查看后台异步任务记录和保留状态。</span>
          </span>
        </span>
        <span className="text-xs font-bold text-muted-foreground">打开 →</span>
      </Link>

      {/* 系统参数键值对编辑区 */}
      <div className="border-t border-border pt-4">
        <h3 className="mb-3 text-sm font-extrabold text-foreground">系统参数</h3>
        {Object.keys(merged).length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            暂无系统配置项（请确认数据库迁移已执行）
          </p>
        ) : (
          <div className="space-y-2">
            {Object.entries(merged).map(([key, val]) => (
              <div key={key} className="flex items-center gap-3">
                <label className="w-52 shrink-0 text-xs font-mono text-muted-foreground truncate">{key}</label>
                <input
                  value={val}
                  onChange={(e) => onOverrideChange(key, e.target.value)}
                  className="nexus-input flex-1 px-3 py-2 text-sm"
                />
              </div>
            ))}
          </div>
        )}
        {dirty && (
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={onOverridesSave}
              disabled={savePending}
              className="nexus-button-primary inline-flex items-center gap-1.5 px-4 py-2 text-xs"
            >
              {savePending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              保存更改
            </button>
            <button
              onClick={onOverridesCancel}
              className="nexus-button-utility px-3 py-1.5 text-xs font-bold"
            >
              取消
            </button>
            {saveError && (
              <p className="flex items-center gap-1 text-xs text-destructive">
                <AlertCircle className="h-3.5 w-3.5" /> 保存失败
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
