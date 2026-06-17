import { AlertCircle, Loader2, Save } from 'lucide-react'
import type { LlmProvider } from '../../../types/domain.types'
import { WorkflowModelSelect } from './WorkflowModelSelect'

type ChatModelPanelProps = {
  providers: LlmProvider[]
  providerId: string
  dirty: boolean
  workflowsLoading: boolean
  workflowsError: boolean
  savePending: boolean
  saveError: boolean
  onProviderChange: (providerId: string) => void
  onSave: () => void
  onCancel: () => void
}

// ChatModelPanel 管理 Chat 工作流的专用模型绑定，用于日常问答场景。
export function ChatModelPanel({
  providers,
  providerId,
  dirty,
  workflowsLoading,
  workflowsError,
  savePending,
  saveError,
  onProviderChange,
  onSave,
  onCancel,
}: ChatModelPanelProps) {
  return (
    <section className="nexus-surface space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-foreground">Chat 设置</h2>
          <p className="mt-1 text-xs text-muted-foreground">用于日常问答的专用模型，未配置时回退至全局默认模型</p>
        </div>
        {dirty && (
          <span className="rounded-md bg-warning-soft px-2 py-1 text-xs font-bold text-warning">
            有未保存更改
          </span>
        )}
      </div>

      <div className="rounded-xl border border-border bg-muted/30 p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_320px] lg:items-center">
          <div>
            <h3 className="text-sm font-extrabold text-foreground">专用模型</h3>
          </div>
          <WorkflowModelSelect
            providers={providers}
            value={providerId}
            onChange={onProviderChange}
            disabled={workflowsLoading || savePending}
          />
        </div>
      </div>

      {workflowsLoading && <p className="text-sm text-muted-foreground">加载中…</p>}
      {workflowsError && (
        <p className="flex items-center gap-1.5 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" /> 加载 Chat 配置失败
        </p>
      )}
      {providers.length === 0 && (
        <p className="text-xs text-muted-foreground">添加模型后可指定专用模型。</p>
      )}

      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card/95 p-3 shadow-[var(--shadow-xs)]">
        <button
          type="button"
          onClick={onSave}
          disabled={!dirty || savePending}
          className="nexus-button-primary inline-flex items-center gap-1.5 px-4 text-xs disabled:opacity-50"
        >
          {savePending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {savePending ? '保存中…' : '保存设置'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={!dirty || savePending}
          className="nexus-button-utility px-4 text-xs disabled:opacity-50"
        >
          取消更改
        </button>
        {saveError && (
          <span className="flex items-center gap-1 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5" /> 保存失败
          </span>
        )}
      </div>
    </section>
  )
}
