import { useEffect, useState } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { Gauge } from 'lucide-react'
import type { Subscription } from '../../../types/domain.types'
import { usagePercent } from '../subscriptions.shared'

type UsagePopoverProps = {
  item: Subscription
  saving: boolean
  onSave: (id: string, usageUsed: number) => void
}

// UsagePopover 提供手动记录订阅用量和 +1 快捷操作。
export function UsagePopover({ item, saving, onSave }: UsagePopoverProps) {
  const [value, setValue] = useState(String(item.usageUsed ?? 0))
  const percent = usagePercent(item)

  useEffect(() => {
    setValue(String(item.usageUsed ?? 0))
  }, [item.usageUsed])

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button type="button" className="nexus-button-utility h-9 gap-1.5 px-2.5 text-xs">
          <Gauge className="h-3.5 w-3.5" /> 用量
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content side="top" align="end" sideOffset={8} className="z-[80] w-[min(calc(100vw-2rem),18rem)] rounded-lg border bg-popover p-3 text-popover-foreground shadow-lg">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-bold">记录用量</p>
              <span className="text-xs font-semibold text-muted-foreground">
                {item.usageUsed ?? 0}/{item.usageLimit} {item.usageUnit}
              </span>
            </div>
            {percent !== null && (
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
              </div>
            )}
            <input type="number" min="0" step="0.0001" value={value} onChange={(event) => setValue(event.target.value)} className="nexus-input h-10 w-full px-3 text-sm" />
            <div className="grid grid-cols-[auto_1fr] gap-2">
              <button type="button" disabled={saving} onClick={() => onSave(item.id, (item.usageUsed ?? 0) + 1)} className="nexus-button-utility h-9 px-3 text-xs">
                +1
              </button>
              <button type="button" disabled={saving || value === ''} onClick={() => onSave(item.id, Number(value))} className="nexus-button-primary h-9 px-3 text-xs">
                保存
              </button>
            </div>
          </div>
          <Popover.Arrow className="fill-popover" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
