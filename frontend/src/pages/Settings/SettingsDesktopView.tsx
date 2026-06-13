import type { LlmProvider, WorkflowLlmConfig } from '../../types/domain.types'
import { ProviderCard } from './components/ProviderCard'
import { ProviderForm, type ProviderFormData } from './components/ProviderForm'
import { WorkflowOverrideSection } from './components/WorkflowOverrideSection'
import { SystemConfigSection, type SystemConfigSectionProps } from './components/SystemConfigSection'
import { Bot, AlertCircle } from 'lucide-react'

export type SettingsViewProps = {
  providers: LlmProvider[]
  workflows: WorkflowLlmConfig[]
  defaultProvider: LlmProvider | undefined
  translateWorkflow: WorkflowLlmConfig | undefined
  translateProviderId: string

  providersLoading: boolean
  providersError: boolean
  workflowsLoading: boolean
  workflowsError: boolean

  // Provider 表单状态
  editingId: string | null
  editForm: ProviderFormData
  onStartCreate: () => void
  onStartEdit: (provider: LlmProvider) => void
  onCancelEdit: () => void
  onEditFormChange: (form: ProviderFormData) => void

  // Provider mutations
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

  // Workflow
  workflowPending: boolean
  onWorkflowChange: (providerId: string) => void

  // System config
  systemConfig: SystemConfigSectionProps
}

// SettingsDesktopView 按连续面板结构组织模型工作台，桌面端使用更宽松的分区间距。
export function SettingsDesktopView(props: SettingsViewProps) {
  const {
    providers, defaultProvider, translateProviderId,
    providersLoading, providersError, workflowsLoading, workflowsError,
    editingId, editForm,
    onStartCreate, onStartEdit, onCancelEdit, onEditFormChange,
    createPending, createError, updatePending, updateError,
    setDefaultPendingId, deletePendingId,
    onCreateSubmit, onUpdateSubmit, onSetDefault, onDelete,
    workflowPending, onWorkflowChange,
    systemConfig, translateWorkflow,
  } = props

  const isEditing = editingId !== null

  return (
    <div className="hidden space-y-4 md:block">
      {/* 页面头部 */}
      <section className="nexus-surface flex items-center gap-3 p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Bot className="h-5 w-5" />
        </span>
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground">System control</p>
          <h1 className="text-[28px] font-black leading-tight text-foreground">Settings</h1>
        </div>
      </section>

      {/* 默认模型面板 */}
      <section className="nexus-surface space-y-4 p-4">
        <h2 className="text-lg font-extrabold text-foreground">默认模型</h2>
        {defaultProvider ? (
          <div className="rounded-xl border border-primary/15 bg-primary/[0.03] px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-foreground">{defaultProvider.name}</span>
              <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-black text-primary-foreground">全局默认</span>
              <span className={defaultProvider.enabled ? 'text-xs text-success font-bold' : 'text-xs text-muted-foreground font-bold'}>
                · {defaultProvider.enabled ? '启用' : '禁用'}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {defaultProvider.provider} · {defaultProvider.model || '未指定模型'}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-destructive/30 bg-destructive-soft p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-destructive">
              <AlertCircle className="h-4 w-4" />
              尚未设置默认模型
            </p>
            <p className="mt-1 text-xs leading-6 text-destructive/80">
              点击下方任意 Provider 的星标按钮将其设为默认，或添加新的 Provider 时在卡片上操作。
            </p>
          </div>
        )}
      </section>

      {/* Provider 列表面板：每张卡片展示名称、类型、模型、状态和关键操作 */}
      <section className="nexus-surface space-y-4 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-foreground">Provider 列表</h2>
            <p className="text-sm leading-7 text-muted-foreground">
              管理所有已连接的 LLM provider。可编辑、设默认、删除。
            </p>
          </div>
          {!isEditing && (
            <button
              type="button"
              onClick={onStartCreate}
              className="nexus-button-primary inline-flex items-center gap-1.5 px-4 py-2 text-xs"
            >
              添加 Provider
            </button>
          )}
        </div>

        {/* 内联表单：创建或编辑模式时嵌入列表上方 */}
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

        {providersLoading && (
          <p className="py-4 text-center text-sm text-muted-foreground">加载中…</p>
        )}
        {providersError && (
          <p className="flex items-center gap-1.5 py-4 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" /> 加载 Providers 失败，请刷新重试
          </p>
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
              <p className="py-6 text-center text-sm text-muted-foreground">
                尚未配置 Provider，点击「添加 Provider」创建
              </p>
            )}
          </ul>
        )}
      </section>

      {/* 工作流覆盖面板 */}
      <WorkflowOverrideSection
        providers={providers}
        translateWorkflow={translateWorkflow}
        translateProviderId={translateProviderId}
        workflowsLoading={workflowsLoading}
        workflowsError={workflowsError}
        workflowPending={workflowPending}
        onWorkflowChange={onWorkflowChange}
      />

      {/* 次级系统面板：Jobs/Tasks + 系统参数 */}
      <SystemConfigSection {...systemConfig} />
    </div>
  )
}
