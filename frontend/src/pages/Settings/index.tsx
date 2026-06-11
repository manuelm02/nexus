import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as Select from '@radix-ui/react-select'
import { apiClient } from '../../api/client'
import type { ApiResponse } from '../../types/api.types'
import type { LlmProvider, WorkflowLlmConfig } from '../../types/domain.types'
import { Plus, Trash2, Save, AlertCircle, Loader2, ListTodo, Bot, Check, ChevronDown } from 'lucide-react'

export default function SettingsPage() {
  const [tab, setTab] = useState<'llm' | 'system'>('llm')

  return (
    <div className="nexus-page-enter mx-auto max-w-3xl space-y-6 p-4 md:p-8">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground">System control</p>
        <h1 className="mt-1 text-3xl font-black md:text-4xl">Settings</h1>
      </div>
      <div className="flex gap-2 border-b">
        {[{ key: 'llm', label: 'LLM 配置' }, { key: 'system', label: '系统参数' }].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key as typeof tab)}
            className={`pb-2 text-sm border-b-2 transition-colors ${
              tab === key ? 'border-primary text-primary font-medium' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'llm' && <LlmConfig />}
      {tab === 'system' && <SystemConfig />}
    </div>
  )
}

function LlmConfig() {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    name: '', provider: 'openai', apiKey: '', model: '', baseUrl: '', isDefault: false, enabled: true,
  })
  const qc = useQueryClient()

  const { data: providerRes, isLoading: pLoading, isError: pError } = useQuery({
    queryKey: ['llm-providers'],
    queryFn: () => apiClient.get<ApiResponse<LlmProvider[]>>('/settings/llm/providers'),
  })
  const { data: wfRes, isLoading: wfLoading, isError: wfError } = useQuery({
    queryKey: ['llm-workflows'],
    queryFn: () => apiClient.get<ApiResponse<WorkflowLlmConfig[]>>('/settings/llm/workflows'),
  })
  const createMutation = useMutation({
    mutationFn: () => apiClient.post('/settings/llm/providers', form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['llm-providers'] })
      setShowForm(false)
      setForm({ name: '', provider: 'openai', apiKey: '', model: '', baseUrl: '', isDefault: false, enabled: true })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/settings/llm/providers/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['llm-providers'] }),
  })
  const workflowMutation = useMutation({
    mutationFn: ({ type, providerId }: { type: string; providerId: string }) => apiClient.patch(`/settings/llm/workflows/${type}`, { providerId }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['llm-workflows'] }),
  })
  const providers: LlmProvider[] = providerRes?.data?.data ?? []
  const workflows: WorkflowLlmConfig[] = wfRes?.data?.data ?? []
  const defaultProvider = providers.find((provider) => provider.defaultProvider)
  const translateWorkflow = workflows.find((workflow) => workflow.workflowType === 'translate')
  const translateProviderId = translateWorkflow?.providerId ?? ''

  return (
    <div className="space-y-5">
      <section className="nexus-surface p-4 md:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Bot className="h-5 w-5" /></span>
            <div>
              <h2 className="text-lg font-black text-foreground">AI & Translation</h2>
              <p className="mt-1 text-sm leading-7 text-muted-foreground">全局模型作为兜底；Translate 可单独覆盖；腾讯云机器翻译在后台负责快速初稿。</p>
            </div>
          </div>
          <span className="rounded-full border border-border px-3 py-1 text-xs font-bold text-muted-foreground">Quiet Knowledge OS</span>
        </div>
      </section>

      <section className="nexus-surface space-y-4 p-4 md:p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-black text-foreground">全局兜底 LLM</h2>
            <p className="text-xs leading-6 text-muted-foreground">未单独配置的 AI 工作流都会继承这个 provider。</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="nexus-button-utility inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold"
          >
            <Plus className="h-3.5 w-3.5" /> 添加 Provider
          </button>
        </div>

        <div className="rounded-xl border border-border bg-muted/60 p-3 text-sm">
          <span className="font-bold text-foreground">当前兜底：</span>
          <span className="text-muted-foreground">{defaultProvider ? `${defaultProvider.name} · ${defaultProvider.provider} · ${defaultProvider.model}` : '尚未设置全局默认模型'}</span>
        </div>

        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">LLM Providers</h2>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 text-xs rounded-md border px-2 py-1 hover:bg-accent transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> 添加
          </button>
        </div>

        {showForm && (
          <form
            onSubmit={(e) => { e.preventDefault(); createMutation.mutate() }}
            className="rounded-lg border bg-card p-4 space-y-3"
          >
            <div className="grid grid-cols-2 gap-3">
              <input
                required value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="名称（如：我的 GPT-4）"
                className="rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <Select.Root value={form.provider} onValueChange={(value) => setForm({ ...form, provider: value })}>
                <Select.Trigger className="nexus-input inline-flex h-11 w-full items-center justify-between gap-2 rounded-md border bg-background px-3 text-sm shadow-sm hover:bg-accent/40 focus:outline-none focus:ring-2 focus:ring-ring">
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
                onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                type="password"
                placeholder="API Key"
                className="rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <input
                required value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
                placeholder="模型名称（如：gpt-4o）"
                className="rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {form.provider === 'ollama' && (
                <input
                  value={form.baseUrl}
                  onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
                  placeholder="Base URL（如：http://localhost:11434）"
                  className="col-span-2 rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              )}
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                />
                设为全局默认
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                />
                启用
              </label>
            </div>
            {createMutation.isError && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" />
                保存失败，请检查填写内容
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent transition-colors"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {createMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                保存
              </button>
            </div>
          </form>
        )}

        {pLoading && <p className="text-sm text-muted-foreground text-center py-4">加载中…</p>}
        {pError && (
          <p className="text-sm text-destructive flex items-center gap-1.5 py-4">
            <AlertCircle className="h-4 w-4" /> 加载 Providers 失败，请刷新重试
          </p>
        )}
        {!pLoading && !pError && (
          <ul className="space-y-2">
            {providers.map((p) => (
              <li key={p.id} className="rounded-lg border bg-card p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">
                    {p.name}
                    {p.defaultProvider && (
                      <span className="text-xs text-primary ml-1.5 bg-primary/10 px-1.5 py-0.5 rounded">默认</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">{p.provider} · {p.model}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs rounded px-1.5 py-0.5 ${p.enabled ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-500'}`}>
                    {p.enabled ? '启用' : '禁用'}
                  </span>
                  <button
                    onClick={() => deleteMutation.mutate(p.id)}
                    disabled={deleteMutation.isPending}
                    className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
            {providers.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                尚未配置 Provider，点击「添加」创建
              </p>
            )}
          </ul>
        )}
      </section>

      <section className="nexus-surface space-y-3 p-4 md:p-5">
        <h2 className="text-sm font-black text-foreground">Translate 模型覆盖</h2>
        <p className="text-xs leading-6 text-muted-foreground">不选择时继承全局兜底；选择后 Translate 的 LLM 增强阶段使用指定 provider。</p>
        <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
          <Select.Root value={translateProviderId || '__inherit__'} onValueChange={(value) => workflowMutation.mutate({ type: 'translate', providerId: value === '__inherit__' ? '' : value })} disabled={workflowMutation.isPending || providers.length === 0}>
            <Select.Trigger className="nexus-input inline-flex h-11 w-full items-center justify-between gap-2 px-3 text-sm shadow-sm hover:bg-accent/40 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50">
              <Select.Value placeholder="继承全局默认" />
              <Select.Icon><ChevronDown className="h-4 w-4 text-muted-foreground" /></Select.Icon>
            </Select.Trigger>
            <Select.Portal>
              <Select.Content position="popper" sideOffset={6} className="z-[70] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg">
                <Select.Viewport>
                  {/* Radix Select 不允许 value=""，用 __inherit__ 作为"继承全局默认"的 sentinel */}
                  <Select.Item value="__inherit__" className="relative flex h-10 cursor-default select-none items-center rounded-lg px-9 text-sm font-semibold outline-none transition-colors data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground">
                    <Select.ItemIndicator className="absolute left-3 flex h-4 w-4 items-center justify-center text-primary"><Check className="h-3.5 w-3.5" /></Select.ItemIndicator>
                    <Select.ItemText>继承全局默认</Select.ItemText>
                  </Select.Item>
                  {providers.map((provider) => (
                    <Select.Item key={provider.id} value={provider.id} className="relative flex h-10 cursor-default select-none items-center rounded-lg px-9 text-sm font-semibold outline-none transition-colors data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground">
                      <Select.ItemIndicator className="absolute left-3 flex h-4 w-4 items-center justify-center text-primary"><Check className="h-3.5 w-3.5" /></Select.ItemIndicator>
                      <Select.ItemText>{provider.name} · {provider.model}</Select.ItemText>
                    </Select.Item>
                  ))}
                </Select.Viewport>
              </Select.Content>
            </Select.Portal>
          </Select.Root>
          <span className="text-xs font-bold text-muted-foreground">{workflowMutation.isPending ? '保存中...' : '自动保存'}</span>
        </div>
        {wfLoading && <p className="text-sm text-muted-foreground">加载中…</p>}
        {wfError && (
          <p className="text-sm text-destructive flex items-center gap-1.5">
            <AlertCircle className="h-4 w-4" /> 加载工作流配置失败
          </p>
        )}
        {!wfLoading && !wfError && (
          <ul className="space-y-1">
            {workflows.map((wf) => (
              <li key={wf.id} className="rounded-lg border bg-card p-3 flex items-center justify-between">
                <span className="text-sm font-mono">{wf.workflowType}</span>
                <span className="text-xs text-muted-foreground">
                  {wf.modelOverride ?? (wf.providerId ? `Provider: ${wf.providerId.slice(0, 8)}…` : '使用全局默认')}
                </span>
              </li>
            ))}
            {workflows.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">暂无工作流配置</p>
            )}
          </ul>
        )}
      </section>

    </div>
  )
}

function SystemConfig() {
  const [overrides, setOverrides] = useState<Record<string, string>>({})
  const [dirty, setDirty] = useState(false)
  const qc = useQueryClient()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['system-config'],
    queryFn: () => apiClient.get<ApiResponse<Record<string, string>>>('/settings/system'),
    select: (res) => res.data?.data ?? {},
  })

  const saveMutation = useMutation({
    mutationFn: () => apiClient.patch('/settings/system', { configs: overrides }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['system-config'] })
      setOverrides({})
      setDirty(false)
    },
  })

  const merged: Record<string, string> = { ...(data ?? {}), ...overrides }

  const handleChange = (key: string, val: string) => {
    setOverrides((prev) => ({ ...prev, [key]: val }))
    setDirty(true)
  }

  if (isLoading) return <p className="text-sm text-muted-foreground py-4">加载中…</p>

  if (isError) return (
    <p className="text-sm text-destructive flex items-center gap-1.5 py-4">
      <AlertCircle className="h-4 w-4" /> 加载系统配置失败，请刷新重试
    </p>
  )

  return (
    <div className="space-y-3">
      <Link
        to="/tasks"
        className="nexus-surface flex items-center justify-between gap-3 p-4 transition-colors hover:border-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ListTodo className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold">Jobs / Tasks</span>
            <span className="block truncate text-xs text-muted-foreground">查看后台异步任务记录和保留状态。</span>
          </span>
        </span>
        <span className="text-xs font-bold text-muted-foreground">打开</span>
      </Link>
      {Object.keys(merged).length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          暂无系统配置项（请确认数据库迁移已执行）
        </p>
      )}
      {Object.entries(merged).map(([key, val]) => (
        <div key={key} className="flex items-center gap-3">
          <label className="text-sm text-muted-foreground w-52 shrink-0 font-mono text-xs">{key}</label>
          <input
            value={val}
            onChange={(e) => handleChange(key, e.target.value)}
            className="flex-1 rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      ))}
      {dirty && (
        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            保存更改
          </button>
          <button
            onClick={() => { setOverrides({}); setDirty(false) }}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent transition-colors"
          >
            取消
          </button>
          {saveMutation.isError && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5" /> 保存失败
            </p>
          )}
        </div>
      )}
    </div>
  )
}
