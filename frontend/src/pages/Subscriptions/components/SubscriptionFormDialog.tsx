import { useEffect, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { Subscription } from '../../../types/domain.types'
import { SubscriptionFormFields, formValuesToPayload, subscriptionToFormValues, type SubscriptionFormValues, type SubscriptionPayload } from './SubscriptionFormFields'

type SubscriptionFormDialogProps = {
  open: boolean
  item: Subscription | null
  saving: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (payload: SubscriptionPayload, id?: string) => void
}

// SubscriptionFormDialog 在桌面端承载订阅创建/编辑表单。
export function SubscriptionFormDialog({ open, item, saving, onOpenChange, onSubmit }: SubscriptionFormDialogProps) {
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
        <Dialog.Content className="nexus-surface fixed left-1/2 top-1/2 z-50 max-h-[86dvh] w-[calc(100vw-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto p-4">
          <div className="flex items-center justify-between gap-3">
            <Dialog.Title className="text-base font-semibold">{item ? '编辑订阅' : '添加订阅'}</Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" className="nexus-button-utility h-9 w-9 text-muted-foreground" aria-label="关闭">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="mt-4">
            <SubscriptionFormFields values={values} editing={!!item} onChange={setValues} />
          </div>

          <div className="mt-5 flex items-center justify-end gap-2 border-t pt-4">
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
