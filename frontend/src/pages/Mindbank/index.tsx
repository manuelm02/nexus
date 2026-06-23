import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { mindbankApi } from '../../api/mindbank.api'
import type { MindBankTab, Workspace, CreateWorkspaceRequest, UpdateWorkspaceRequest } from '../../types/mindbank.types'
import { MindBankDesktopView } from './MindBankDesktopView'
import { MindBankMobileView } from './MindBankMobileView'

/**
 * MindbankPage 是知识沉淀流程的入口页面（Phase 6.5：Port 抽象 + 核心 UI）。
 * 业务逻辑单写一套：数据查询、mutations、tab 状态、选中 workspace 状态、文件选择等。
 * 视图层通过响应式 class 拆分到 MindBankDesktopView / MindBankMobileView。
 *
 * 当前阶段：
 * - 文件/入库 Tab：Workspace CRUD + 文档列表 + 5 步 Pipeline 状态可视化
 * - Q&A Tab：支持普通 RAG 与 Agent 检索模式
 * - Agent 知识管家 Tab：巡检 + 建议 + 轨迹可视化
 */
export default function MindbankPage() {
  const qc = useQueryClient()

  // ==================== 状态 ====================
  const [activeTab, setActiveTab] = useState<MindBankTab>('documents')
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<number | null>(null)
  const [workspaceDialogOpen, setWorkspaceDialogOpen] = useState(false)
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null)
  const [filePickerOpen, setFilePickerOpen] = useState(false)

  // ==================== 数据查询 ====================
  const workspacesQuery = useQuery({
    queryKey: ['mindbank', 'workspaces'],
    queryFn: async () => {
      const res = await mindbankApi.listWorkspaces()
      return res.data.data ?? []
    },
  })

  // 第一次加载后默认选中第一个 workspace
  const workspaces = useMemo(() => workspacesQuery.data ?? [], [workspacesQuery.data])
  const effectiveSelectedId =
    selectedWorkspaceId ?? (workspaces.length > 0 ? workspaces[0].id : null)
  const selectedWorkspace = useMemo(
    () => workspaces.find((w) => w.id === effectiveSelectedId) ?? null,
    [workspaces, effectiveSelectedId],
  )

  // ==================== Mutations ====================
  const createWorkspaceMutation = useMutation({
    mutationFn: (data: CreateWorkspaceRequest) => mindbankApi.createWorkspace(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mindbank', 'workspaces'] })
      setWorkspaceDialogOpen(false)
    },
  })

  const updateWorkspaceMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateWorkspaceRequest }) =>
      mindbankApi.updateWorkspace(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mindbank', 'workspaces'] })
      setWorkspaceDialogOpen(false)
      setEditingWorkspace(null)
    },
  })

  const deleteWorkspaceMutation = useMutation({
    mutationFn: (id: number) => mindbankApi.deleteWorkspace(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mindbank', 'workspaces'] })
      // 删除后清除选中态，自动落到第一个
      setSelectedWorkspaceId(null)
    },
  })

  // ==================== 文档查询 ====================
  const documentsQuery = useQuery({
    queryKey: ['mindbank', 'documents', effectiveSelectedId],
    queryFn: async () => {
      if (effectiveSelectedId == null) return []
      const res = await mindbankApi.listDocuments(effectiveSelectedId)
      return res.data.data ?? []
    },
    enabled: effectiveSelectedId != null && activeTab === 'documents',
    // Pipeline 还在跑时不要让旧数据一直停留：3s refetch 配合上层 useQuery refetchInterval
    refetchInterval: (query) => {
      const docs = query.state.data
      // 任一文档处于 processing 状态则 3s 轮询
      if (docs && Array.isArray(docs) && docs.some((d) => d.pipelineStatus === 'processing')) {
        return 3000
      }
      return false
    },
  })

  // ==================== Handlers ====================
  const handleOpenCreate = () => {
    setEditingWorkspace(null)
    setWorkspaceDialogOpen(true)
  }

  const handleOpenEdit = (workspace: Workspace) => {
    setEditingWorkspace(workspace)
    setWorkspaceDialogOpen(true)
  }

  const handleSubmitWorkspace = (data: CreateWorkspaceRequest) => {
    if (editingWorkspace) {
      const payload: UpdateWorkspaceRequest = {
        name: data.name,
        domainTag: data.domainTag,
        description: data.description,
      }
      updateWorkspaceMutation.mutate({ id: editingWorkspace.id, data: payload })
    } else {
      createWorkspaceMutation.mutate(data)
    }
  }

  const handleDeleteWorkspace = (id: number) => {
    deleteWorkspaceMutation.mutate(id)
  }

  const handleRetryStep = (docId: number, step: number) => {
    mindbankApi.retryStep(docId, step).then(() => {
      qc.invalidateQueries({ queryKey: ['mindbank', 'documents', effectiveSelectedId] })
    })
  }

  // ==================== Props 组装 ====================
  const sharedProps = {
    activeTab,
    onTabChange: setActiveTab,
    workspaces,
    selectedWorkspaceId: effectiveSelectedId,
    onSelectWorkspace: setSelectedWorkspaceId,
    onOpenCreate: handleOpenCreate,
    onEditWorkspace: handleOpenEdit,
    onDeleteWorkspace: handleDeleteWorkspace,
    isLoadingWorkspaces: workspacesQuery.isLoading,
    selectedWorkspace,
    documents: documentsQuery.data ?? [],
    isLoadingDocuments: documentsQuery.isLoading,
    onOpenFilePicker: () => setFilePickerOpen(true),
    onRetryStep: handleRetryStep,
    isCreatingWorkspace: createWorkspaceMutation.isPending,
    isUpdatingWorkspace: updateWorkspaceMutation.isPending,
    isDeletingWorkspace: deleteWorkspaceMutation.isPending,
    workspaceDialogOpen,
    editingWorkspace,
    onCloseWorkspaceDialog: () => {
      setWorkspaceDialogOpen(false)
      setEditingWorkspace(null)
    },
    onSubmitWorkspace: handleSubmitWorkspace,
    workspaceSubmitError:
      createWorkspaceMutation.isError || updateWorkspaceMutation.isError
        ? (createWorkspaceMutation.error as Error)?.message ||
          (updateWorkspaceMutation.error as Error)?.message ||
          '保存失败'
        : undefined,
    filePickerOpen,
    onCloseFilePicker: () => setFilePickerOpen(false),
    onImported: () => {
      qc.invalidateQueries({ queryKey: ['mindbank', 'documents', effectiveSelectedId] })
      setFilePickerOpen(false)
    },
  }

  return (
    <>
      <MindBankDesktopView {...sharedProps} />
      <MindBankMobileView {...sharedProps} />
    </>
  )
}
