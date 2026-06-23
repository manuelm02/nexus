import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Brain, Loader2, ChevronDown, ChevronRight, History } from 'lucide-react'
import { mindbankApi } from '../../../api/mindbank.api'
import type { AgentTask, AgentTaskDetail, SuggestionExecuteResult } from '../../../types/mindbank.types'
import { InspectionReport } from './InspectionReport'
import { AgentTraceView } from './AgentTraceView'
import { InspectionHistory } from './InspectionHistory'

/**
 * Agent 知识管家 Tab：知识库巡检入口组件。
 * 自包含所有 Agent 相关的 query/mutation/state，不依赖外部 Workspace 选中状态（巡检是全局性的）。
 * 桌面端和移动端共用此组件，通过 Tailwind responsive class 适配差异。
 */
export function AgentTab() {
  const qc = useQueryClient()
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null)
  const [traceExpanded, setTraceExpanded] = useState(false)
  const [ignoringId, setIgnoringId] = useState<number | null>(null)

  // ==================== 查询：巡检任务列表 ====================
  // 有 running 任务时 3s 轮询，否则不轮询
  const tasksQuery = useQuery({
    queryKey: ['mindbank', 'agent', 'tasks'],
    queryFn: async () => {
      const res = await mindbankApi.listAgentTasks()
      return res.data.data ?? []
    },
    refetchInterval: (query) => {
      const tasks = query.state.data
      if (tasks && tasks.some((t) => t.status === 'running' || t.status === 'pending')) {
        return 3000
      }
      return false
    },
  })

  const tasks: AgentTask[] = tasksQuery.data ?? []

  // 默认选中：优先 awaiting_approval，其次 running，最后最新一条
  useEffect(() => {
    if (selectedTaskId == null && tasks.length > 0) {
      const priority =
        tasks.find((t) => t.status === 'awaiting_approval') ??
        tasks.find((t) => t.status === 'running') ??
        tasks[0]
      setSelectedTaskId(priority.id)
    }
  }, [tasks, selectedTaskId])

  // ==================== 查询：选中任务详情 ====================
  // running/pending 时 3s 轮询，结束后停止
  const taskDetailQuery = useQuery({
    queryKey: ['mindbank', 'agent', 'task', selectedTaskId],
    queryFn: async () => {
      if (selectedTaskId == null) return null
      const res = await mindbankApi.getAgentTaskDetail(selectedTaskId)
      return res.data.data ?? null
    },
    enabled: selectedTaskId != null,
    refetchInterval: (query) => {
      const detail = query.state.data as AgentTaskDetail | null
      if (detail && (detail.task.status === 'running' || detail.task.status === 'pending')) {
        return 3000
      }
      return false
    },
  })

  const taskDetail: AgentTaskDetail | null = taskDetailQuery.data ?? null
  const isRunning = taskDetail?.task.status === 'running' || taskDetail?.task.status === 'pending'
  const hasSuggestions = (taskDetail?.suggestions?.length ?? 0) > 0

  // ==================== Mutation：触发巡检 ====================
  const triggerMutation = useMutation({
    mutationFn: () => mindbankApi.triggerInspection(),
    onSuccess: (res) => {
      const taskId = res.data.data?.taskId
      if (taskId) {
        setSelectedTaskId(taskId)
        setTraceExpanded(false)
        qc.invalidateQueries({ queryKey: ['mindbank', 'agent', 'tasks'] })
      }
    },
  })

  // ==================== Mutation：采纳/忽略建议 ====================
  // 采纳改为异步，等待 SuggestionExecuteResult 返回给 SuggestionCard 展示
  const approveMutation = useMutation({
    mutationFn: (id: number) => mindbankApi.approveSuggestion(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mindbank', 'agent', 'task', selectedTaskId] })
    },
  })

  const handleApprove = async (id: number): Promise<SuggestionExecuteResult> => {
    const res = await approveMutation.mutateAsync(id)
    const result = res.data.data
    if (!result) throw new Error('服务器未返回执行结果')
    return result
  }

  const ignoreMutation = useMutation({
    mutationFn: (id: number) => mindbankApi.ignoreSuggestion(id),
    onMutate: (id) => setIgnoringId(id),
    onSuccess: () => {
      setIgnoringId(null)
      qc.invalidateQueries({ queryKey: ['mindbank', 'agent', 'task', selectedTaskId] })
    },
    onError: () => setIgnoringId(null),
  })

  return (
    <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
      {/* 顶部操作区 */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-foreground md:text-xl">Agent 知识管家</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            AI 自动巡检知识库体系性，发现问题并提出建议
          </p>
        </div>
        <button
          type="button"
          onClick={() => triggerMutation.mutate()}
          disabled={triggerMutation.isPending || isRunning}
          className="nexus-button-primary inline-flex h-9 items-center gap-1.5 px-3.5 text-sm font-bold disabled:opacity-50"
        >
          {triggerMutation.isPending || isRunning ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Brain className="h-4 w-4" />
          )}
          {isRunning ? '正在巡检...' : '巡检知识库'}
        </button>
      </div>

      {/* 错误提示 */}
      {triggerMutation.isError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-600 dark:text-red-400">
          触发巡检失败：{(triggerMutation.error as Error)?.message ?? '未知错误'}
        </div>
      )}

      {/* 任务详情区 */}
      {taskDetail && (
        <div className="space-y-4">
          {/* 状态摘要 */}
          <div className="nexus-surface flex items-center gap-3 p-3">
            {isRunning && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-blue-500" />}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground">
                {isRunning
                  ? '正在巡检知识库...'
                  : taskDetail.task.status === 'failed'
                    ? '巡检失败'
                    : taskDetail.task.status === 'awaiting_approval'
                      ? '巡检完成，等待审批'
                      : '巡检完成'}
              </p>
              {taskDetail.task.summary && (
                <p className="mt-0.5 text-xs text-muted-foreground">{taskDetail.task.summary}</p>
              )}
            </div>
          </div>

          {/* 巡检报告：有建议时展示 */}
          {hasSuggestions && (
            <div>
              <h3 className="mb-2 text-sm font-bold text-foreground">
                巡检建议（{taskDetail.suggestions.length} 条）
              </h3>
              <InspectionReport
                suggestions={taskDetail.suggestions}
                onApprove={handleApprove}
                onIgnore={(id) => ignoreMutation.mutate(id)}
                ignoringId={ignoringId}
              />
            </div>
          )}

          {/* 执行轨迹：可折叠 */}
          {taskDetail.steps.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setTraceExpanded(!traceExpanded)}
                className="flex w-full items-center gap-1.5 text-sm font-bold text-foreground"
              >
                {traceExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                执行轨迹（{taskDetail.steps.length} 步）
              </button>
              {traceExpanded && (
                <div className="mt-2 nexus-surface p-3">
                  <AgentTraceView steps={taskDetail.steps} />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 空状态提示 */}
      {!taskDetail && !tasksQuery.isLoading && (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <Brain className="h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium text-foreground">还没有巡检记录</p>
          <p className="max-w-xs text-xs leading-5 text-muted-foreground">
            点击上方"巡检知识库"按钮，AI 将自动检查知识库的体系性并给出建议
          </p>
        </div>
      )}

      {/* 历史巡检区 */}
      {tasks.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-1.5">
            <History className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-bold text-foreground">历史巡检</h3>
          </div>
          <InspectionHistory
            tasks={tasks}
            selectedTaskId={selectedTaskId}
            onSelect={setSelectedTaskId}
          />
        </div>
      )}
    </div>
  )
}
