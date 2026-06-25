import React from 'react'
import { cn } from '@/lib/utils'

// PageShell 提供三种统一布局模板：full（全宽单列）、list-detail（左列表+右详情）、with-panel（主内容+右辅助面板）。
//
// 布局纪律（所有页面必须遵守，详见 docs/plans/2026-06-25-warm-studio-ui-redesign.md §布局纪律）：
// 1. 页面 padding 由 PageShell 统一拥有，页面不得自己再加最外层 p-*，否则双重 padding。
// 2. list-detail 的左右两栏由 PageShell 统一框成 nexus-surface 面板，页面不得自己再套 surface。
// 3. 两栏列宽统一用 --shell-list / --shell-panel token，页面不得写死像素。
// 4. list-detail 需要撑满视口高度：其桌面 wrapper 必须提供高度
//    （`hidden h-full md:flex md:flex-col`），PageShell 内部用 flex-1 填充。
export type PageShellVariant = 'full' | 'list-detail' | 'with-panel'

export interface PageShellProps {
  variant: PageShellVariant
  header: React.ReactNode
  children: React.ReactNode
  list?: React.ReactNode
  panel?: React.ReactNode
  /** 单栏页是否给内容套可读宽度上限（默认 false = 满宽铺满，与多栏页一致）。
   *  仅文本极多的页面（如纯阅读/表单）才设 true，避免正文单行过长。 */
  readable?: boolean
}

/** 两栏面板统一外框：撑满高度、内部滚动留给子内容 */
const FRAME = 'nexus-surface flex h-full min-h-0 flex-col overflow-hidden'

export function PageShell({ variant, header, children, list, panel, readable = false }: PageShellProps) {
  // 宽度策略：所有页面默认满宽铺满（保持全站一致的平铺观感）。
  // 仅当页面显式 readable 时，full 单栏内容才套一个可读宽度上限并居中。
  const innerMax = readable && variant === 'full' ? 'mx-auto w-full max-w-[1100px]' : ''
  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      {/* 页眉区：全宽 border-b，视觉高度与侧边栏品牌区对齐（py-5 + 内容 ≈ 84px） */}
      <div className="shrink-0 border-b border-border px-4 py-5 md:px-6">
        {header}
      </div>

      {/* 内容区：提供水平内边距和纵向留白 */}
      <div className={cn('flex min-h-0 flex-1 flex-col px-4 pt-4 pb-4 md:px-6 md:pb-6')}>
        {variant === 'full' && (
          <div className={cn('space-y-4', innerMax)}>{children}</div>
        )}

        {variant === 'list-detail' && (
          <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-[var(--shell-list)_minmax(0,1fr)]">
            {list && <aside className={FRAME}>{list}</aside>}
            <main className={FRAME}>{children}</main>
          </div>
        )}

        {variant === 'with-panel' && (
          <div className="grid min-h-0 flex-1 items-start gap-4 md:grid-cols-[minmax(0,1fr)_var(--shell-panel)]">
            <main className="min-h-0">{children}</main>
            {panel && <aside className="min-h-0">{panel}</aside>}
          </div>
        )}
      </div>
    </div>
  )
}
