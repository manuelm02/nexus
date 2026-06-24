import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../api/client'
import { settingsApi } from '../../api/settings.api'
import { subscriptionCategoryApi } from '../../api/subscriptionCategory.api'
import type { ApiResponse } from '../../types/api.types'
import type { LlmProvider, WorkflowLlmConfig, InboxSettings, InboxSettingsUpdateRequest, MindBankSettings, MindBankSettingsUpdateRequest } from '../../types/domain.types'
import type { ProviderFormData } from './components/ProviderForm'
import { SettingsDesktopView } from './SettingsDesktopView'
import type { SettingsTab } from './SettingsDesktopView'
import { SettingsMobileView } from './SettingsMobileView'

// SettingsPage 统一编排 LLM provider、workflow 覆盖和系统配置的查询与变更，桌面端和移动端共用业务逻辑。
export default function SettingsPage() {
  const initialTab = (() => {
    const tab = new URLSearchParams(window.location.search).get('tab')
    if (tab === 'workflows') return 'translate'
    return tab === 'translate' || tab === 'inbox' || tab === 'subscriptions' || tab === 'chat' || tab === 'crawl' || tab === 'notes' || tab === 'mindbank' ? tab : 'models'
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

  // --- 订阅分类 ---
  const { data: categoriesRes, isLoading: categoriesLoading } = useQuery({
    queryKey: ['subscription-categories'],
    queryFn: () => subscriptionCategoryApi.list(),
  })
  const subscriptionCategories = categoriesRes?.data?.data ?? []

  const createCategoryMutation = useMutation({
    mutationFn: (name: string) => subscriptionCategoryApi.create(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subscription-categories'] }),
  })

  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null)
  const deleteCategoryMutation = useMutation({
    mutationFn: (id: string) => subscriptionCategoryApi.delete(id),
    onMutate: (id) => setDeletingCategoryId(id),
    onSettled: () => setDeletingCategoryId(null),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subscription-categories'] }),
  })

  // --- Mindbank 设置 ---
  const mindbankSettingsQuery = useQuery({
    queryKey: ['settings', 'mindbank'],
    queryFn: () => settingsApi.getMindBankSettings(),
  })

  const mindbankSettings: MindBankSettings | undefined = mindbankSettingsQuery.data?.data?.data

  const updateMindBankSettingsMutation = useMutation({
    mutationFn: (data: MindBankSettingsUpdateRequest) => settingsApi.updateMindBankSettings(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings', 'mindbank'] })
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
  const subscriptionsWorkflow = workflows.find((w) => w.workflowType === 'subscriptions')
  const subscriptionsProviderId = subscriptionsWorkflow?.providerId ?? ''
  const chatWorkflow = workflows.find((w) => w.workflowType === 'chat')
  const chatProviderId = chatWorkflow?.providerId ?? ''
  const [translateProviderDraft, setTranslateProviderDraft] = useState(translateProviderId)
  const [subscriptionsProviderDraft, setSubscriptionsProviderDraft] = useState(subscriptionsProviderId)
  const [chatProviderDraft, setChatProviderDraft] = useState(chatProviderId)

  // 工作流配置由远程数据驱动；查询刷新后同步草稿，避免旧草稿覆盖后端新值。
  useEffect(() => {
    setTranslateProviderDraft(translateProviderId)
  }, [translateProviderId])

  useEffect(() => {
    setSubscriptionsProviderDraft(subscriptionsProviderId)
  }, [subscriptionsProviderId])

  useEffect(() => {
    setChatProviderDraft(chatProviderId)
  }, [chatProviderId])

  const workflowPendingType = workflowMutation.isPending ? workflowMutation.variables?.type : null
  const translateDirty = translateProviderDraft !== translateProviderId
  const subscriptionsDirty = subscriptionsProviderDraft !== subscriptionsProviderId
  const chatDirty = chatProviderDraft !== chatProviderId

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
    subscriptionsSettings: {
      providerId: subscriptionsProviderDraft,
      dirty: subscriptionsDirty,
      savePending: workflowPendingType === 'subscriptions',
      saveError: workflowMutation.isError && workflowMutation.variables?.type === 'subscriptions',
      onProviderChange: setSubscriptionsProviderDraft,
      onSave: () => workflowMutation.mutate({ type: 'subscriptions', providerId: subscriptionsProviderDraft }),
      onCancel: () => setSubscriptionsProviderDraft(subscriptionsProviderId),
    },
    chatSettings: {
      providerId: chatProviderDraft,
      dirty: chatDirty,
      savePending: workflowPendingType === 'chat',
      saveError: workflowMutation.isError && workflowMutation.variables?.type === 'chat',
      onProviderChange: setChatProviderDraft,
      onSave: () => workflowMutation.mutate({ type: 'chat', providerId: chatProviderDraft }),
      onCancel: () => setChatProviderDraft(chatProviderId),
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
    inboxSettings: {
      settings: inboxSettings ?? {
        paperlessEnabled: false,
        paperlessTokenConfigured: false,
        paperlessOpenInNewTab: false,
        obsidianEnabled: false,
        obsidianInboxDir: 'Inbox',
        obsidianMemoDir: 'Inbox/Memo',
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
    subscriptionCategories: {
      categories: subscriptionCategories,
      isLoading: categoriesLoading,
      isCreating: createCategoryMutation.isPending,
      isDeleting: deletingCategoryId,
      onCreate: (name: string) => createCategoryMutation.mutate(name),
      onDelete: (id: string) => deleteCategoryMutation.mutate(id),
    },
    mindbankSettings: {
      settings: mindbankSettings ?? {
        anythingllmUrl: '',
        minioUrl: '',
        minioBucket: '',
        obsidianSubFolder: '',
        anythingllmApiKeyConfigured: false,
        minioAccessKeyConfigured: false,
        minioSecretKeyConfigured: false,
        mindbankClassifyProviderId: '',
        mindbankOrganizeProviderId: '',
        mindbankCondenseProviderId: '',
        pipelineAutoSessionNote: true,
        providers: [],
      },
      isLoading: mindbankSettingsQuery.isLoading,
      isUpdating: updateMindBankSettingsMutation.isPending,
      updateError: updateMindBankSettingsMutation.isError,
      onUpdate: (update: MindBankSettingsUpdateRequest) => updateMindBankSettingsMutation.mutate(update),
    },
  }

  return (
    <div className="nexus-page-enter mx-auto w-full max-w-[1180px] p-4 md:p-6">
      <SettingsDesktopView {...sharedProps} />
      <SettingsMobileView {...sharedProps} />
    </div>
  )
}
