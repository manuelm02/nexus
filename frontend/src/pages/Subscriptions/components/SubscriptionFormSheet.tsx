import { useEffect, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import type { Subscription } from '../../../types/domain.types'
import { SubscriptionFormFields, formValuesToPayload, subscriptionToFormValues, type SubscriptionFormValues, type SubscriptionPayload } from './SubscriptionFormFields'

type SubscriptionFormSheetProps = {
  open: boolean
  item: Subscription | null
  saving: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (payload: SubscriptionPayload, id?: string) => void
}

// SubscriptionFormSheet 在移动端以底部 sheet 承载订阅创建/编辑表单。
export function SubscriptionFormSheet({ open, item, saving, onOpenChange, onSubmit }: SubscriptionFormSheetProps) {
  const [values, setValues] = useState<SubscriptionFormValues>(() => subscriptionToFormValues(item))

  useEffect(() => {
    if (open) setValues(subscriptionToFormValues(item))
  }, [item, open])

  const handleSubmit = () => {
    if (!values.name.trim()) return
    onSubmit(formValuesToPayload(values, item), item?.id)
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" />
        <Dialog.Content className="nexus-surface fixed inset-x-0 bottom-0 z-50 max-h-[88dvh] overflow-y-auto rounded-b-none rounded-t-2xl p-3">
          <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-muted-foreground/25" />
          <Dialog.Title className="text-sm font-black">{item ? '编辑订阅' : '添加订阅'}</Dialog.Title>

          <div className="mt-3">
            <SubscriptionFormFields values={values} editing={!!item} onChange={setValues} />
          </div>

          <div className="sticky bottom-0 -mx-3 mt-4 grid grid-cols-2 gap-2 border-t bg-card/95 p-3 backdrop-blur">
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
