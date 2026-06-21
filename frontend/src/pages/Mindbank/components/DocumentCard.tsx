import { Globe, FileText, Clock } from 'lucide-react'
import { formatRelative } from '../../../lib/utils'
import type { MindBankDocument, SourceType } from '../../../types/mindbank.types'
import { PipelineStatus } from './PipelineStatus'

/**
 * DocumentCard 单个 Mindbank 文档卡片，展示文件名、来源类型、创建时间和 5 步流水线状态。
 * 整体可点击（占位：未来进入详情页），内部操作按钮不传递点击事件。
 */
export function DocumentCard({
  document,
  onRetryStep,
}: {
  document: MindBankDocument
  onRetryStep?: (step: number) => void
}) {
  const SourceIcon = sourceIcon(document.sourceType)
  const isProcessing = document.pipelineStatus === 'processing'

  return (
    <div className="nexus-surface group relative flex flex-col gap-2 p-3 transition-colors hover:border-primary/40">
      {/* 头部：图标 + 文件名 + 时间 */}
      <div className="flex items-start gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <SourceIcon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-foreground" title={document.fileName}>
            {document.fileName}
          </p>
          <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
            <span className="inline-flex items-center gap-0.5">
              <Clock className="h-2.5 w-2.5" />
              {formatRelative(document.createdAt)}
            </span>
            {document.contentTypeTag && (
              <span className="rounded bg-muted px-1.5 py-px font-mono text-[9px] font-black">
                {document.contentTypeTag}
              </span>
            )}
            {isProcessing && (
              <span className="inline-flex items-center gap-0.5 font-bold text-primary">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                处理中
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 流水线状态 */}
      <div className="border-t border-border/50 pt-2">
        <PipelineStatus document={document} onRetryStep={onRetryStep} />
        {document.stepErrorMsg && document.pipelineStatus !== 'failed' && (
          <p className="mt-1.5 line-clamp-1 text-[10px] leading-4 text-muted-foreground">
            {document.stepErrorMsg}
          </p>
        )}
      </div>
    </div>
  )
}

/** 文档来源类型 → 图标 */
function sourceIcon(sourceType: SourceType | string): typeof Globe {
  if (sourceType === 'crawl_web') return Globe
  return FileText
}
