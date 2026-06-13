import { AlertCircle } from 'lucide-react'
import { ProviderCard } from './components/ProviderCard'
import { ProviderForm, type ProviderFormData } from './components/ProviderForm'
import { WorkflowOverrideSection } from './components/WorkflowOverrideSection'
import { SystemConfigSection, type SystemConfigSectionProps } from './components/SystemConfigSection'
import type { LlmProvider, WorkflowLlmConfig } from '../../types/domain.types'

type SettingsMobileViewProps = {
  providers: LlmProvider[]
  defaultProvider: LlmProvider | undefined
  translateProviderId: string
  translateWorkflow: WorkflowLlmConfig | undefined

  providersLoading: boolean
  providersError: boolean
  workflowsLoading: boolean
  workflowsError: boolean

  editingId: string | null
  editForm: ProviderFormData
  onStartCreate: () => void
  onStartEdit: (provider: LlmProvider) => void
  onCancelEdit: () => void
  onEditFormChange: (form: ProviderFormData) => void

  createPending: boolean
  createError: boolean
  updatePending: boolean
  updateError: boolean
  setDefaultPendingId: string | null
  deletePendingId: string | null
  onCreateSubmit: () => void
  onUpdateSubmit: () => void
  onSetDefault: (id: string) => void
  onDelete: (id: string) => void

  workflowPending: boolean
  onWorkflowChange: (providerId: string) => void

  systemConfig: SystemConfigSectionProps
}

// SettingsMobileView 移动端单列堆叠面板，避免硬压成两栏，保持信息层级与桌面端一致。
export function SettingsMobileView(props: SettingsMobileViewProps) {
  const {
    providers, defaultProvider, translateProviderId, translateWorkflow,
    providersLoading, providersError, workflowsLoading, workflowsError,
    editingId, editForm,
    onStartCreate, onStartEdit, onCancelEdit, onEditFormChange,
    createPending, createError, updatePending, updateError,
    setDefaultPendingId, deletePendingId,
    onCreateSubmit, onUpdateSubmit, onSetDefault, onDelete,
    workflowPending, onWorkflowChange,
    systemConfig,
  } = props

  const isEditing = editingId !== null

  return (
    <div className="space-y-4 md:hidden">
      {/* 页面头部 */}
      <section className="nexus-surface p-4">
        <p className="text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground">System control</p>
        <h1 className="mt-1 text-[24px] font-black leading-tight text-foreground">Settings</h1>
      </section>

      {/* 默认模型面板 */}
      <section className="nexus-surface space-y-3 p-4">
        <h2 className="text-lg font-extrabold text-foreground">默认模型</h2>
        {defaultProvider ? (
          <div className="rounded-xl border border-primary/15 bg-primary/[0.03] px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-foreground">{defaultProvider.name}</span>
              <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-black text-primary-foreground">全局默认</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{defaultProvider.provider} · {defaultProvider.model || '未指定模型'}</p>
          </div>
        ) : (
          <div className="rounded-xl border border-destructive/30 bg-destructive-soft p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-destructive">
              <AlertCircle className="h-4 w-4" />尚未设置默认模型
            </p>
          </div>
        )}
      </section>

      {/* Provider 列表 */}
      <section className="nexus-surface space-y-3 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-foreground">Provider 列表</h2>
          {!isEditing && (
            <button
              type="button"
              onClick={onStartCreate}
              className="nexus-button-primary inline-flex items-center gap-1 px-3 py-1.5 text-xs"
            >
              添加
            </button>
          )}
        </div>

        {isEditing && (
          <ProviderForm
            form={editForm}
            mode={editingId === 'new' ? 'create' : 'edit'}
            pending={editingId === 'new' ? createPending : updatePending}
            error={editingId === 'new' ? createError : updateError}
            onChange={onEditFormChange}
            onSubmit={editingId === 'new' ? onCreateSubmit : onUpdateSubmit}
            onCancel={onCancelEdit}
          />
        )}

        {providersLoading && <p className="py-4 text-center text-sm text-muted-foreground">加载中…</p>}
        {providersError && (
          <p className="flex items-center gap-1.5 py-4 text-sm text-destructive"><AlertCircle className="h-4 w-4" /> 加载失败</p>
        )}
        {!providersLoading && !providersError && (
          <ul className="space-y-2">
            {providers.map((p) => (
              <li key={p.id}>
                <ProviderCard
                  provider={p}
                  isDefault={p.defaultProvider}
                  setDefaultPending={setDefaultPendingId === p.id}
                  deletePending={deletePendingId === p.id}
                  onEdit={() => onStartEdit(p)}
                  onSetDefault={() => onSetDefault(p.id)}
                  onDelete={() => onDelete(p.id)}
                />
              </li>
            ))}
            {providers.length === 0 && !isEditing && (
              <p className="py-6 text-center text-sm text-muted-foreground">尚未配置 Provider</p>
            )}
          </ul>
        )}
      </section>

      {/* 工作流覆盖 */}
      <WorkflowOverrideSection
        providers={providers}
        translateWorkflow={translateWorkflow}
        translateProviderId={translateProviderId}
        workflowsLoading={workflowsLoading}
        workflowsError={workflowsError}
        workflowPending={workflowPending}
        onWorkflowChange={onWorkflowChange}
      />

      {/* 系统参数 */}
      <SystemConfigSection {...systemConfig} />
    </div>
  )
}
