import { useState } from 'react'
import { Trash2, ChevronDown, Check } from 'lucide-react'
import * as Select from '@radix-ui/react-select'
import type { TranslationResult } from '../../../types/domain.types'
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

// TranslateHistoryList 支持搜索、后端分页、删除确认和回填，桌面双列、移动单列。
export function TranslateHistoryList({ history, historyLoading, historyQuery, historyPage, historyPageSize, historyTotal, historyTotalPages, onHistoryQueryChange, onHistoryPageChange, onHistoryPageSizeChange, onReuse, onDelete, mode }: TranslateHistoryListProps) {
  // 当前正在确认删除的记录 id，null 表示没有弹窗
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-foreground">历史记录</h2>
          <p className="text-xs leading-6 text-muted-foreground">点击任意记录，可回填到当前工作区。</p>
        </div>
        <span className="text-xs font-bold text-muted-foreground">{historyTotal} 条</span>
      </div>

      {historyTotal > 0 && (
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <input
              value={historyQuery}
              onChange={(event) => onHistoryQueryChange(event.target.value)}
              placeholder="搜索原文、译文或关键词"
              className="nexus-input w-full px-3 text-sm md:w-72"
            />
            <Select.Root value={String(historyPageSize)} onValueChange={(v) => onHistoryPageSizeChange(Number(v))}>
              <Select.Trigger className="nexus-input inline-flex h-8 shrink-0 items-center gap-1 rounded-md border bg-background px-2 text-xs hover:bg-accent/40 focus:outline-none focus:ring-2 focus:ring-ring">
                <Select.Value /> <span className="text-muted-foreground">条/页</span>
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
          </div>
          {historyTotalPages > 1 && (
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <button type="button" onClick={() => onHistoryPageChange(historyPage - 1)} disabled={historyPage <= 1} className="nexus-button-utility px-2.5 py-1 text-xs disabled:opacity-40">上一页</button>
              <span className="min-w-[3em] text-center">{historyPage} / {historyTotalPages}</span>
              <button type="button" onClick={() => onHistoryPageChange(historyPage + 1)} disabled={historyPage >= historyTotalPages} className="nexus-button-utility px-2.5 py-1 text-xs disabled:opacity-40">下一页</button>
            </div>
          )}
        </div>
      )}

      {historyLoading ? (
        <div className="nexus-surface p-4 text-sm text-muted-foreground">加载中...</div>
      ) : history.length === 0 ? (
        <div className="nexus-surface p-4 text-sm leading-7 text-muted-foreground">
          {historyTotal === 0 ? '完成第一次翻译后，历史会出现在这里。' : '没有匹配的记录。'}
        </div>
      ) : mode === 'desktop' ? (
        <ul className="grid gap-2 md:grid-cols-2">
          {history.map((item) => (
            <li key={item.id}>
              {/* 用 div + role="button" 替代 button，避免内嵌的删除按钮/气泡触发 DOM nesting 警告 */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => onReuse(item)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onReuse(item) } }}
                className="nexus-surface group relative w-full cursor-pointer p-3 text-left transition-colors hover:border-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="grid gap-2 sm:grid-cols-[1fr_1.1fr]">
                  <p className="line-clamp-1 text-sm leading-6 text-muted-foreground">{item.sourceText}</p>
                  <p className="line-clamp-1 text-sm font-semibold leading-6 text-foreground">{item.translatedText}</p>
                </div>
                <p className="mt-2 text-xs font-semibold text-muted-foreground">{formatRelative(item.createdAt)} · {item.targetLang} · {styleLabel(item.style)}</p>
                {/* 删除按钮：hover 时显示，点击先进入确认态 */}
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); setConfirmingId(item.id) }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); setConfirmingId(item.id) } }}
                  className="absolute right-2 top-2 hidden h-7 w-7 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:flex group-hover:opacity-100"
                  aria-label="删除记录"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </span>
                {/* 删除确认气泡 */}
                {confirmingId === item.id && (
                  <div
                    className="absolute right-2 top-10 z-10 rounded-lg border border-border bg-popover p-2 shadow-lg"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <p className="mb-2 text-xs font-semibold text-foreground">确认删除这条记录？</p>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => setConfirmingId(null)}
                        className="nexus-button-utility px-2.5 py-1 text-xs"
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        onClick={() => { onDelete(item.id); setConfirmingId(null) }}
                        className="rounded-md bg-destructive px-2.5 py-1 text-xs font-bold text-destructive-foreground hover:bg-destructive/90"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="space-y-2">
          {history.map((item) => (
            <li key={item.id}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => onReuse(item)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onReuse(item) } }}
                className="nexus-surface group relative w-full cursor-pointer p-3 text-left transition-colors hover:border-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <p className="line-clamp-1 pr-8 text-sm text-muted-foreground">{item.sourceText}</p>
                <p className="mt-1 line-clamp-1 text-sm font-semibold text-foreground">{item.translatedText}</p>
                <p className="mt-2 text-xs font-semibold text-muted-foreground">{formatRelative(item.createdAt)} · {item.targetLang} · {styleLabel(item.style)}</p>
                {/* 移动端删除按钮始终可见 */}
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => { e.stopPropagation(); setConfirmingId(item.id) }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); setConfirmingId(item.id) } }}
                  className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  aria-label="删除记录"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </span>
                {confirmingId === item.id && (
                  <div
                    className="absolute right-2 top-10 z-10 rounded-lg border border-border bg-popover p-2 shadow-lg"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <p className="mb-2 text-xs font-semibold text-foreground">确认删除这条记录？</p>
                    <div className="flex gap-1.5">
                      <button type="button" onClick={() => setConfirmingId(null)} className="nexus-button-utility px-2.5 py-1 text-xs">取消</button>
                      <button type="button" onClick={() => { onDelete(item.id); setConfirmingId(null) }} className="rounded-md bg-destructive px-2.5 py-1 text-xs font-bold text-destructive-foreground hover:bg-destructive/90">删除</button>
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
