import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Upload, Loader2, ChevronDown, ChevronUp, CheckCircle2, AlertTriangle, XCircle, SkipForward, Sparkles, Tag, ExternalLink } from 'lucide-react'
import { cn } from '../../../../lib/utils'
import type { BookmarkImportPreviewResponse, ImportPreviewItem, ConflictPreviewItem, InvalidPreviewItem, ImportAction } from '../../../../types/domain.types'

export type BookmarkImportDrawerProps = {
  open: boolean
  onClose: () => void
  preview: BookmarkImportPreviewResponse | null
  isPreviewing: boolean
  previewError?: string
  onPasteSubmit: (text: string) => void
  onCommit: () => void
  isCommitting: boolean
  commitError?: string
  decisions: Map<number, ImportAction>
  onDecisionChange: (sourceIndex: number, action: ImportAction) => void
}

// 批量导入抽屉：文本粘贴区 + 预览结果四类分区折叠 + 提交导入，桌面 drawer / 移动 bottom sheet。
export function BookmarkImportDrawer({
  open,
  onClose,
  preview,
  isPreviewing,
  previewError,
  onPasteSubmit,
  onCommit,
  isCommitting,
  commitError,
  decisions,
  onDecisionChange,
}: BookmarkImportDrawerProps) {
  const [pasteText, setPasteText] = useState('')
  // 默认展开“将创建”和“冲突”分区，避免预览后看起来异常空白
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ create: true, conflict: true })

  // 抽屉关闭时清空粘贴文本和折叠状态，避免下次打开残留上一次的内容
  useEffect(() => {
    if (!open) {
      setPasteText('')
      setExpanded({ create: true, conflict: true })
    }
  }, [open])

  if (!open) return null
  if (typeof document === 'undefined') return null

  const toggleSection = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  // 父级页面有进入动画 transform，fixed 子元素会被限制在父级内；portal 到 body 才能覆盖完整视口。
  return createPortal((
    <>
      {/* 遮罩层 */}
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />

      {/* 抽屉面板：移动端 bottom sheet，桌面端右侧 drawer。 */}
      <div className={cn(
        'fixed z-50 flex bg-card shadow-xl',
        'inset-x-0 bottom-0 max-h-[88vh] flex-col overflow-hidden rounded-t-xl border border-border',
        'sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-full sm:max-w-[520px] sm:rounded-none sm:border-y-0 sm:border-r-0',
      )}>
        <div className="shrink-0 border-b border-border px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Bookmark Import</p>
              <h2 className="text-base font-bold text-foreground">批量导入书签</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="关闭批量导入"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <XCircle className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="space-y-4">
            {/* 粘贴区 */}
            <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-foreground">粘贴书签</p>
                {isPreviewing && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    解析中
                  </span>
                )}
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                支持 JSON 数组、YAML-like 列表或纯 URL 逐行；纯 URL 行可在 URL 后跟空格分隔标题。
              </p>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={`示例：\n- url: https://example.com\n  title: 示例站点\n\n或：\nhttps://example.com 示例站点\nhttps://openai.com`}
                rows={7}
                className="nexus-input min-h-[180px] w-full resize-none px-3 py-2 font-mono text-xs leading-5"
              />
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] text-muted-foreground">
                  {pasteText.trim() ? `${pasteText.trim().split(/\n+/).length} 行待预览` : '先粘贴内容再预览'}
                </span>
                <button
                  type="button"
                  onClick={() => onPasteSubmit(pasteText)}
                  disabled={!pasteText.trim() || isPreviewing}
                  className="nexus-button-primary flex items-center gap-1.5 px-3 py-1.5 text-xs"
                >
                  {isPreviewing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  预览
                </button>
              </div>
              {previewError && (
                <p className="text-xs text-destructive">{previewError}</p>
              )}
            </div>

            {!preview && (
              <div className="rounded-lg border border-dashed border-border bg-card px-3 py-4 text-center">
                <p className="text-xs font-medium text-foreground">预览结果会显示在这里</p>
                <p className="mt-1 text-[11px] text-muted-foreground">先检查重复、冲突和无效链接，再提交写入。</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  提交后会基于 AI 标签自动生成少量高覆盖智能分组，不会按每个标签建组。
                </p>
              </div>
            )}

            {/* 预览结果 */}
            {preview && (
              <div className="space-y-3">
                {/* 汇总统计栏 */}
                <div className="grid grid-cols-4 gap-2">
                  <StatBadge label="将创建" count={preview.summary.createCount} color="success" />
                  <StatBadge label="跳过" count={preview.summary.skipCount} color="muted" />
                  <StatBadge label="冲突" count={preview.summary.conflictCount} color="warning" />
                  <StatBadge label="无效" count={preview.summary.invalidCount} color="destructive" />
                </div>

                {/* 新建项 */}
                <SectionAccordion
                  title="将创建"
                  icon={<CheckCircle2 className="h-3.5 w-3.5 text-success" />}
                  count={preview.createItems.length}
                  expanded={expanded['create']}
                  onToggle={() => toggleSection('create')}
                >
                  {preview.createItems.map((item) => (
                    <CreatePreviewCard key={item.sourceIndex} item={item} />
                  ))}
                </SectionAccordion>

                {/* 跳过项 */}
                <SectionAccordion
                  title="跳过（已存在）"
                  icon={<SkipForward className="h-3.5 w-3.5 text-muted-foreground" />}
                  count={preview.skipItems.length}
                  expanded={expanded['skip']}
                  onToggle={() => toggleSection('skip')}
                >
                  {preview.skipItems.map((item) => (
                    <SkipPreviewCard key={item.sourceIndex} item={item} />
                  ))}
                </SectionAccordion>

                {/* 冲突项 */}
                <SectionAccordion
                  title="冲突"
                  icon={<AlertTriangle className="h-3.5 w-3.5 text-yellow-600" />}
                  count={preview.conflictItems.length}
                  expanded={expanded['conflict']}
                  onToggle={() => toggleSection('conflict')}
                >
                  {preview.conflictItems.map((item) => (
                    <ConflictPreviewCard
                      key={item.sourceIndex}
                      item={item}
                      decision={decisions.get(item.sourceIndex) || 'skip'}
                      onDecisionChange={(action) => onDecisionChange(item.sourceIndex, action)}
                    />
                  ))}
                </SectionAccordion>

                {/* 无效项 */}
                <SectionAccordion
                  title="无效"
                  icon={<XCircle className="h-3.5 w-3.5 text-destructive" />}
                  count={preview.invalidItems.length}
                  expanded={expanded['invalid']}
                  onToggle={() => toggleSection('invalid')}
                >
                  {preview.invalidItems.map((item) => (
                    <InvalidPreviewCard key={item.sourceIndex} item={item} />
                  ))}
                </SectionAccordion>
              </div>
            )}
          </div>
        </div>

        {preview && (
          <div className="shrink-0 border-t border-border bg-card px-4 py-3">
            <button
              type="button"
              onClick={onCommit}
              disabled={preview.summary.createCount + preview.summary.conflictCount === 0 || isCommitting}
              className="nexus-button-primary flex w-full items-center justify-center gap-1.5 py-2 text-sm"
            >
              {isCommitting && <Loader2 className="h-4 w-4 animate-spin" />}
              提交导入
            </button>
            {commitError && (
              <p className="mt-2 text-xs text-destructive">{commitError}</p>
            )}
          </div>
        )}
      </div>
    </>
  ), document.body)
}

/** 统计数字徽标 */
function StatBadge({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className={cn(
      'rounded-md px-2 py-1.5 text-center',
      color === 'success' && 'bg-success-soft/50',
      color === 'muted' && 'bg-muted',
      color === 'warning' && 'bg-yellow-500/10',
      color === 'destructive' && 'bg-destructive/10',
    )}>
      <p className={cn(
        'text-lg font-bold',
        color === 'success' && 'text-success',
        color === 'muted' && 'text-muted-foreground',
        color === 'warning' && 'text-yellow-600',
        color === 'destructive' && 'text-destructive',
      )}>{count}</p>
      <p className="text-[10px] font-medium text-muted-foreground">{label}</p>
    </div>
  )
}

/** 分区折叠容器 */
function SectionAccordion({
  title, icon, count, expanded, onToggle, children,
}: {
  title: string; icon: React.ReactNode; count: number; expanded: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card/50">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-3 py-2 text-xs"
      >
        <span className="flex items-center gap-1.5 font-semibold text-foreground">
          {icon}
          {title} ({count})
        </span>
        {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>
      {expanded && <div className="px-3 pb-2 space-y-1.5">{children}</div>}
    </div>
  )
}

/** 新建预览卡片 */
function CreatePreviewCard({ item }: { item: ImportPreviewItem }) {
  return (
    <div className="rounded-md bg-card border px-3 py-2">
      <p className="text-xs font-semibold text-foreground truncate">{item.suggestedTitle || item.title || item.domain}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground truncate">{item.normalizedUrl}</p>
      {item.suggestedTags && item.suggestedTags.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {item.suggestedTags.map((t) => (
            <span key={t} className="inline-flex items-center gap-0.5 rounded-full bg-accent px-1.5 py-0.5 text-[10px] text-accent-foreground">
              <Tag className="h-2 w-2" />{t}
            </span>
          ))}
        </div>
      )}
      {item.suggestedGroupName && (
        <p className="mt-1 text-[10px] text-muted-foreground">
          <Sparkles className="inline h-2.5 w-2.5 text-primary mr-0.5" />
          {item.suggestedGroupName}
        </p>
      )}
    </div>
  )
}

/** 跳过预览卡片 */
function SkipPreviewCard({ item }: { item: ImportPreviewItem }) {
  return (
    <div className="rounded-md bg-muted/50 border px-3 py-2">
      <p className="text-xs font-semibold text-muted-foreground truncate">{item.title || item.domain}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground/70 truncate">{item.normalizedUrl}</p>
    </div>
  )
}

/** 冲突预览卡片 */
function ConflictPreviewCard({
  item, decision, onDecisionChange,
}: {
  item: ConflictPreviewItem; decision: ImportAction; onDecisionChange: (action: ImportAction) => void;
}) {
  return (
    <div className="rounded-md border bg-card px-3 py-2 space-y-2">
      {/* 对比双卡片 */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded bg-muted/30 px-2 py-1.5">
          <p className="text-[10px] font-semibold text-muted-foreground">新书签</p>
          <p className="text-xs font-medium truncate">{item.title || '未命名'}</p>
          <p className="text-[10px] text-muted-foreground truncate">{item.url}</p>
        </div>
        <div className="rounded bg-muted/30 px-2 py-1.5 relative">
          <p className="text-[10px] font-semibold text-muted-foreground">已有</p>
          <a
            href={item.existingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium truncate hover:text-primary inline-flex items-center gap-0.5"
          >
            {item.existingTitle || item.existingUrl}
            <ExternalLink className="h-2.5 w-2.5" />
          </a>
        </div>
      </div>

      {/* AI 裁决 */}
      {item.aiVerdict && (
        <p className={cn(
          'text-[10px] rounded px-1.5 py-0.5 inline-flex items-center gap-1',
          item.aiVerdict === 'same' && 'bg-yellow-500/10 text-yellow-600',
          item.aiVerdict === 'different' && 'bg-success-soft/50 text-success',
          item.aiVerdict === 'low_confidence' && 'bg-muted text-muted-foreground',
        )}>
          <Sparkles className="h-2.5 w-2.5" />
          {item.aiVerdict === 'same' ? 'AI 判断：相同内容' :
           item.aiVerdict === 'different' ? 'AI 判断：不同内容' : 'AI 判断：低置信度'}
        </p>
      )}

      {/* 决策按钮 */}
      <div className="flex gap-1">
        {(['update', 'create', 'skip'] as ImportAction[]).map((action) => (
          <button
            key={action}
            type="button"
            onClick={() => onDecisionChange(action)}
            className={cn(
              'flex-1 rounded-md px-2 py-1 text-[10px] font-semibold transition-colors',
              decision === action
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground',
            )}
          >
            {action === 'update' ? '更新旧记录' : action === 'create' ? '作为新书签' : '跳过'}
          </button>
        ))}
      </div>
    </div>
  )
}

/** 无效预览卡片 */
function InvalidPreviewCard({ item }: { item: InvalidPreviewItem }) {
  return (
    <div className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2">
      <p className="text-xs font-semibold text-destructive truncate">{item.url || '(空)'}</p>
      <p className="mt-0.5 text-[11px] text-destructive/70">{item.reason}</p>
    </div>
  )
}
