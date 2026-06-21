import { CheckCircle2, Loader2, XCircle, Circle, AlertCircle } from 'lucide-react'
import { cn } from '../../../lib/utils'
import {
  PIPELINE_STEPS,
  getStepStatusField,
  type MindBankDocument,
  type PipelineStepStatus,
} from '../../../types/mindbank.types'

/**
 * PipelineStatus 5 步流水线状态可视化组件。
 * - pending：灰色圆点
 * - processing：蓝色 spinner（与品牌色一致）
 * - done：绿色对勾
 * - failed：红色叉（hover 展示 stepErrorMsg tooltip）
 */
export function PipelineStatus({
  document,
  onRetryStep,
}: {
  document: MindBankDocument
  onRetryStep?: (step: number) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
      {PIPELINE_STEPS.map((def, idx) => {
        const status = document[getStepStatusField(def.step)] as PipelineStepStatus
        return (
          <div key={def.step} className="flex items-center gap-1.5">
            <StepBadge
              step={def.step}
              label={def.label}
              status={status}
              errorMsg={document.stepErrorMsg}
              onRetry={onRetryStep}
            />
            {idx < PIPELINE_STEPS.length - 1 && (
              <span className="text-muted-foreground/30">·</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

/** 单个步骤的徽章：状态图标 + 文字标签 + 错误 tooltip + 重试按钮 */
function StepBadge({
  step,
  label,
  status,
  errorMsg,
  onRetry,
}: {
  step: number
  label: string
  status: PipelineStepStatus
  errorMsg: string | null
  onRetry?: (step: number) => void
}) {
  const { Icon, color, spin } = statusIcon(status)

  // 失败状态下 tooltip 展示错误信息，并提供重试入口
  if (status === 'failed') {
    return (
      <div className="group relative inline-flex items-center gap-1">
        <span className={cn('inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold', color)}>
          <Icon className={cn('h-3 w-3', spin && 'animate-spin')} />
          {step}.{label}
        </span>
        {/* hover 气泡：错误信息 + 重试按钮 */}
        <div className="pointer-events-none absolute bottom-full left-0 z-10 mb-1 w-56 rounded-md border bg-popover p-2 text-[11px] text-popover-foreground opacity-0 shadow-lg transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
          <p className="font-bold text-destructive">第 {step} 步失败</p>
          <p className="mt-1 line-clamp-4 leading-5 text-muted-foreground">
            {errorMsg || '未知错误'}
          </p>
          {onRetry && (
            <button
              type="button"
              onClick={() => onRetry(step)}
              className="mt-2 inline-flex h-6 w-full items-center justify-center rounded border border-primary bg-primary/10 text-[10px] font-bold text-primary hover:bg-primary/20"
            >
              重试第 {step} 步
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold',
        color,
      )}
    >
      <Icon className={cn('h-3 w-3', spin && 'animate-spin')} />
      {step}.{label}
    </span>
  )
}

/** Pipeline 步骤状态 → 图标 + 颜色 + spin 标记 */
function statusIcon(status: PipelineStepStatus): {
  Icon: typeof Circle
  color: string
  spin: boolean
} {
  switch (status) {
    case 'pending':
      return { Icon: Circle, color: 'bg-muted text-muted-foreground', spin: false }
    case 'processing':
      return { Icon: Loader2, color: 'bg-primary/10 text-primary', spin: true }
    case 'done':
      return { Icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', spin: false }
    case 'failed':
      return { Icon: XCircle, color: 'bg-destructive/10 text-destructive', spin: false }
  }
}

/**
 * DocumentListEmpty 空态：workspace 无文档时显示引导。
 */
export function DocumentListEmpty({ workspaceId }: { workspaceId: number | null }) {
  if (workspaceId == null) {
    return (
      <div className="nexus-surface flex flex-col items-center justify-center gap-2 p-8 text-center">
        <AlertCircle className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm font-bold text-foreground">请先选择或创建一个 Workspace</p>
        <p className="text-xs text-muted-foreground">左侧列表选择，或点击"新建 Workspace"。</p>
      </div>
    )
  }
  return (
    <div className="nexus-surface flex flex-col items-center justify-center gap-2 p-8 text-center">
      <AlertCircle className="h-8 w-8 text-muted-foreground/40" />
      <p className="text-sm font-bold text-foreground">还没有文档</p>
      <p className="text-xs text-muted-foreground">点击右上"添加文件"从 Crawl 文件中导入。</p>
    </div>
  )
}
