import * as Select from '@radix-ui/react-select'
import { Check, ChevronDown } from 'lucide-react'
import type { LlmProvider } from '../../../types/domain.types'

type WorkflowModelSelectProps = {
  providers: LlmProvider[]
  value: string
  onChange: (providerId: string) => void
  disabled?: boolean
  className?: string
}

const INHERIT_VALUE = '__inherit__'

// WorkflowModelSelect 统一 Settings 中工作流模型选择的视觉和“继承默认”语义。
export function WorkflowModelSelect({ providers, value, onChange, disabled, className }: WorkflowModelSelectProps) {
  return (
    <Select.Root
      value={value || INHERIT_VALUE}
      onValueChange={(nextValue) => onChange(nextValue === INHERIT_VALUE ? '' : nextValue)}
      disabled={disabled || providers.length === 0}
    >
      <Select.Trigger className={className ?? 'nexus-input inline-flex h-10 w-full items-center justify-between gap-2 px-3 text-sm shadow-none hover:bg-accent/40 disabled:opacity-50'}>
        <Select.Value placeholder="继承全局默认" />
        <Select.Icon>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={6}
          className="z-[70] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg"
        >
          <Select.Viewport>
            {/* Radix Select 不允许空 value，因此用 sentinel 表示继承全局默认。 */}
            <Select.Item value={INHERIT_VALUE} className="relative flex min-h-10 cursor-default select-none items-center rounded-lg px-9 py-2 text-sm font-semibold outline-none transition-colors data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground">
              <Select.ItemIndicator className="absolute left-3 flex h-4 w-4 items-center justify-center text-primary">
                <Check className="h-3.5 w-3.5" />
              </Select.ItemIndicator>
              <Select.ItemText>继承全局默认</Select.ItemText>
            </Select.Item>
            {providers.map((provider) => (
              <Select.Item
                key={provider.id}
                value={provider.id}
                className="relative flex min-h-10 cursor-default select-none items-center rounded-lg px-9 py-2 text-sm font-semibold outline-none transition-colors data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
              >
                <Select.ItemIndicator className="absolute left-3 flex h-4 w-4 items-center justify-center text-primary">
                  <Check className="h-3.5 w-3.5" />
                </Select.ItemIndicator>
                <Select.ItemText>
                  {provider.name} · {provider.model || '未指定模型'}{provider.enabled ? '' : ' · 已禁用'}
                </Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  )
}
