import type { AgentTask, AgentTaskStatus } from '../../../types/mindbank.types'
import { cn } from '../../../lib/utils'

// InspectionHistory 历史巡检时间线：按时间倒序展示历次巡检任务，点击可查看详情。
export function InspectionHistory({
  tasks,
  selectedTaskId,
  onSelect,
}: {
  tasks: AgentTask[]
  selectedTaskId: number | null
  onSelect: (id: number) => void
}) {
  if (tasks.length === 0) {
    return (
      <p className="py-4 text-center text-xs text-muted-foreground">暂无巡检记录</p>
    )
  }

  return (
    <div className="space-y-2">
      {tasks.map((task) => (
        <button
          key={task.id}
          type="button"
          onClick={() => onSelect(task.id)}
          className={cn(
            'w-full text-left nexus-surface p-3 transition-opacity hover:opacity-80',
            selectedTaskId === task.id && 'ring-2 ring-primary/40',
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-foreground">
              {formatDate(task.createdAt)}
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground">
                {task.triggerType === 'auto' ? '自动' : '手动'}
              </span>
              <TaskStatusBadge status={task.status as AgentTaskStatus} />
            </div>
          </div>
          {task.summary && (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground line-clamp-2">
              {task.summary}
            </p>
          )}
        </button>
      ))}
    </div>
  )
}

/** 任务状态 badge */
function TaskStatusBadge({ status }: { status: AgentTaskStatus }) {
  const styles: Record<AgentTaskStatus, string> = {
    pending: 'bg-muted text-muted-foreground',
    running: 'bg-accent-soft text-primary',
    awaiting_approval: 'bg-warning-soft text-warning',
    done: 'bg-success-soft text-success',
    failed: 'bg-destructive-soft text-destructive',
  }
  const labels: Record<AgentTaskStatus, string> = {
    pending: '等待中',
    running: '巡检中',
    awaiting_approval: '待审批',
    done: '已完成',
    failed: '失败',
  }
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}

/** 格式化 ISO 日期为简短中文格式 */
function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
