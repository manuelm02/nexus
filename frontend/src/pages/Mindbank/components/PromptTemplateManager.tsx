import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Star, ChevronDown, Loader2, Check } from 'lucide-react'
import * as Select from '@radix-ui/react-select'
import { mindbankApi } from '../../../api/mindbank.api'
import type {
  PromptTemplate,
  PromptType,
  CreatePromptTemplateRequest,
} from '../../../types/mindbank.types'
import { PROMPT_TYPE_LABELS, PROMPT_TYPE_VARIABLES } from '../../../types/mindbank.types'
import { cn } from '../../../lib/utils'

// PromptTemplateManager Prompt 模板管理组件：按 promptType 分组展示，支持自定义模板 CRUD。
export function PromptTemplateManager() {
  const qc = useQueryClient()
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(null)
  const [creatingOpen, setCreatingOpen] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['mindbank', 'prompt-templates'],
    queryFn: async () => {
      const res = await mindbankApi.listPromptTemplates()
      return res.data.data ?? []
    },
  })

  const createMutation = useMutation({
    mutationFn: (data: CreatePromptTemplateRequest) => mindbankApi.createPromptTemplate(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mindbank', 'prompt-templates'] })
      setCreatingOpen(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { content?: string; name?: string; defaultFlag?: boolean } }) =>
      mindbankApi.updatePromptTemplate(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mindbank', 'prompt-templates'] })
      setEditingTemplate(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => mindbankApi.deletePromptTemplate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mindbank', 'prompt-templates'] })
      setDeleteConfirmId(null)
    },
  })

  const setDefaultMutation = useMutation({
    mutationFn: (id: number) => mindbankApi.updatePromptTemplate(id, { defaultFlag: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mindbank', 'prompt-templates'] }),
  })

  const groupedTemplates = (Object.keys(PROMPT_TYPE_LABELS) as PromptType[]).map((type) => ({
    type,
    label: PROMPT_TYPE_LABELS[type],
    templates: templates.filter((t) => t.promptType === type),
  }))

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-muted/30 p-4">
        <p className="text-xs text-muted-foreground">加载模板中…</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-extrabold text-foreground">Prompt 模板</h3>
        </div>
        <button
          type="button"
          onClick={() => setCreatingOpen(true)}
          className="inline-flex items-center gap-1 rounded-md border border-primary bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary hover:bg-primary/20"
        >
          <Plus className="h-3 w-3" /> 新建自定义模板
        </button>
      </div>

      <div className="space-y-3">
        {groupedTemplates.map(({ type, label, templates: items }) => (
          <TemplateGroup
            key={type}
            type={type}
            label={label}
            templates={items}
            onEdit={setEditingTemplate}
            onDelete={(id) => setDeleteConfirmId(id)}
            onSetDefault={(id) => setDefaultMutation.mutate(id)}
            deleteConfirmId={deleteConfirmId}
            onConfirmDelete={(id) => deleteMutation.mutate(id)}
            onCancelDelete={() => setDeleteConfirmId(null)}
          />
        ))}
      </div>

      {/* 编辑弹窗 */}
      {editingTemplate && (
        <TemplateEditDialog
          template={editingTemplate}
          onClose={() => setEditingTemplate(null)}
          onSave={(content) => updateMutation.mutate({ id: editingTemplate.id, data: { content } })}
          isSaving={updateMutation.isPending}
        />
      )}

      {/* 新建弹窗 */}
      {creatingOpen && (
        <TemplateCreateDialog
          onClose={() => setCreatingOpen(false)}
          onCreate={(data) => createMutation.mutate(data)}
          isCreating={createMutation.isPending}
        />
      )}
    </div>
  )
}

/** 按类型分组的模板列表 */
function TemplateGroup({
  label,
  templates,
  onEdit,
  onDelete,
  onSetDefault,
  deleteConfirmId,
  onConfirmDelete,
  onCancelDelete,
}: {
  type: PromptType
  label: string
  templates: PromptTemplate[]
  onEdit: (t: PromptTemplate) => void
  onDelete: (id: number) => void
  onSetDefault: (id: number) => void
  deleteConfirmId: number | null
  onConfirmDelete: (id: number) => void
  onCancelDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-lg border bg-card">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-3 py-2 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-foreground">{label}</span>
          <span className="text-[10px] text-muted-foreground">({templates.length})</span>
        </div>
        <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', expanded && 'rotate-180')} />
      </button>

      {expanded && (
        <div className="border-t px-3 py-2 space-y-2">
          {templates.length === 0 && (
            <p className="text-[11px] text-muted-foreground">暂无模板</p>
          )}
          {templates.map((t) => (
            <div key={t.id} className="flex items-start justify-between gap-2 rounded-md border bg-muted/30 p-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-foreground">{t.name}</span>
                  {t.builtinFlag && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">
                      内置
                    </span>
                  )}
                  {t.defaultFlag && (
                    <Star className="h-3 w-3 fill-primary text-primary" />
                  )}
                </div>
                <p className="mt-1 line-clamp-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
                  {t.content}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {!t.defaultFlag && !t.builtinFlag && (
                  <button
                    type="button"
                    onClick={() => onSetDefault(t.id)}
                    title="设为默认"
                    className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <Star className="h-3 w-3" />
                  </button>
                )}
                {!t.builtinFlag && (
                  <>
                    <button
                      type="button"
                      onClick={() => onEdit(t)}
                      className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    {deleteConfirmId === t.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onConfirmDelete(t.id)}
                          className="rounded bg-destructive px-1.5 py-0.5 text-[10px] font-bold text-destructive-foreground"
                        >
                          确认
                        </button>
                        <button
                          type="button"
                          onClick={onCancelDelete}
                          className="rounded px-1.5 py-0.5 text-[10px] text-muted-foreground"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onDelete(t.id)}
                        className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** 编辑模板弹窗 */
function TemplateEditDialog({
  template,
  onClose,
  onSave,
  isSaving,
}: {
  template: PromptTemplate
  onClose: () => void
  onSave: (content: string) => void
  isSaving: boolean
}) {
  const [content, setContent] = useState(template.content)
  const variables = PROMPT_TYPE_VARIABLES[template.promptType as PromptType] ?? []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl border bg-card p-4 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-extrabold text-foreground">编辑模板：{template.name}</h3>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={12}
          className="mt-3 nexus-input w-full resize-none px-3 py-2 font-mono text-xs"
        />
        {variables.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            <span className="text-[10px] text-muted-foreground">可用变量：</span>
            {variables.map((v) => (
              <code key={v} className="rounded bg-muted px-1 py-0.5 text-[10px] font-bold text-primary">
                {v}
              </code>
            ))}
          </div>
        )}
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => onSave(content)}
            disabled={isSaving || !content.trim()}
            className="nexus-button-primary inline-flex items-center gap-1.5 px-3 text-xs disabled:opacity-50"
          >
            {isSaving && <Loader2 className="h-3 w-3 animate-spin" />}
            保存
          </button>
          <button type="button" onClick={onClose} className="nexus-button-utility px-3 text-xs">
            取消
          </button>
        </div>
      </div>
    </div>
  )
}

/** 新建模板弹窗 */
function TemplateCreateDialog({
  onClose,
  onCreate,
  isCreating,
}: {
  onClose: () => void
  onCreate: (data: CreatePromptTemplateRequest) => void
  isCreating: boolean
}) {
  const [name, setName] = useState('')
  const [promptType, setPromptType] = useState<PromptType>('organize_init')
  const [content, setContent] = useState('')
  const variables = PROMPT_TYPE_VARIABLES[promptType]

  const handleSubmit = () => {
    if (!name.trim() || !content.trim()) return
    onCreate({ name: name.trim(), promptType, content: content.trim() })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl border bg-card p-4 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-extrabold text-foreground">新建自定义模板</h3>

        <div className="mt-3 space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-bold text-muted-foreground">名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="模板名称"
              className="nexus-input h-9 w-full px-3 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-muted-foreground">类型</label>
            <Select.Root value={promptType} onValueChange={(v) => setPromptType(v as PromptType)}>
              <Select.Trigger className="nexus-input inline-flex h-9 w-full items-center justify-between gap-2 px-3 text-sm font-semibold shadow-none focus:outline-none focus:ring-2 focus:ring-ring">
                <Select.Value />
                <Select.Icon><ChevronDown className="h-4 w-4 text-muted-foreground" /></Select.Icon>
              </Select.Trigger>
              <Select.Portal>
                <Select.Content position="popper" sideOffset={6} className="z-[90] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg">
                  <Select.Viewport>
                    {(Object.keys(PROMPT_TYPE_LABELS) as PromptType[]).map((t) => (
                      <Select.Item key={t} value={t} className="relative flex h-9 cursor-default select-none items-center rounded-md px-8 text-sm font-semibold outline-none data-[highlighted]:bg-accent">
                        <Select.ItemIndicator className="absolute left-2 flex h-4 w-4 items-center justify-center text-primary">
                          <Check className="h-3.5 w-3.5" />
                        </Select.ItemIndicator>
                        <Select.ItemText>{PROMPT_TYPE_LABELS[t]}</Select.ItemText>
                      </Select.Item>
                    ))}
                  </Select.Viewport>
                </Select.Content>
              </Select.Portal>
            </Select.Root>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-muted-foreground">内容</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={10}
              className="nexus-input w-full resize-none px-3 py-2 font-mono text-xs"
            />
          </div>
        </div>

        {variables && variables.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            <span className="text-[10px] text-muted-foreground">可用变量：</span>
            {variables.map((v) => (
              <code key={v} className="rounded bg-muted px-1 py-0.5 text-[10px] font-bold text-primary">
                {v}
              </code>
            ))}
          </div>
        )}

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isCreating || !name.trim() || !content.trim()}
            className="nexus-button-primary inline-flex items-center gap-1.5 px-3 text-xs disabled:opacity-50"
          >
            {isCreating && <Loader2 className="h-3 w-3 animate-spin" />}
            创建
          </button>
          <button type="button" onClick={onClose} className="nexus-button-utility px-3 text-xs">
            取消
          </button>
        </div>
      </div>
    </div>
  )
}
