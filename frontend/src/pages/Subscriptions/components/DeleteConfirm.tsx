import * as Popover from '@radix-ui/react-popover'
import { Trash2 } from 'lucide-react'

type DeleteConfirmProps = {
  deleting: boolean
  onConfirm: () => void
}

// DeleteConfirm 删除前的二次确认 Popover，供订阅卡片和用量账户卡片复用
export function DeleteConfirm({ deleting, onConfirm }: DeleteConfirmProps) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button type="button" className="nexus-button-utility h-9 w-9 text-muted-foreground hover:text-destructive" aria-label="删除">
          <Trash2 className="h-4 w-4" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content side="top" align="end" sideOffset={8} className="z-[80] w-[min(calc(100vw-2rem),18rem)] rounded-lg border bg-popover p-3 text-popover-foreground shadow-lg">
          <p className="text-sm font-bold">确认删除这个订阅？</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">此操作无法撤销。</p>
          <div className="mt-4 flex justify-end gap-2">
            <Popover.Close asChild>
              <button type="button" className="nexus-button-utility h-9 px-3 text-xs">取消</button>
            </Popover.Close>
            <button type="button" disabled={deleting} onClick={onConfirm} className="inline-flex h-9 items-center justify-center rounded-md border border-destructive bg-destructive px-3 text-xs font-semibold text-destructive-foreground disabled:opacity-50">
              确认删除
            </button>
          </div>
          <Popover.Arrow className="fill-popover" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
