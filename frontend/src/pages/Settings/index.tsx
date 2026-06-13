import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../api/client'
import { settingsApi } from '../../api/settings.api'
import type { ApiResponse } from '../../types/api.types'
import type { LlmProvider, WorkflowLlmConfig, InboxSettings, InboxSettingsUpdateRequest } from '../../types/domain.types'
import type { ProviderFormData } from './components/ProviderForm'
import { SettingsDesktopView } from './SettingsDesktopView'
import type { SettingsTab } from './SettingsDesktopView'
import { SettingsMobileView } from './SettingsMobileView'

// SettingsPage 统一编排 LLM provider、workflow 覆盖和系统配置的查询与变更，桌面端和移动端共用业务逻辑。
export default function SettingsPage() {
  const initialTab = (() => {
    const tab = new URLSearchParams(window.location.search).get('tab')
    if (tab === 'workflows') return 'translate'
    return tab === 'translate' || tab === 'inbox' || tab === 'system' ? tab : 'models'
  })() as SettingsTab
  const [activeSettingsTab, setActiveSettingsTab] = useState<SettingsTab>(initialTab)
  const [editingId, setEditingId] = useState<string | null>(null)
  // 编辑表单初始值：provider 默认 openai，enabled 默认 true
  const [editForm, setEditForm] = useState<ProviderFormData>({
    name: '', provider: 'openai', apiKey: '', model: '', baseUrl: '', enabled: true,
  })

  // 重置编辑表单到初始空状态；apiKey 用 '' 保持受控，发送时 cleanBody 会剥离空值
  const resetEditForm = () => setEditForm({ name: '', provider: 'openai', apiKey: '', model: '', baseUrl: '', enabled: true })
  const qc = useQueryClient()

  // --- 查询：Provider、Workflow、系统配置 ---
  const { data: providerRes, isLoading: providersLoading, isError: providersError } = useQuery({
    queryKey: ['llm-providers'],
    queryFn: () => apiClient.get<ApiResponse<LlmProvider[]>>('/settings/llm/providers'),
  })
  const { data: wfRes, isLoading: workflowsLoading, isError: workflowsError } = useQuery({
    queryKey: ['llm-workflows'],
    queryFn: () => apiClient.get<ApiResponse<WorkflowLlmConfig[]>>('/settings/llm/workflows'),
  })
  const { data: sysRes, isLoading: sysLoading, isError: sysError } = useQuery({
    queryKey: ['system-config'],
    queryFn: () => apiClient.get<ApiResponse<Record<string, string>>>('/settings/system'),
    select: (res) => res.data?.data ?? {},
  })

  // --- Provider CRUD mutations ---
  // 发送前剥离空 apiKey，避免后端将空串当作覆盖值加密入库；创建模式同理。
  const cleanBody = (form: ProviderFormData) => {
    const body: Record<string, unknown> = { ...form }
    if (!body.apiKey) delete body.apiKey
    return body
  }

  const createMutation = useMutation({
    mutationFn: () => apiClient.post('/settings/llm/providers', cleanBody(editForm)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['llm-providers'] })
      setEditingId(null)
      resetEditForm()
    },
  })

  const updateMutation = useMutation({
    mutationFn: () => apiClient.patch(`/settings/llm/providers/${editingId}`, cleanBody(editForm)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['llm-providers'] })
      setEditingId(null)
      resetEditForm()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/settings/llm/providers/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['llm-providers'] }),
  })

  // 设为默认：通过 PATCH 端点发送 isDefault=true，后端会自动将其他 provider 的 defaultProvider 置 false
  const setDefaultMutation = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/settings/llm/providers/${id}`, { isDefault: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['llm-providers'] }),
  })

  const workflowMutation = useMutation({
    mutationFn: ({ type, providerId }: { type: string; providerId: string }) =>
      apiClient.patch(`/settings/llm/workflows/${type}`, { providerId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['llm-workflows'] }),
  })

  // --- 系统配置变更状态 ---
  const [overrides, setOverrides] = useState<Record<string, string>>({})
  const [dirty, setDirty] = useState(false)

  const sysSaveMutation = useMutation({
    mutationFn: () => apiClient.patch('/settings/system', { configs: overrides }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['system-config'] })
      setOverrides({})
      setDirty(false)
    },
  })

  // --- Inbox 设置 ---
  const inboxSettingsQuery = useQuery({
    queryKey: ['settings', 'inbox'],
    queryFn: () => settingsApi.getInboxSettings(),
  })

  const inboxSettings: InboxSettings | undefined = inboxSettingsQuery.data?.data?.data

  const updateInboxSettingsMutation = useMutation({
    mutationFn: (data: InboxSettingsUpdateRequest) =>
      settingsApi.updateInboxSettings(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings', 'inbox'] })
    },
  })

  // --- 派生数据 ---
  const providers: LlmProvider[] = providerRes?.data?.data ?? []
  const workflows: WorkflowLlmConfig[] = wfRes?.data?.data ?? []
  const defaultProvider = providers.find((p) => p.defaultProvider)
  const translateWorkflow = workflows.find((w) => w.workflowType === 'translate')
  const translateProviderId = translateWorkflow?.providerId ?? ''
  const inboxWorkflow = workflows.find((w) => w.workflowType === 'inbox')
  const inboxProviderId = inboxWorkflow?.providerId ?? ''
  const [translateProviderDraft, setTranslateProviderDraft] = useState(translateProviderId)

  // 工作流配置由远程数据驱动；查询刷新后同步草稿，避免旧草稿覆盖后端新值。
  useEffect(() => {
    setTranslateProviderDraft(translateProviderId)
  }, [translateProviderId])

  const workflowPendingType = workflowMutation.isPending ? workflowMutation.variables?.type : null
  const translateDirty = translateProviderDraft !== translateProviderId

  // --- Provider 编辑操作 ---
  const handleStartCreate = () => {
    setEditingId('new')
    resetEditForm()
  }

  const handleStartEdit = (provider: LlmProvider) => {
    setEditingId(provider.id)
    // 编辑时回填现有数据；apiKey 不回显设为 ''，cleanBody 会在发送前剥离避免覆盖已有 key
    setEditForm({
      name: provider.name,
      provider: provider.provider,
      apiKey: '',
      model: provider.model || '',
      baseUrl: provider.baseUrl || '',
      enabled: provider.enabled,
    })
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    resetEditForm()
  }

  // --- 系统配置操作 ---
  const handleOverrideChange = (key: string, val: string) => {
    setOverrides((prev) => ({ ...prev, [key]: val }))
    setDirty(true)
  }

  const handleOverridesCancel = () => {
    setOverrides({})
    setDirty(false)
  }

  // --- 组装视图 Props ---
  const sharedProps = {
    activeSettingsTab,
    onSettingsTabChange: (tab: SettingsTab) => {
      setActiveSettingsTab(tab)
      const next = new URL(window.location.href)
      next.searchParams.set('tab', tab)
      window.history.replaceState(null, '', next.toString())
    },
    providers,
    workflows,
    defaultProvider,
    translateProviderId: translateProviderDraft,
    translateSettings: {
      providerId: translateProviderDraft,
      dirty: translateDirty,
      savePending: workflowPendingType === 'translate',
      saveError: workflowMutation.isError && workflowMutation.variables?.type === 'translate',
      onProviderChange: setTranslateProviderDraft,
      onSave: () => workflowMutation.mutate({ type: 'translate', providerId: translateProviderDraft }),
      onCancel: () => setTranslateProviderDraft(translateProviderId),
    },
    providersLoading,
    providersError,
    workflowsLoading,
    workflowsError,
    editingId,
    editForm,
    onStartCreate: handleStartCreate,
    onStartEdit: handleStartEdit,
    onCancelEdit: handleCancelEdit,
    onEditFormChange: setEditForm,
    createPending: createMutation.isPending,
    createError: createMutation.isError,
    updatePending: updateMutation.isPending,
    updateError: updateMutation.isError,
    setDefaultPendingId: setDefaultMutation.isPending ? (setDefaultMutation.variables as string) ?? null : null,
    deletePendingId: deleteMutation.isPending ? (deleteMutation.variables as string) ?? null : null,
    onCreateSubmit: () => createMutation.mutate(),
    onUpdateSubmit: () => updateMutation.mutate(),
    onSetDefault: (id: string) => setDefaultMutation.mutate(id),
    onDelete: (id: string) => deleteMutation.mutate(id),
    workflowPending: workflowMutation.isPending,
    onWorkflowChange: (providerId: string) => workflowMutation.mutate({ type: 'translate', providerId }),
    systemConfig: {
      systemConfigData: sysRes,
      systemConfigLoading: sysLoading,
      systemConfigError: sysError,
      overrides,
      dirty,
      savePending: sysSaveMutation.isPending,
      saveError: sysSaveMutation.isError,
      onOverrideChange: handleOverrideChange,
      onOverridesSave: () => sysSaveMutation.mutate(),
      onOverridesCancel: handleOverridesCancel,
    },
    inboxSettings: {
      settings: inboxSettings ?? {
        paperlessEnabled: false,
        paperlessTokenConfigured: false,
        paperlessOpenInNewTab: false,
        obsidianEnabled: false,
        obsidianInboxDir: 'Inbox',
        obsidianMemoDir: 'Inbox/Memo',
        obsidianConsolidationDir: 'Inbox/Consolidated',
        bookmarksAiAssistEnabled: false,
        bookmarksBulkImportEnabled: false,
        bookmarksStripTrackingParams: false,
        bookmarksDefaultUnread: false,
        bookmarksSmartGroupsEnabled: false,
        inboxAiAvailable: false,
      },
      isLoading: inboxSettingsQuery.isLoading,
      isUpdating: updateInboxSettingsMutation.isPending,
      updateError: updateInboxSettingsMutation.isError,
      workflowProviderId: inboxProviderId,
      isWorkflowUpdating: workflowPendingType === 'inbox',
      workflowUpdateError: workflowMutation.isError && workflowMutation.variables?.type === 'inbox',
      onUpdate: (update: InboxSettingsUpdateRequest) => updateInboxSettingsMutation.mutate(update),
      onWorkflowProviderSave: (providerId: string) => workflowMutation.mutate({ type: 'inbox', providerId }),
    },
  }

  return (
    <div className="nexus-page-enter mx-auto w-full max-w-[1180px] p-4 md:p-6">
      <SettingsDesktopView {...sharedProps} />
      <SettingsMobileView {...sharedProps} />
    </div>
  )
}
