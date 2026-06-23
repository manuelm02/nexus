import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Search, Upload, AlertCircle, Loader2, FileText, Globe, Calendar } from 'lucide-react'
import { apiClient } from '../../../api/client'
import type { ApiResponse } from '../../../types/api.types'
import type { MindBankDocument } from '../../../types/mindbank.types'
import { formatRelative } from '../../../lib/utils'

// MinioFilePicker 弹窗：选择 Crawl 已上传但未导入的 MinIO 文件，批量导入到当前 workspace。
export function MinioFilePicker({
  open,
  workspaceId,
  onClose,
  onImported,
}: {
  open: boolean
  workspaceId: number
  onClose: () => void
  onImported: () => void
}) {
  const qc = useQueryClient()
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')

  // 拉取未分配文件
  const filesQuery = useQuery({
    queryKey: ['crawl', 'files', 'unassigned'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<MindBankDocument[]>>('/crawl/files')
      return res.data.data ?? []
    },
    enabled: open,
  })

  // 导入 mutation
  const importMutation = useMutation({
    mutationFn: async (docIds: number[]) => {
      // 后端单条 import 端点：POST /crawl/import { docId, workspaceId }
      // 批量通过 Promise.all 并发请求，单条失败不阻断其他
      const results = await Promise.allSettled(
        docIds.map((docId) =>
          apiClient.post<ApiResponse<void>>('/crawl/import', { docId, workspaceId }),
        ),
      )
      const failed = results.filter((r) => r.status === 'rejected').length
      return { success: docIds.length - failed, failed }
    },
    onSuccess: (result) => {
      // 让 DocumentList 刷新，并刷新 Crawl 文件列表
      qc.invalidateQueries({ queryKey: ['mindbank', 'documents'] })
      qc.invalidateQueries({ queryKey: ['crawl', 'files'] })
      onImported()
      setSelectedIds(new Set())
      if (result.failed > 0) {
        // 部分失败：保留 dialog 由用户确认
        window.alert(`已导入 ${result.success} 个文件，${result.failed} 个失败。`)
      }
    },
  })

  // 过滤
  const files = (filesQuery.data ?? []).filter((f) =>
    searchQuery ? f.fileName.toLowerCase().includes(searchQuery.toLowerCase()) : true,
  )

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleImport = () => {
    if (selectedIds.size === 0) return
    importMutation.mutate(Array.from(selectedIds))
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          onClose()
          setSelectedIds(new Set())
          setSearchQuery('')
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" />
        <Dialog.Content className="nexus-surface fixed inset-x-0 bottom-0 top-auto z-50 max-h-[90dvh] w-full translate-x-0 translate-y-0 overflow-hidden rounded-b-none rounded-t-2xl p-4 sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:w-[calc(100vw-2rem)] sm:max-w-2xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg sm:p-5">
          <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-muted-foreground/25 sm:hidden" />
          <div className="flex items-center justify-between gap-3">
            <Dialog.Title className="text-base font-black">从 Crawl 文件中选择</Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" className="nexus-button-utility hidden h-9 w-9 text-muted-foreground sm:inline-flex" aria-label="关闭">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          {/* 搜索 + Prompt 模板 */}
          <div className="mt-3 space-y-2 border-b pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索文件名…"
                className="nexus-input h-9 w-full rounded-lg pl-9 pr-3 text-sm font-semibold"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold text-muted-foreground">
                整理 Prompt 模板
              </label>
              <select
                disabled
                className="nexus-input h-9 w-full cursor-not-allowed rounded-lg bg-muted/50 px-3 text-xs text-muted-foreground"
                title="待 Phase 6.6 接入"
              >
                <option>系统默认（待 Phase 6.6 接入）</option>
              </select>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Prompt 模板管理在 Phase 6.6 启用，当前使用系统默认模板。
              </p>
            </div>
          </div>

          {/* 文件列表 */}
          <div className="max-h-[50dvh] overflow-y-auto py-2">
            {filesQuery.isLoading ? (
              <div className="flex h-24 items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                加载文件…
              </div>
            ) : files.length === 0 ? (
              <div className="flex h-24 flex-col items-center justify-center gap-1 text-muted-foreground">
                <AlertCircle className="h-5 w-5" />
                <p className="text-xs">没有可导入的文件</p>
                <p className="text-[10px]">先在 Crawl 页面爬取网页或上传文件</p>
              </div>
            ) : (
              <ul className="space-y-1">
                {files.map((file) => {
                  const selected = selectedIds.has(file.id)
                  const SourceIcon = file.sourceType === 'crawl_web' ? Globe : FileText
                  return (
                    <li key={file.id}>
                      <label
                        className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 transition-colors ${
                          selected ? 'border-primary bg-primary/5' : 'hover:bg-accent'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleSelect(file.id)}
                          className="h-4 w-4 rounded border-border text-primary"
                        />
                        <SourceIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold">{file.fileName}</p>
                          <p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Calendar className="h-2.5 w-2.5" />
                            {formatRelative(file.createdAt)}
                            <span>·</span>
                            <span className="font-mono">{file.sourceType}</span>
                          </p>
                        </div>
                      </label>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* 错误信息 */}
          {importMutation.isError && (
            <div className="mt-2 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
              <p className="text-[11px] leading-5 text-destructive">
                {(importMutation.error as Error)?.message || '导入失败'}
              </p>
            </div>
          )}

          {/* 操作栏 */}
          <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3">
            <p className="text-xs text-muted-foreground">
              已选 <span className="font-bold text-foreground">{selectedIds.size}</span> / {files.length} 个
            </p>
            <div className="flex gap-2">
              <Dialog.Close asChild>
                <button type="button" className="nexus-button-utility h-10 px-4 text-sm">取消</button>
              </Dialog.Close>
              <button
                type="button"
                onClick={handleImport}
                disabled={selectedIds.size === 0 || importMutation.isPending}
                className="nexus-button-primary inline-flex h-10 items-center gap-1.5 px-5 text-sm font-bold disabled:opacity-50"
              >
                {importMutation.isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    处理中…
                  </>
                ) : (
                  <>
                    <Upload className="h-3.5 w-3.5" />
                    开始处理
                  </>
                )}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
