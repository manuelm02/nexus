import { useQuery } from '@tanstack/react-query'
import { mindbankApi } from '../../../api/mindbank.api'
import { AgentTraceView } from './AgentTraceView'
import { Loader2 } from 'lucide-react'

// AgentTraceLoader 按 agentTaskId 查询任务详情并渲染 Agent 执行轨迹，供 Q&A 视图展示思考过程。
export function AgentTraceLoader({ agentTaskId }: { agentTaskId: number }) {
  const detailQuery = useQuery({
    queryKey: ['mindbank', 'agent', 'task', agentTaskId],
    queryFn: async () => {
      const res = await mindbankApi.getAgentTaskDetail(agentTaskId)
      return res.data.data ?? null
    },
    enabled: agentTaskId != null,
  })

  if (detailQuery.isLoading) {
    return (
      <div className="flex items-center gap-1.5 py-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        加载轨迹...
      </div>
    )
  }

  if (detailQuery.isError || !detailQuery.data) {
    return <p className="py-2 text-xs text-muted-foreground">轨迹加载失败</p>
  }

  return <AgentTraceView steps={detailQuery.data.steps} />
}
