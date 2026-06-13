import * as Select from '@radix-ui/react-select'
import { Check, ChevronDown, AlertCircle } from 'lucide-react'
import type { LlmProvider, WorkflowLlmConfig } from '../../../types/domain.types'

type WorkflowOverrideSectionProps = {
  providers: LlmProvider[]
  translateWorkflow: WorkflowLlmConfig | undefined
  translateProviderId: string
  workflowsLoading: boolean
  workflowsError: boolean
  workflowPending: boolean
  onWorkflowChange: (providerId: string) => void
}

// WorkflowOverrideSection 展示工作流覆盖配置，目前仅服务 Translate，但命名和结构为未来扩展预留空间。
export function WorkflowOverrideSection({
  providers, translateProviderId, workflowsLoading, workflowsError,
  workflowPending, onWorkflowChange,
}: WorkflowOverrideSectionProps) {
  return (
    <section className="nexus-surface space-y-4 p-4">
      <div>
        <h2 className="text-lg font-extrabold text-foreground">工作流覆盖</h2>
        <p className="text-sm leading-7 text-muted-foreground">
          为特定工作流指定专属 provider。未覆盖时自动继承全局默认模型。
        </p>
      </div>

      {/* Translate 覆盖项 */}
      <div className="rounded-xl border border-border bg-muted/40 px-4 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <span className="text-sm font-bold text-foreground">Translate</span>
            <p className="text-xs leading-6 text-muted-foreground">
              翻译工作流的 LLM 增强阶段使用的 provider。
              选择「继承全局默认」将使用默认模型；选择具体 provider 则仅 Translate 生效。
            </p>
          </div>
          <Select.Root
            value={translateProviderId || '__inherit__'}
            onValueChange={(value) => {
              // 选「继承全局默认」时传空串，后端 updateWorkflowConfig 会将其转为 null 清除绑定
              const id = value === '__inherit__' ? '' : value
              onWorkflowChange(id)
            }}
            disabled={workflowPending || providers.length === 0}
          >
            <Select.Trigger className="nexus-input inline-flex h-10 md:h-9 w-full shrink-0 items-center justify-between gap-2 px-3 text-sm shadow-none hover:bg-accent/40 disabled:opacity-50 sm:w-[260px]">
              <Select.Value placeholder="继承全局默认" />
              <Select.Icon><ChevronDown className="h-4 w-4 text-muted-foreground" /></Select.Icon>
            </Select.Trigger>
            <Select.Portal>
              <Select.Content position="popper" sideOffset={6} className="z-[70] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg">
                <Select.Viewport>
                  {/* Radix Select 不允许 value=""，用 __inherit__ 作为"继承全局默认"的 sentinel */}
                  <Select.Item value="__inherit__" className="relative flex h-10 cursor-default select-none items-center rounded-lg px-9 text-sm font-semibold outline-none transition-colors data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground">
                    <Select.ItemIndicator className="absolute left-3 flex h-4 w-4 items-center justify-center text-primary"><Check className="h-3.5 w-3.5" /></Select.ItemIndicator>
                    <Select.ItemText>继承全局默认</Select.ItemText>
                  </Select.Item>
                  {providers.map((provider) => (
                    <Select.Item key={provider.id} value={provider.id} className="relative flex h-10 cursor-default select-none items-center rounded-lg px-9 text-sm font-semibold outline-none transition-colors data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground">
                      <Select.ItemIndicator className="absolute left-3 flex h-4 w-4 items-center justify-center text-primary"><Check className="h-3.5 w-3.5" /></Select.ItemIndicator>
                      <Select.ItemText>{provider.name} · {provider.model}</Select.ItemText>
                    </Select.Item>
                  ))}
                </Select.Viewport>
              </Select.Content>
            </Select.Portal>
          </Select.Root>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {workflowPending ? '保存中...' : '自动保存'}
        </p>
      </div>

      {workflowsLoading && <p className="text-sm text-muted-foreground">加载中…</p>}
      {workflowsError && (
        <p className="flex items-center gap-1.5 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" /> 加载工作流配置失败
        </p>
      )}

      {/* 未来可扩展更多工作流覆盖项 */}
      {providers.length === 0 && (
        <p className="text-xs text-muted-foreground">添加 Provider 后可在此为各工作流指定模型。</p>
      )}
    </section>
  )
}
