import * as Select from '@radix-ui/react-select'
import * as Switch from '@radix-ui/react-switch'
import { Check, ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Subscription } from '../../../types/domain.types'
import { DatePicker } from '../../../components/ui/DatePicker'
import { cn } from '../../../lib/utils'
import { BILLING_TYPE_LABELS, isFieldVisible } from '../panelhub.shared'
import { CategoryInput } from './CategoryInput'

function addBillingPeriod(dateStr: string, unit: 'month' | 'year'): string {
  const d = new Date(`${dateStr}T00:00:00`)
  if (unit === 'month') d.setMonth(d.getMonth() + 1)
  else d.setFullYear(d.getFullYear() + 1)
  return d.toISOString().slice(0, 10)
}

export type SubscriptionFormValues = {
  name: string
  category: string
  price: string
  currency: string
  billingType: string
  startDate: string
  expireDate: string
  nextBillingDate: string
  url: string
  notes: string
  notifyEnabled: boolean
  notifyDaysBefore: string
  autoRenew: boolean
  archived: boolean
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
  url: '',
  notes: '',
  notifyEnabled: true,
  notifyDaysBefore: '7',
  autoRenew: true,
  archived: false,
}

export function subscriptionToFormValues(item?: Subscription | null, initialBillingType?: string): SubscriptionFormValues {
  if (!item) return { ...emptySubscriptionForm, billingType: initialBillingType ?? emptySubscriptionForm.billingType }
  return {
    name: item.name,
    category: item.category ?? '',
    price: item.price?.toString() ?? '',
    currency: item.currency || 'CNY',
    billingType: item.billingType || 'monthly',
    startDate: item.startDate ?? '',
    expireDate: item.expireDate ?? '',
    nextBillingDate: item.nextBillingDate ?? '',
    url: item.url ?? '',
    notes: item.notes ?? '',
    notifyEnabled: item.notifyEnabled,
    notifyDaysBefore: item.notifyDaysBefore.toString(),
    autoRenew: item.autoRenew,
    archived: item.archived,
  }
}

export function formValuesToPayload(values: SubscriptionFormValues, existing?: Subscription | null): SubscriptionPayload {
  const bt = values.billingType
  const payload: SubscriptionPayload = {
    name: values.name.trim(),
    category: values.category.trim() || undefined,
    billingType: bt,
    notes: values.notes.trim() || undefined,
  }

  if (isFieldVisible(bt, 'price')) {
    payload.price = values.price ? Number(values.price) : undefined
    payload.currency = values.currency
  }
  if (isFieldVisible(bt, 'startDate')) {
    payload.startDate = values.startDate || undefined
  }
  if (isFieldVisible(bt, 'expireDate')) {
    payload.expireDate = values.expireDate || undefined
  }
  if (isFieldVisible(bt, 'nextBillingDate')) {
    payload.nextBillingDate = values.nextBillingDate || undefined
  }
  if (isFieldVisible(bt, 'autoRenew')) {
    payload.autoRenew = values.autoRenew
  }
  if (isFieldVisible(bt, 'notifyEnabled')) {
    payload.notifyEnabled = values.notifyEnabled
    payload.notifyDaysBefore = values.notifyEnabled ? Number(values.notifyDaysBefore || 0) : 0
  }
  if (isFieldVisible(bt, 'url')) {
    payload.url = values.url.trim() || undefined
  }

  if (existing) {
    payload.archived = values.archived
    payload.clearStartDate = !values.startDate && !!existing.startDate
    payload.clearExpireDate = !values.expireDate && !!existing.expireDate
    payload.clearNextBillingDate = !values.nextBillingDate && !!existing.nextBillingDate
  }

  return payload
}

type SubscriptionFormFieldsProps = {
  values: SubscriptionFormValues
  editing: boolean
  item?: Subscription | null
  onChange: (values: SubscriptionFormValues) => void
  categories?: string[]
  onAiSuggestCategory?: (name: string, notes?: string) => Promise<string | undefined>
  isAiSuggesting?: boolean
}

const BILLING_TYPES = Object.keys(BILLING_TYPE_LABELS)
const CURRENCIES = ['CNY', 'USD', 'EUR', 'HKD', 'JPY']

function billingTypeOptions(): string[] {
  return BILLING_TYPES
}

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

// SubscriptionFormFields 根据计费类型动态渲染订阅创建/编辑表单字段，桌面 Dialog 和移动 Sheet 共用。
export function SubscriptionFormFields({ values, editing, item: _item, onChange, categories, onAiSuggestCategory, isAiSuggesting }: SubscriptionFormFieldsProps) {
  const bt = values.billingType
  const setField = <K extends keyof SubscriptionFormValues>(key: K, value: SubscriptionFormValues[K]) => {
    onChange({ ...values, [key]: value })
  }
  const visible = (field: Parameters<typeof isFieldVisible>[1]) => isFieldVisible(bt, field)

  return (
    <div className="space-y-3">
      <FieldLabel label="名称 *">
        <input value={values.name} onChange={(e) => setField('name', e.target.value)} className="nexus-input h-10 w-full px-3 text-sm" placeholder="输入订阅名称" />
      </FieldLabel>

      <div className="grid gap-3 sm:grid-cols-2">
        <FieldLabel label="分类">
          <CategoryInput
            value={values.category}
            onChange={(v) => setField('category', v)}
            subscriptionName={values.name}
            notes={values.notes}
            categories={categories ?? []}
            onAiSuggest={() => {
              if (!onAiSuggestCategory) return
              void onAiSuggestCategory(values.name, values.notes || undefined).then((result) => {
                if (result) setField('category', result)
              })
            }}
            isAiLoading={isAiSuggesting ?? false}
          />
        </FieldLabel>
        <FieldLabel label="计费类型">
          <SelectField value={values.billingType} options={billingTypeOptions()} labels={BILLING_TYPE_LABELS} onChange={(v) => setField('billingType', v)} />
        </FieldLabel>
      </div>

      {visible('price') && (
        <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
          <FieldLabel label="金额">
            <input type="number" min="0" step="0.01" value={values.price} onChange={(e) => setField('price', e.target.value)} className="nexus-input h-10 w-full px-3 text-sm" placeholder="0.00" />
          </FieldLabel>
          <FieldLabel label="币种">
            <SelectField value={values.currency} options={CURRENCIES} onChange={(v) => setField('currency', v)} />
          </FieldLabel>
        </div>
      )}

      {(visible('startDate') || visible('expireDate') || visible('nextBillingDate')) && (
        <div className="grid gap-3 sm:grid-cols-3">
          {visible('startDate') && (
            <FieldLabel label={bt === 'lifetime' ? '购买日期' : '开始日期'}>
              <DatePicker
                value={values.startDate}
                onChange={(v) => {
                  const next = { ...values, startDate: v }
                  if ((bt === 'monthly' || bt === 'yearly') && v && !values.expireDate) {
                    const computed = addBillingPeriod(v, bt === 'monthly' ? 'month' : 'year')
                    next.expireDate = computed
                    if (!values.nextBillingDate) next.nextBillingDate = computed
                  }
                  onChange(next)
                }}
                allowClear
                placeholder="未设置"
              />
            </FieldLabel>
          )}
          {visible('expireDate') && (
            <FieldLabel label={bt === 'one_time' ? '结束日期' : '到期日期'}>
              <DatePicker value={values.expireDate} onChange={(v) => setField('expireDate', v)} allowClear placeholder="未设置" />
            </FieldLabel>
          )}
          {visible('nextBillingDate') && (
            <FieldLabel label="下次扣费日期">
              <DatePicker value={values.nextBillingDate} onChange={(v) => setField('nextBillingDate', v)} allowClear placeholder="未设置" />
            </FieldLabel>
          )}
        </div>
      )}

      {visible('autoRenew') && (
        <div className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2 shadow-[var(--shadow-xs)]">
          <div>
            <p className="text-sm font-semibold">自动续费</p>
            <p className="text-xs text-muted-foreground">到期后自动扣款续订</p>
          </div>
          <Switch.Root checked={values.autoRenew} onCheckedChange={(c) => setField('autoRenew', c)} className={cn('relative h-6 w-11 rounded-full transition-colors', values.autoRenew ? 'bg-primary' : 'bg-muted')}>
            <Switch.Thumb className="block h-5 w-5 translate-x-0.5 rounded-full bg-card shadow transition-transform data-[state=checked]:translate-x-5" />
          </Switch.Root>
        </div>
      )}

      {visible('url') && (
        <FieldLabel label="订阅地址">
          <input value={values.url} onChange={(e) => setField('url', e.target.value)} className="nexus-input h-10 w-full px-3 text-sm" placeholder="https://" />
        </FieldLabel>
      )}

      <FieldLabel label="备注">
        <textarea value={values.notes} onChange={(e) => setField('notes', e.target.value)} rows={3} className="nexus-input min-h-20 w-full resize-y px-3 py-2 text-sm" />
      </FieldLabel>

      {visible('notifyEnabled') && (
        <div className="rounded-lg border bg-card px-3 py-2 shadow-[var(--shadow-xs)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{bt === 'one_time' ? '结束提醒' : '到期提醒'}</p>
              <p className="text-xs text-muted-foreground">{bt === 'one_time' ? '结束前提前提醒我' : '到期前提前提醒我续费'}</p>
            </div>
            <Switch.Root checked={values.notifyEnabled} onCheckedChange={(c) => setField('notifyEnabled', c)} className={cn('relative h-6 w-11 rounded-full transition-colors', values.notifyEnabled ? 'bg-primary' : 'bg-muted')}>
              <Switch.Thumb className="block h-5 w-5 translate-x-0.5 rounded-full bg-card shadow transition-transform data-[state=checked]:translate-x-5" />
            </Switch.Root>
          </div>
          {values.notifyEnabled && (
            <div className="mt-3 flex items-center gap-2 border-t pt-3">
              <span className="text-xs font-medium text-muted-foreground">提前</span>
              <input
                type="number"
                min="0"
                value={values.notifyDaysBefore}
                onChange={(e) => setField('notifyDaysBefore', e.target.value)}
                className="nexus-input h-9 w-20 px-2 text-center text-sm"
              />
              <span className="text-xs font-medium text-muted-foreground">天提醒</span>
            </div>
          )}
        </div>
      )}

      {editing && visible('archived') && (
        <div className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2 shadow-[var(--shadow-xs)]">
          <div>
            <p className="text-sm font-semibold">归档</p>
            <p className="text-xs text-muted-foreground">归档后不在列表默认显示</p>
          </div>
          <Switch.Root checked={values.archived} onCheckedChange={(c) => setField('archived', c)} className={cn('relative h-6 w-11 rounded-full transition-colors', values.archived ? 'bg-primary' : 'bg-muted')}>
            <Switch.Thumb className="block h-5 w-5 translate-x-0.5 rounded-full bg-card shadow transition-transform data-[state=checked]:translate-x-5" />
          </Switch.Root>
        </div>
      )}
    </div>
  )
}
