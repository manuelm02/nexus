import * as Select from '@radix-ui/react-select'
import * as Switch from '@radix-ui/react-switch'
import { Check, ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Subscription } from '../../../types/domain.types'
import { DatePicker } from '../../../components/ui/DatePicker'
import { cn } from '../../../lib/utils'
import { BILLING_TYPE_LABELS, STATUS_LABELS, SUBSCRIPTION_STATUSES, type SubscriptionStatus } from '../subscriptions.shared'

export type SubscriptionFormValues = {
  name: string
  category: string
  price: string
  currency: string
  billingType: string
  startDate: string
  expireDate: string
  nextBillingDate: string
  usageLimit: string
  usageUnit: string
  url: string
  notes: string
  notifyEnabled: boolean
  notifyDaysBefore: string
  status: SubscriptionStatus
}

export type SubscriptionPayload = Partial<Subscription> & {
  clearStartDate?: boolean
  clearExpireDate?: boolean
  clearNextBillingDate?: boolean
}

export const emptySubscriptionForm: SubscriptionFormValues = {
  name: '',
  category: '',
  price: '',
  currency: 'CNY',
  billingType: 'monthly',
  startDate: '',
  expireDate: '',
  nextBillingDate: '',
  usageLimit: '',
  usageUnit: '',
  url: '',
  notes: '',
  notifyEnabled: true,
  notifyDaysBefore: '7',
  status: 'active',
}

export function subscriptionToFormValues(item?: Subscription | null): SubscriptionFormValues {
  if (!item) return { ...emptySubscriptionForm }
  return {
    name: item.name,
    category: item.category ?? '',
    price: item.price?.toString() ?? '',
    currency: item.currency || 'CNY',
    billingType: item.billingType || 'monthly',
    startDate: item.startDate ?? '',
    expireDate: item.expireDate ?? '',
    nextBillingDate: item.nextBillingDate ?? '',
    usageLimit: item.usageLimit?.toString() ?? '',
    usageUnit: item.usageUnit ?? '',
    url: item.url ?? '',
    notes: item.notes ?? '',
    notifyEnabled: item.notifyEnabled,
    notifyDaysBefore: item.notifyDaysBefore.toString(),
    status: item.status,
  }
}

export function formValuesToPayload(values: SubscriptionFormValues, existing?: Subscription | null): SubscriptionPayload {
  const payload: SubscriptionPayload = {
    name: values.name.trim(),
    category: values.category.trim() || undefined,
    price: values.price ? Number(values.price) : undefined,
    currency: values.currency,
    billingType: values.billingType,
    startDate: values.startDate || undefined,
    expireDate: values.expireDate || undefined,
    nextBillingDate: values.nextBillingDate || undefined,
    usageLimit: values.usageLimit ? Number(values.usageLimit) : undefined,
    usageUnit: values.usageUnit.trim() || undefined,
    url: values.url.trim() || undefined,
    notes: values.notes.trim() || undefined,
    notifyEnabled: values.notifyEnabled,
    notifyDaysBefore: values.notifyEnabled ? Number(values.notifyDaysBefore || 0) : 0,
  }
  if (existing) {
    payload.status = values.status
    payload.clearStartDate = !values.startDate && !!existing.startDate
    payload.clearExpireDate = !values.expireDate && !!existing.expireDate
    payload.clearNextBillingDate = !values.nextBillingDate && !!existing.nextBillingDate
  }
  return payload
}

type SubscriptionFormFieldsProps = {
  values: SubscriptionFormValues
  editing: boolean
  onChange: (values: SubscriptionFormValues) => void
}

const BILLING_TYPES = Object.keys(BILLING_TYPE_LABELS)
const CURRENCIES = ['CNY', 'USD', 'EUR', 'HKD', 'JPY']

function FieldLabel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}

function SelectField({ value, options, labels, onChange }: {
  value: string
  options: string[]
  labels?: Record<string, string>
  onChange: (value: string) => void
}) {
  return (
    <Select.Root value={value} onValueChange={onChange}>
      <Select.Trigger className="nexus-input inline-flex h-10 w-full items-center justify-between gap-2 px-3 text-sm font-semibold shadow-none focus:outline-none focus:ring-2 focus:ring-ring">
        <Select.Value />
        <Select.Icon>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content position="popper" sideOffset={6} className="z-[90] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg">
          <Select.Viewport>
            {options.map((option) => (
              <Select.Item key={option} value={option} className="relative flex h-9 cursor-default select-none items-center rounded-md px-8 text-sm font-semibold outline-none data-[highlighted]:bg-accent">
                <Select.ItemIndicator className="absolute left-2 flex h-4 w-4 items-center justify-center text-primary">
                  <Check className="h-3.5 w-3.5" />
                </Select.ItemIndicator>
                <Select.ItemText>{labels?.[option] ?? option}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  )
}

// SubscriptionFormFields 承载订阅创建/编辑的共享字段，桌面 Dialog 和移动 Sheet 共用同一套校验入口。
export function SubscriptionFormFields({ values, editing, onChange }: SubscriptionFormFieldsProps) {
  const setField = <K extends keyof SubscriptionFormValues>(key: K, value: SubscriptionFormValues[K]) => {
    onChange({ ...values, [key]: value })
  }

  return (
    <div className="space-y-3">
      <FieldLabel label="名称 *">
        <input value={values.name} onChange={(event) => setField('name', event.target.value)} className="nexus-input h-10 w-full px-3 text-sm" placeholder="ChatGPT Plus" />
      </FieldLabel>

      <div className="grid gap-3 sm:grid-cols-2">
        <FieldLabel label="分类">
          <input value={values.category} onChange={(event) => setField('category', event.target.value)} className="nexus-input h-10 w-full px-3 text-sm" placeholder="AI 工具" />
        </FieldLabel>
        <FieldLabel label="计费类型">
          <SelectField value={values.billingType} options={BILLING_TYPES} labels={BILLING_TYPE_LABELS} onChange={(value) => setField('billingType', value)} />
        </FieldLabel>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
        <FieldLabel label="金额">
          <input type="number" min="0" step="0.01" value={values.price} onChange={(event) => setField('price', event.target.value)} className="nexus-input h-10 w-full px-3 text-sm" placeholder="20.00" />
        </FieldLabel>
        <FieldLabel label="币种">
          <SelectField value={values.currency} options={CURRENCIES} onChange={(value) => setField('currency', value)} />
        </FieldLabel>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <FieldLabel label="开始日期">
          <DatePicker value={values.startDate} onChange={(value) => setField('startDate', value)} allowClear placeholder="未设置" />
        </FieldLabel>
        <FieldLabel label="到期日期">
          <DatePicker value={values.expireDate} onChange={(value) => setField('expireDate', value)} allowClear placeholder="未设置" />
        </FieldLabel>
        <FieldLabel label="下次扣费">
          <DatePicker value={values.nextBillingDate} onChange={(value) => setField('nextBillingDate', value)} allowClear placeholder="未设置" />
        </FieldLabel>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
        <FieldLabel label="用量上限">
          <input type="number" min="0" step="0.0001" value={values.usageLimit} onChange={(event) => setField('usageLimit', event.target.value)} className="nexus-input h-10 w-full px-3 text-sm" placeholder="1000" />
        </FieldLabel>
        <FieldLabel label="单位">
          <input value={values.usageUnit} onChange={(event) => setField('usageUnit', event.target.value)} className="nexus-input h-10 w-full px-3 text-sm" placeholder="次" />
        </FieldLabel>
      </div>

      <FieldLabel label="网址">
        <input value={values.url} onChange={(event) => setField('url', event.target.value)} className="nexus-input h-10 w-full px-3 text-sm" placeholder="https://" />
      </FieldLabel>

      <FieldLabel label="备注">
        <textarea value={values.notes} onChange={(event) => setField('notes', event.target.value)} rows={3} className="nexus-input min-h-20 w-full resize-y px-3 py-2 text-sm" />
      </FieldLabel>

      <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
        <div className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2 shadow-[var(--shadow-xs)]">
          <div>
            <p className="text-sm font-semibold">到期提醒</p>
            <p className="text-xs text-muted-foreground">用于每日 SUBSCRIPTION_EXPIRING 通知</p>
          </div>
          <Switch.Root checked={values.notifyEnabled} onCheckedChange={(checked) => setField('notifyEnabled', checked)} className={cn('relative h-6 w-11 rounded-full transition-colors', values.notifyEnabled ? 'bg-primary' : 'bg-muted')}>
            <Switch.Thumb className="block h-5 w-5 translate-x-0.5 rounded-full bg-card shadow transition-transform data-[state=checked]:translate-x-5" />
          </Switch.Root>
        </div>
        <FieldLabel label="提前天数">
          <input type="number" min="0" value={values.notifyDaysBefore} onChange={(event) => setField('notifyDaysBefore', event.target.value)} disabled={!values.notifyEnabled} className="nexus-input h-10 w-full px-3 text-sm disabled:bg-muted" />
        </FieldLabel>
      </div>

      {editing && (
        <FieldLabel label="状态">
          <SelectField value={values.status} options={SUBSCRIPTION_STATUSES} labels={STATUS_LABELS} onChange={(value) => setField('status', value as SubscriptionStatus)} />
        </FieldLabel>
      )}
    </div>
  )
}
