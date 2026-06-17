import * as Select from '@radix-ui/react-select'
import { Check, ChevronDown, Sparkles } from 'lucide-react'
import { cn } from '../../../lib/utils'

type CategoryInputProps = {
  value: string
  onChange: (value: string) => void
  subscriptionName: string
  notes?: string
  categories: string[]
  onAiSuggest: () => void
  isAiLoading: boolean
}

// CategoryInput 将分类改为下拉选择，支持 AI 自动识别分类；当前值不在选项中时临时插入选项避免显示空白。
export function CategoryInput({ value, onChange, subscriptionName, categories, onAiSuggest, isAiLoading }: CategoryInputProps) {
  const options = categories.length > 0 && value && !categories.includes(value)
    ? [value, ...categories]
    : categories

  return (
    <div className="relative">
      <Select.Root value={value} onValueChange={onChange}>
        <Select.Trigger
          className={cn(
            'nexus-input inline-flex h-10 w-full items-center justify-between gap-2 pr-10 pl-3 text-sm font-semibold shadow-none focus:outline-none focus:ring-2 focus:ring-ring',
            !value && 'text-muted-foreground',
          )}
        >
          <Select.Value placeholder={categories.length === 0 ? '暂无分类，点击右侧按钮 AI 自动生成' : '选择分类'} />
          <Select.Icon>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content
            position="popper"
            sideOffset={6}
            className="z-[90] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg"
          >
            <Select.Viewport>
              {options.length === 0 ? (
                <div className="px-3 py-2 text-xs text-muted-foreground">暂无分类，点击右侧按钮 AI 自动生成</div>
              ) : (
                options.map((option) => (
                  <Select.Item
                    key={option}
                    value={option}
                    className="relative flex h-9 cursor-default select-none items-center rounded-md px-8 text-sm font-semibold outline-none data-[highlighted]:bg-accent"
                  >
                    <Select.ItemIndicator className="absolute left-2 flex h-4 w-4 items-center justify-center text-primary">
                      <Check className="h-3.5 w-3.5" />
                    </Select.ItemIndicator>
                    <Select.ItemText>{option}</Select.ItemText>
                  </Select.Item>
                ))
              )}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>

      <button
        type="button"
        disabled={!subscriptionName.trim() || isAiLoading}
        onClick={onAiSuggest}
        className={cn(
          'absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors',
          'text-muted-foreground hover:text-primary hover:bg-accent disabled:opacity-40',
          isAiLoading && 'animate-pulse',
        )}
        aria-label="自动分类"
        title="自动分类"
      >
        <Sparkles className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
