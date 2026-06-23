import { useEffect, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { Subscription } from '../../../types/domain.types'
import { SubscriptionFormFields, formValuesToPayload, subscriptionToFormValues, type SubscriptionFormValues, type SubscriptionPayload } from './SubscriptionFormFields'

type SubscriptionFormDialogProps = {
  open: boolean
  item: Subscription | null
  initialBillingType?: string
  saving: boolean
  categories: string[]
  onAiSuggestCategory: (name: string, notes?: string) => Promise<string | undefined>
  isAiSuggesting: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (payload: SubscriptionPayload, id?: string) => void
}

// SubscriptionFormDialog 在桌面端表现为居中弹窗，在移动端转为底部 sheet，与 ToDo 详情弹层保持一致的响应式模式。
export function SubscriptionFormDialog({ open, item, initialBillingType, saving, categories, onAiSuggestCategory, isAiSuggesting, onOpenChange, onSubmit }: SubscriptionFormDialogProps) {
  const [values, setValues] = useState<SubscriptionFormValues>(() => subscriptionToFormValues(item, initialBillingType))

  useEffect(() => {
    if (open) setValues(subscriptionToFormValues(item, initialBillingType))
  }, [item, open, initialBillingType])

  const handleSubmit = () => {
    if (!values.name.trim()) return
    onSubmit(formValuesToPayload(values, item), item?.id)
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" />
        <Dialog.Content className="nexus-surface fixed inset-x-0 bottom-0 top-auto z-50 max-h-[85dvh] w-full translate-x-0 translate-y-0 overflow-y-auto rounded-b-none rounded-t-2xl p-3 sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:w-[calc(100vw-2rem)] sm:max-w-2xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg sm:p-4">
          <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-muted-foreground/25 sm:hidden" />
          <div className="flex items-center justify-between gap-3">
            <Dialog.Title className="text-sm font-black sm:text-base sm:font-semibold">{item ? '编辑订阅' : '添加订阅'}</Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" className="nexus-button-utility hidden h-9 w-9 text-muted-foreground sm:inline-flex" aria-label="关闭">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="mt-3 sm:mt-4">
            <SubscriptionFormFields
              values={values}
              editing={!!item}
              item={item}
              categories={categories}
              onAiSuggestCategory={onAiSuggestCategory}
              isAiSuggesting={isAiSuggesting}
              onChange={setValues}
            />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 border-t pt-3 sm:mt-5 sm:flex sm:flex-row sm:items-center sm:justify-end sm:pt-4">
            <Dialog.Close asChild>
              <button type="button" className="nexus-button-utility h-10 px-3 text-sm">取消</button>
            </Dialog.Close>
            <button type="button" disabled={saving || !values.name.trim()} onClick={handleSubmit} className="nexus-button-primary h-10 px-4 text-sm">
              保存
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
