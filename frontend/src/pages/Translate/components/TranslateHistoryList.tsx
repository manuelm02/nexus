import { useState } from 'react'
import { Trash2, Search, ChevronDown, ChevronLeft, ChevronRight, Check } from 'lucide-react'
import * as Select from '@radix-ui/react-select'
import type { TranslationResult } from '../../../types/domain.types'
import { EmptyState } from '../../../components/shell'
import { formatRelative } from '../../../lib/utils'
import { styleLabel } from '../translate.shared'

type TranslateHistoryListProps = {
  history: TranslationResult[]
  historyLoading: boolean
  historyQuery: string
  historyPage: number
  historyPageSize: number
  historyTotal: number
  historyTotalPages: number
  onHistoryQueryChange: (value: string) => void
  onHistoryPageChange: (page: number) => void
  onHistoryPageSizeChange: (size: number) => void
  onReuse: (item: TranslationResult) => void
  onDelete: (id: string) => void
  mode: 'desktop' | 'mobile'
}

// TranslateHistoryList 将搜索、分页收进统一工具条，卡片压缩为紧凑扫描流。
export function TranslateHistoryList({ history, historyLoading, historyQuery, historyPage, historyPageSize, historyTotal, historyTotalPages, onHistoryQueryChange, onHistoryPageChange, onHistoryPageSizeChange, onReuse, onDelete, mode }: TranslateHistoryListProps) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  return (
    <section className="space-y-3">
      {/* 标题行 */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-foreground">历史记录</h2>
        </div>
        <span className="text-xs font-bold text-muted-foreground">{historyTotal} 条</span>
      </div>

      {/* 统一工具条：搜索 + 每页条数 + 分页，收进同一 surface */}
      {historyTotal > 0 && (
        <div className="nexus-surface flex flex-wrap items-center gap-2 p-2.5">
          {/* 搜索框 */}
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
            <input
              value={historyQuery}
              onChange={(event) => onHistoryQueryChange(event.target.value)}
              placeholder="搜索..."
              className="nexus-input h-9 w-full pl-8 pr-3 text-xs"
            />
          </div>

          {/* 每页条数 */}
          <Select.Root value={String(historyPageSize)} onValueChange={(v) => onHistoryPageSizeChange(Number(v))}>
            <Select.Trigger className="nexus-input inline-flex h-9 shrink-0 items-center gap-0.5 px-2 text-xs hover:bg-accent/40">
              <Select.Value />
              <Select.Icon><ChevronDown className="h-3 w-3 text-muted-foreground" /></Select.Icon>
            </Select.Trigger>
            <Select.Portal>
              <Select.Content position="popper" sideOffset={4} className="z-[70] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg">
                <Select.Viewport>
                  {[5, 10, 15].map((size) => (
                    <Select.Item key={size} value={String(size)} className="relative flex h-8 cursor-default select-none items-center rounded-md px-7 text-xs font-semibold outline-none transition-colors data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground">
                      <Select.ItemIndicator className="absolute left-2 flex h-4 w-4 items-center justify-center text-primary"><Check className="h-3 w-3" /></Select.ItemIndicator>
                      <Select.ItemText>{size} 条/页</Select.ItemText>
                    </Select.Item>
                  ))}
                </Select.Viewport>
              </Select.Content>
            </Select.Portal>
          </Select.Root>

          {/* 分页：仅多页时显示 */}
          {historyTotalPages > 1 && (
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => onHistoryPageChange(historyPage - 1)}
                disabled={historyPage <= 1}
                className="nexus-button-utility flex h-9 w-9 items-center justify-center p-0 disabled:opacity-30"
                aria-label="上一页"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="min-w-[2.5em] text-center text-[11px] font-bold text-muted-foreground">
                {historyPage}/{historyTotalPages}
              </span>
              <button
                type="button"
                onClick={() => onHistoryPageChange(historyPage + 1)}
                disabled={historyPage >= historyTotalPages}
                className="nexus-button-utility flex h-9 w-9 items-center justify-center p-0 disabled:opacity-30"
                aria-label="下一页"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {historyLoading ? (
        <div className="nexus-surface p-4 text-sm text-muted-foreground">加载中...</div>
      ) : history.length === 0 ? (
        historyTotal === 0 ? (
          <EmptyState title="暂无翻译记录" hint="翻译完成后历史将显示在这里。" />
        ) : (
          <div className="nexus-surface p-4 text-sm leading-7 text-muted-foreground">没有匹配的记录。</div>
        )
      ) : mode === 'desktop' ? (
        <ul className="grid gap-1.5 md:grid-cols-2">
          {history.map((item) => (
            <li key={item.id}>
              {/* 用 div + role="button" 替代 button，避免内嵌操作触发 DOM nesting 警告 */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => onReuse(item)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onReuse(item) } }}
                className="nexus-surface group relative w-full cursor-pointer p-2.5 text-left transition-colors hover:border-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {/* 原文摘要：单行截断 */}
                <p className="line-clamp-1 text-xs leading-6 text-muted-foreground">{item.sourceText}</p>
                {/* 译文摘要：单行截断 */}
                <p className="line-clamp-1 text-[13px] font-semibold leading-6 text-foreground">{item.translatedText}</p>
                {/* 元信息行：时间 + 目标语言 + 风格 */}
                <p className="mt-1 text-[11px] font-semibold text-muted-foreground/65">
                  {formatRelative(item.createdAt)} · {item.targetLang} · {styleLabel(item.style)}
                </p>

                {/* 删除按钮：桌面端 hover 时才显示，移动端删除逻辑在下方的移动端分支 */}
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); setConfirmingId(item.id) }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); setConfirmingId(item.id) } }}
                  className="absolute right-1.5 top-1.5 hidden h-6 w-6 items-center justify-center rounded-md text-muted-foreground/30 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:flex"
                  aria-label="删除记录"
                >
                  <Trash2 className="h-3 w-3" />
                </span>

                {/* 删除确认气泡 */}
                {confirmingId === item.id && (
                  <div
                    className="absolute right-2 top-9 z-10 rounded-lg border border-border bg-popover p-2 shadow-lg"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <p className="mb-2 text-xs font-semibold text-foreground">确认删除？</p>
                    <div className="flex gap-1.5">
                      <button type="button" onClick={() => setConfirmingId(null)} className="nexus-button-utility px-2 py-0.5 text-[11px]">取消</button>
                      <button type="button" onClick={() => { onDelete(item.id); setConfirmingId(null) }} className="rounded-md bg-destructive px-2 py-0.5 text-[11px] font-bold text-destructive-foreground hover:bg-destructive/90">删除</button>
                    </div>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="space-y-1.5">
          {history.map((item) => (
            <li key={item.id}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => onReuse(item)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onReuse(item) } }}
                className="nexus-surface group relative w-full cursor-pointer p-2.5 text-left transition-colors hover:border-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <p className="line-clamp-1 pr-7 text-xs text-muted-foreground">{item.sourceText}</p>
                <p className="mt-0.5 line-clamp-1 text-[13px] font-semibold text-foreground">{item.translatedText}</p>
                <p className="mt-1 text-[11px] font-semibold text-muted-foreground/65">{formatRelative(item.createdAt)} · {item.targetLang} · {styleLabel(item.style)}</p>
                {/* 移动端删除按钮始终可见 */}
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); setConfirmingId(item.id) }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); setConfirmingId(item.id) } }}
                  className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/50 hover:bg-destructive/10 hover:text-destructive"
                  aria-label="删除记录"
                >
                  <Trash2 className="h-3 w-3" />
                </span>
                {confirmingId === item.id && (
                  <div
                    className="absolute right-2 top-9 z-10 rounded-lg border border-border bg-popover p-2 shadow-lg"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <p className="mb-2 text-xs font-semibold text-foreground">确认删除？</p>
                    <div className="flex gap-1.5">
                      <button type="button" onClick={() => setConfirmingId(null)} className="nexus-button-utility px-2 py-0.5 text-[11px]">取消</button>
                      <button type="button" onClick={() => { onDelete(item.id); setConfirmingId(null) }} className="rounded-md bg-destructive px-2 py-0.5 text-[11px] font-bold text-destructive-foreground hover:bg-destructive/90">删除</button>
                    </div>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
