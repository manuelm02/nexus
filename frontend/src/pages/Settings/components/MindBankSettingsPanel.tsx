import { useState, useEffect } from 'react'
import { AlertCircle, Loader2, Save, Server, Key, Cpu, Workflow } from 'lucide-react'
import type { LlmProvider, MindBankSettings, MindBankSettingsUpdateRequest } from '../../../types/domain.types'
import { WorkflowModelSelect } from './WorkflowModelSelect'
import { PromptTemplateManager } from '../../Mindbank/components/PromptTemplateManager'

type MindBankSettingsPanelProps = {
  settings: MindBankSettings
  providers: LlmProvider[]
  isLoading: boolean
  isUpdating: boolean
  updateError: boolean
  onUpdate: (update: MindBankSettingsUpdateRequest) => void
}

// MindBankSettingsPanel 管理 Mindbank 模块的全部配置：服务地址、认证密钥、AI 模型和流水线行为。
// API Key 类字段脱敏展示（仅显示"已配置/未配置"），编辑时输入新值才会提交。
export function MindBankSettingsPanel({
  settings,
  providers,
  isLoading,
  isUpdating,
  updateError,
  onUpdate,
}: MindBankSettingsPanelProps) {
  // 本地草稿状态：服务地址和 Obsidian 配置
  const [urlDraft, setUrlDraft] = useState({
    anythingllmUrl: '',
    minioUrl: '',
    minioBucket: '',
    obsidianSubFolder: '',
  })
  // API Key 输入框值：空串表示不修改，有值表示要更新
  const [apiKeyDraft, setApiKeyDraft] = useState({
    anythingllmApiKey: '',
    minioAccessKey: '',
    minioSecretKey: '',
  })
  // 模型选择草稿
  const [modelDraft, setModelDraft] = useState({
    mindbankClassifyProviderId: '',
    mindbankOrganizeProviderId: '',
    mindbankCondenseProviderId: '',
  })
  // 流水线行为草稿
  const [autoSessionNote, setAutoSessionNote] = useState(true)

  // 远程数据刷新后同步草稿，避免旧草稿覆盖后端新值
  useEffect(() => {
    setUrlDraft({
      anythingllmUrl: settings.anythingllmUrl,
      minioUrl: settings.minioUrl,
      minioBucket: settings.minioBucket,
      obsidianSubFolder: settings.obsidianSubFolder,
    })
    setModelDraft({
      mindbankClassifyProviderId: settings.mindbankClassifyProviderId,
      mindbankOrganizeProviderId: settings.mindbankOrganizeProviderId,
      mindbankCondenseProviderId: settings.mindbankCondenseProviderId,
    })
    setAutoSessionNote(settings.pipelineAutoSessionNote)
  }, [settings])

  // dirty 检测：URL 草稿、模型草稿、流水线行为有变更
  const urlDirty = Object.keys(urlDraft).some(
    (k) => urlDraft[k as keyof typeof urlDraft] !== settings[k as keyof MindBankSettings]
  )
  const apiKeyDirty = apiKeyDraft.anythingllmApiKey || apiKeyDraft.minioAccessKey || apiKeyDraft.minioSecretKey
  const modelDirty = Object.keys(modelDraft).some(
    (k) => modelDraft[k as keyof typeof modelDraft] !== settings[k as keyof MindBankSettings]
  )
  const toggleDirty = autoSessionNote !== settings.pipelineAutoSessionNote
  const dirty = urlDirty || apiKeyDirty || modelDirty || toggleDirty

  const handleSave = () => {
    const update: MindBankSettingsUpdateRequest = {}
    // 仅提交有变更的 URL 类字段
    if (urlDraft.anythingllmUrl !== settings.anythingllmUrl) update.anythingllmUrl = urlDraft.anythingllmUrl
    if (urlDraft.minioUrl !== settings.minioUrl) update.minioUrl = urlDraft.minioUrl
    if (urlDraft.minioBucket !== settings.minioBucket) update.minioBucket = urlDraft.minioBucket
    if (urlDraft.obsidianSubFolder !== settings.obsidianSubFolder) update.obsidianSubFolder = urlDraft.obsidianSubFolder
    // API Key：有输入才提交（空串=清除，非空=更新）
    if (apiKeyDraft.anythingllmApiKey) update.anythingllmApiKey = apiKeyDraft.anythingllmApiKey
    if (apiKeyDraft.minioAccessKey) update.minioAccessKey = apiKeyDraft.minioAccessKey
    if (apiKeyDraft.minioSecretKey) update.minioSecretKey = apiKeyDraft.minioSecretKey
    // 模型
    if (modelDraft.mindbankClassifyProviderId !== settings.mindbankClassifyProviderId) {
      update.mindbankClassifyProviderId = modelDraft.mindbankClassifyProviderId
    }
    if (modelDraft.mindbankOrganizeProviderId !== settings.mindbankOrganizeProviderId) {
      update.mindbankOrganizeProviderId = modelDraft.mindbankOrganizeProviderId
    }
    if (modelDraft.mindbankCondenseProviderId !== settings.mindbankCondenseProviderId) {
      update.mindbankCondenseProviderId = modelDraft.mindbankCondenseProviderId
    }
    // 流水线行为
    if (autoSessionNote !== settings.pipelineAutoSessionNote) {
      update.pipelineAutoSessionNote = autoSessionNote
    }
    onUpdate(update)
    // 保存后清空 API Key 输入框
    setApiKeyDraft({ anythingllmApiKey: '', minioAccessKey: '', minioSecretKey: '' })
  }

  const handleCancel = () => {
    setUrlDraft({
      anythingllmUrl: settings.anythingllmUrl,
      minioUrl: settings.minioUrl,
      minioBucket: settings.minioBucket,
      obsidianSubFolder: settings.obsidianSubFolder,
    })
    setApiKeyDraft({ anythingllmApiKey: '', minioAccessKey: '', minioSecretKey: '' })
    setModelDraft({
      mindbankClassifyProviderId: settings.mindbankClassifyProviderId,
      mindbankOrganizeProviderId: settings.mindbankOrganizeProviderId,
      mindbankCondenseProviderId: settings.mindbankCondenseProviderId,
    })
    setAutoSessionNote(settings.pipelineAutoSessionNote)
  }

  if (isLoading) {
    return (
      <section className="nexus-surface space-y-4 p-4">
        <p className="text-sm text-muted-foreground">加载中…</p>
      </section>
    )
  }

  return (
    <section className="nexus-surface space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-foreground">Mindbank 设置</h2>
          <p className="mt-1 text-xs text-muted-foreground">知识库流水线的外部服务、认证和 AI 模型配置</p>
        </div>
        {dirty && (
          <span className="rounded-md bg-warning-soft px-2 py-1 text-xs font-bold text-warning">
            有未保存更改
          </span>
        )}
      </div>

      {/* === 分组 1：服务地址 === */}
      <div className="rounded-xl border border-border bg-muted/30 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Server className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-extrabold text-foreground">服务地址</h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <ConfigInput
            label="AnythingLLM URL"
            value={urlDraft.anythingllmUrl}
            onChange={(v) => setUrlDraft((p) => ({ ...p, anythingllmUrl: v }))}
          />
          <ConfigInput
            label="MinIO URL"
            value={urlDraft.minioUrl}
            onChange={(v) => setUrlDraft((p) => ({ ...p, minioUrl: v }))}
          />
          <ConfigInput
            label="MinIO Bucket"
            value={urlDraft.minioBucket}
            onChange={(v) => setUrlDraft((p) => ({ ...p, minioBucket: v }))}
          />
          <ConfigInput
            label="Obsidian 子文件夹"
            value={urlDraft.obsidianSubFolder}
            onChange={(v) => setUrlDraft((p) => ({ ...p, obsidianSubFolder: v }))}
          />
        </div>
      </div>

      {/* === 分组 2：认证 === */}
      <div className="rounded-xl border border-border bg-muted/30 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Key className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-extrabold text-foreground">认证</h3>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <ConfigSecretInput
            label="AnythingLLM API Key"
            configured={settings.anythingllmApiKeyConfigured}
            value={apiKeyDraft.anythingllmApiKey}
            onChange={(v) => setApiKeyDraft((p) => ({ ...p, anythingllmApiKey: v }))}
          />
          <ConfigSecretInput
            label="MinIO Access Key"
            configured={settings.minioAccessKeyConfigured}
            value={apiKeyDraft.minioAccessKey}
            onChange={(v) => setApiKeyDraft((p) => ({ ...p, minioAccessKey: v }))}
          />
          <ConfigSecretInput
            label="MinIO Secret Key"
            configured={settings.minioSecretKeyConfigured}
            value={apiKeyDraft.minioSecretKey}
            onChange={(v) => setApiKeyDraft((p) => ({ ...p, minioSecretKey: v }))}
          />
        </div>
      </div>

      {/* === 分组 3：AI 模型 === */}
      <div className="rounded-xl border border-border bg-muted/30 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Cpu className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-extrabold text-foreground">AI 模型</h3>
        </div>
        <div className="space-y-3">
          <ModelRow
            label="内容类型识别（Classify）"
            desc="Step 1 — 最快最省模型，用于识别内容类型"
            providers={providers}
            value={modelDraft.mindbankClassifyProviderId}
            onChange={(v) => setModelDraft((p) => ({ ...p, mindbankClassifyProviderId: v }))}
          />
          <ModelRow
            label="知识整理（Organize）"
            desc="Step 2 — 最强模型，用于 Master Note 整理/融合"
            providers={providers}
            value={modelDraft.mindbankOrganizeProviderId}
            onChange={(v) => setModelDraft((p) => ({ ...p, mindbankOrganizeProviderId: v }))}
          />
          <ModelRow
            label="导入速记（Condense）"
            desc="Step 3 — 中等模型，用于 Session Note 生成"
            providers={providers}
            value={modelDraft.mindbankCondenseProviderId}
            onChange={(v) => setModelDraft((p) => ({ ...p, mindbankCondenseProviderId: v }))}
          />
        </div>
      </div>

      {/* === 分组 4：流水线行为 === */}
      <div className="rounded-xl border border-border bg-muted/30 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Workflow className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-extrabold text-foreground">流水线行为</h3>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-foreground">自动生成 Session Note</p>
            <p className="mt-0.5 text-xs text-muted-foreground">导入文件时自动触发 Step 3 速记生成</p>
          </div>
          <ToggleSwitch checked={autoSessionNote} onChange={setAutoSessionNote} />
        </div>
      </div>

      {/* === 保存/取消按钮 === */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card/95 p-3 shadow-[var(--shadow-xs)]">
        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty || isUpdating}
          className="nexus-button-primary inline-flex items-center gap-1.5 px-4 text-xs disabled:opacity-50"
        >
          {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {isUpdating ? '保存中…' : '保存设置'}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={!dirty || isUpdating}
          className="nexus-button-utility px-4 text-xs disabled:opacity-50"
        >
          取消更改
        </button>
        {updateError && (
          <span className="flex items-center gap-1 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5" /> 保存失败
          </span>
        )}
      </div>

      {/* === Prompt 模板管理 === */}
      <PromptTemplateManager />
    </section>
  )
}

// === 内部小组件 ===

/** 普通文本输入配置项 */
function ConfigInput({ label, value, onChange, placeholder }: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-bold text-muted-foreground">{label}</label>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="nexus-input h-9 w-full px-3 text-sm"
      />
    </div>
  )
}

/** 密钥类输入配置项，显示已配置状态，输入新值才提交 */
function ConfigSecretInput({ label, configured, value, onChange }: {
  label: string
  configured: boolean
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-muted-foreground">{label}</label>
        <span className={configured ? 'text-[10px] font-bold text-success' : 'text-[10px] font-bold text-muted-foreground'}>
          {configured ? '已配置' : '未配置'}
        </span>
      </div>
      <input
        type="password"
        value={value}
        placeholder={configured ? '输入新值以替换' : '输入密钥'}
        onChange={(e) => onChange(e.target.value)}
        className="nexus-input h-9 w-full px-3 text-sm"
      />
    </div>
  )
}

/** 模型选择行：标签 + 描述 + 下拉选择 */
function ModelRow({ label, desc, providers, value, onChange }: {
  label: string
  desc: string
  providers: LlmProvider[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="grid gap-2 lg:grid-cols-[1fr_320px] lg:items-center">
      <div>
        <p className="text-sm font-bold text-foreground">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
      </div>
      <WorkflowModelSelect
        providers={providers}
        value={value}
        onChange={onChange}
      />
    </div>
  )
}

/** 简易 Toggle 开关 */
function ToggleSwitch({ checked, onChange }: {
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={checked ? 'switch-checked' : 'switch-unchecked'}
      style={{
        width: 44,
        height: 24,
        borderRadius: 12,
        border: 'none',
        cursor: 'pointer',
        position: 'relative',
        transition: 'background-color 0.2s',
        backgroundColor: checked ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground) / 0.3)',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 2,
          left: checked ? 22 : 2,
          width: 20,
          height: 20,
          borderRadius: '50%',
          backgroundColor: 'white',
          transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }}
      />
    </button>
  )
}
