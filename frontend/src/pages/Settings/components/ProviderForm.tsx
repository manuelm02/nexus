import * as Select from '@radix-ui/react-select'
import { Plus, Loader2, AlertCircle, Check, ChevronDown } from 'lucide-react'

// ProviderForm 的字段类型，别名提取便于 View 和 Page 共用。
export type ProviderFormData = {
  name: string
  provider: string
  apiKey?: string
  model: string
  baseUrl: string
  enabled: boolean
}

type ProviderFormProps = {
  form: ProviderFormData
  mode: 'create' | 'edit'
  pending: boolean
  error: boolean
  onChange: (form: ProviderFormData) => void
  onSubmit: () => void
  onCancel: () => void
}

// ProviderForm 复用于创建和编辑 LLM Provider，内联展示，不占据页面全局表单区。
export function ProviderForm({ form, mode, pending, error, onChange, onSubmit, onCancel }: ProviderFormProps) {
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit() }}
      className="rounded-xl border-2 border-primary/15 bg-primary/[0.02] p-4"
    >
      <p className="mb-3 text-xs font-extrabold text-primary">
        {mode === 'create' ? '添加模型' : `编辑 ${form.name || '模型'}`}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <input
          required
          value={form.name}
          onChange={(e) => onChange({ ...form, name: e.target.value })}
          placeholder="名称（如：我的 GPT-4）"
          className="nexus-input px-3 py-2 text-sm"
        />
        <Select.Root value={form.provider} onValueChange={(value) => onChange({ ...form, provider: value })}>
          <Select.Trigger className="nexus-input inline-flex h-10 md:h-9 w-full items-center justify-between gap-2 px-3 text-sm shadow-none hover:bg-accent/40">
            <Select.Value />
            <Select.Icon><ChevronDown className="h-4 w-4 text-muted-foreground" /></Select.Icon>
          </Select.Trigger>
          <Select.Portal>
            <Select.Content position="popper" sideOffset={6} className="z-[70] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg">
              <Select.Viewport>
                {['openai', 'anthropic', 'deepseek', 'ollama'].map((p) => (
                  <Select.Item key={p} value={p} className="relative flex h-10 cursor-default select-none items-center rounded-lg px-9 text-sm font-semibold outline-none transition-colors data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground">
                    <Select.ItemIndicator className="absolute left-3 flex h-4 w-4 items-center justify-center text-primary"><Check className="h-3.5 w-3.5" /></Select.ItemIndicator>
                    <Select.ItemText>{p}</Select.ItemText>
                  </Select.Item>
                ))}
              </Select.Viewport>
            </Select.Content>
          </Select.Portal>
        </Select.Root>
        <input
          value={form.apiKey}
          onChange={(e) => onChange({ ...form, apiKey: e.target.value })}
          type="password"
          placeholder="API Key"
          className="nexus-input px-3 py-2 text-sm"
        />
        <input
          required
          value={form.model}
          onChange={(e) => onChange({ ...form, model: e.target.value })}
          placeholder="模型名称（如：gpt-4o）"
          className="nexus-input px-3 py-2 text-sm"
        />
        {/* 支持 OpenAI 兼容协议的模型接入（MiMo / GLM 等），openai 和 anthropic 选型也显示 baseUrl 为可选字段 */}
        {(form.provider === 'openai' || form.provider === 'anthropic' || form.provider === 'ollama') && (
          <input
            value={form.baseUrl}
            onChange={(e) => onChange({ ...form, baseUrl: e.target.value })}
            placeholder={form.provider === 'ollama' ? 'Base URL（如：http://localhost:11434）' : '自定义 Base URL（可选，兼容 OpenAI 协议模型）'}
            className="col-span-2 nexus-input px-3 py-2 text-sm"
          />
        )}
        {form.provider === 'openai' && (
          <p className="col-span-2 text-[11px] leading-5 text-muted-foreground">
            选择 openai 类型并填入自定义 Base URL，即可接入 MiMo、GLM 等所有兼容 OpenAI 接口协议的模型。
          </p>
        )}
      </div>
      <div className="mt-3 flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => onChange({ ...form, enabled: e.target.checked })}
          />
          启用
        </label>
      </div>
      {error && (
        <p className="mt-2 flex items-center gap-1 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5" />
          保存失败，请检查填写内容
        </p>
      )}
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="nexus-button-utility px-3 py-1.5 text-xs font-bold"
        >
          取消
        </button>
        <button
          type="submit"
          disabled={pending}
          className="nexus-button-primary inline-flex items-center gap-1.5 px-4 py-2 text-xs"
        >
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {mode === 'create' ? <><Plus className="h-3.5 w-3.5" /> 保存</> : '保存'}
        </button>
      </div>
    </form>
  )
}
