import { useEffect, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, AlertCircle } from 'lucide-react'
import type { Workspace, CreateWorkspaceRequest } from '../../../types/mindbank.types'
import { cn } from '../../../lib/utils'

// WorkspaceDialog 新建/编辑 Workspace 弹窗，桌面端居中、移动端底部 Sheet，提交时仅传非空字段（PATCH 语义）。
export function WorkspaceDialog({
  open,
  editing,
  onClose,
  onSubmit,
  isSubmitting,
  submitError,
}: {
  open: boolean
  editing: Workspace | null
  onClose: () => void
  onSubmit: (data: CreateWorkspaceRequest) => void
  isSubmitting: boolean
  submitError?: string
}) {
  const [name, setName] = useState('')
  const [domainTag, setDomainTag] = useState('')
  const [description, setDescription] = useState('')
  const [nameError, setNameError] = useState(false)

  // 打开时同步数据，editing 变化时重置
  useEffect(() => {
    if (open) {
      setName(editing?.name ?? '')
      setDomainTag(editing?.domainTag ?? '')
      setDescription(editing?.description ?? '')
      setNameError(false)
    }
  }, [open, editing])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) {
      setNameError(true)
      return
    }
    onSubmit({
      name: trimmedName,
      domainTag: domainTag.trim() || undefined,
      description: description.trim() || undefined,
    })
  }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" />
        <Dialog.Content
          className="nexus-surface fixed inset-x-0 bottom-0 top-auto z-50 max-h-[85dvh] w-full translate-x-0 translate-y-0 overflow-y-auto rounded-b-none rounded-t-2xl p-4 sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:w-[calc(100vw-2rem)] sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg sm:p-5"
        >
          <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-muted-foreground/25 sm:hidden" />
          <div className="flex items-center justify-between gap-3">
            <Dialog.Title className="text-base font-black">
              {editing ? '编辑 Workspace' : '新建 Workspace'}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                className="nexus-button-utility hidden h-9 w-9 text-muted-foreground sm:inline-flex"
                aria-label="关闭"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="mt-4 space-y-3">
            {/* Workspace 名称 */}
            <div>
              <label className="mb-1 block text-xs font-bold text-foreground">
                Workspace 名称 <span className="text-destructive">*</span>
              </label>
              <input
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  if (nameError && e.target.value.trim()) setNameError(false)
                }}
                placeholder="例如：AI 工程笔记"
                className={cn(
                  'nexus-input h-9 w-full rounded-lg px-3 text-sm font-semibold',
                  nameError && 'border-destructive focus-visible:ring-destructive',
                )}
                autoFocus
                maxLength={100}
              />
              {nameError && (
                <p className="mt-1 text-[11px] text-destructive">请填写 Workspace 名称</p>
              )}
            </div>

            {/* 领域标签 */}
            <div>
              <label className="mb-1 block text-xs font-bold text-foreground">领域标签</label>
              <input
                value={domainTag}
                onChange={(e) => setDomainTag(e.target.value)}
                placeholder="例如：AI / 工程 / 设计"
                list="domain-tag-suggestions"
                className="nexus-input h-9 w-full rounded-lg px-3 text-sm font-semibold"
                maxLength={50}
              />
              {/* datalist：当前不在组件中维护 tag 列表（依赖后端返回），保留扩展位 */}
              <datalist id="domain-tag-suggestions" />
              <p className="mt-1 text-[10px] text-muted-foreground">
                用于在 Workspace 列表中分组，留空归入"未分组"。
              </p>
            </div>

            {/* 描述 */}
            <div>
              <label className="mb-1 block text-xs font-bold text-foreground">描述</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="可选：描述这个 Workspace 用途"
                rows={3}
                className="nexus-input min-h-[64px] w-full rounded-lg px-3 py-2 text-sm font-semibold"
                maxLength={500}
              />
            </div>

            {/* 错误信息 */}
            {submitError && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                <p className="text-[11px] leading-5 text-destructive">{submitError}</p>
              </div>
            )}

            {/* 提交按钮组 */}
            <div className="flex flex-col-reverse gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-end">
              <Dialog.Close asChild>
                <button type="button" className="nexus-button-utility h-9 px-4 text-sm">取消</button>
              </Dialog.Close>
              <button
                type="submit"
                disabled={isSubmitting}
                className="nexus-button-primary h-9 px-5 text-sm font-bold disabled:opacity-50"
              >
                {isSubmitting ? '保存中…' : editing ? '保存' : '创建'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
