import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { AgentStep } from '../../../types/mindbank.types'

/** Agent 执行轨迹组件：逐步展示 Agent 的思考、工具调用和返回结果，支持展开查看详情 */
export function AgentTraceView({ steps }: { steps: AgentStep[] }) {
  if (steps.length === 0) {
    return <p className="py-4 text-center text-xs text-muted-foreground">暂无执行轨迹</p>
  }

  return (
    <div className="space-y-1.5">
      {steps.map((step) => (
        <TraceStepItem key={step.id} step={step} />
      ))}
    </div>
  )
}

/** 单个轨迹步骤：思考 / 工具调用 / 最终结论 */
function TraceStepItem({ step }: { step: AgentStep }) {
  const [expanded, setExpanded] = useState(false)

  // 有工具调用的步骤：可展开查看入参和返回
  if (step.toolCalled) {
    return (
      <div className="text-xs border-l-2 border-blue-500/40 pl-3 py-1.5">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-start gap-1 text-left"
        >
          {expanded ? (
            <ChevronDown className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
          )}
          <span className="flex-1">
            {step.thought && (
              <span className="block italic text-muted-foreground/80 mb-0.5">{step.thought}</span>
            )}
            <span className="font-bold text-blue-600 dark:text-blue-400">
              🔧 调用 {step.toolCalled}
            </span>
          </span>
        </button>
        {expanded && (
          <div className="mt-2 ml-4 space-y-2">
            {step.toolInput && (
              <div>
                <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  入参
                </p>
                <pre className="overflow-x-auto rounded bg-muted/50 p-2 text-[10px] leading-relaxed">
                  {formatJson(step.toolInput)}
                </pre>
              </div>
            )}
            {step.toolOutput && (
              <div>
                <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  返回
                </p>
                <pre className="overflow-x-auto rounded bg-muted/50 p-2 text-[10px] leading-relaxed max-h-48 overflow-y-auto">
                  {truncate(step.toolOutput, 2000)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // 纯思考或最终结论步骤
  return (
    <div className="text-xs border-l-2 border-muted-foreground/30 pl-3 py-1.5">
      <span className="italic text-muted-foreground">
        {step.thought ?? '（无输出）'}
      </span>
    </div>
  )
}

/** 尝试格式化 JSON 字符串，失败则原样返回 */
function formatJson(str: string): string {
  try {
    return JSON.stringify(JSON.parse(str), null, 2)
  } catch {
    return str
  }
}

/** 截断长文本，超过 maxLen 时尾部加省略号 */
function truncate(str: string, maxLen: number): string {
  return str.length > maxLen ? str.substring(0, maxLen) + '\n...' : str
}
