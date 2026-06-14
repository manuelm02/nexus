import { useState } from 'react'
import { Copy, Check, Loader2, FileSearch, Wand2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { TagPicker } from './TagPicker'
import type { NoteTagEntry, NoteSummarizeResponse, NoteReorganizeResponse } from '../../../../types/domain.types'

export type NoteSummaryPanelProps = {
  titleQuery: string
  onTitleQueryChange: (value: string) => void
  availableTags: NoteTagEntry[]
  selectedTags: string[]
  onTagsChange: (tags: string[]) => void
  onSummarize: () => void
  isSummarizing: boolean
  result: NoteSummarizeResponse | null
  onReorganize: () => void
  isReorganizing: boolean
  reorganizeResult: NoteReorganizeResponse | null
}

// 笔记汇总面板：按标题关键词 + 标签多选检索笔记，AI 生成 Markdown 汇总并支持一键复制（不写入文件）；同时提供"整理标签"入口，AI 批量修正笔记标签后展示变更列表
export function NoteSummaryPanel({
  titleQuery,
  onTitleQueryChange,
  availableTags,
  selectedTags,
  onTagsChange,
  onSummarize,
  isSummarizing,
  result,
  onReorganize,
  isReorganizing,
  reorganizeResult,
}: NoteSummaryPanelProps) {
  const [copied, setCopied] = useState(false)

  // 标题关键词和标签至少需要一项，否则后端会跳过扫描直接返回空结果
  const canSummarize = titleQuery.trim().length > 0 || selectedTags.length > 0

  const handleCopy = async () => {
    if (!result?.markdown) return
    await navigator.clipboard.writeText(result.markdown)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-lg border bg-card p-3 shadow-[var(--shadow-xs)] space-y-3">
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5">
          <FileSearch className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-bold text-foreground">笔记汇总</span>
        </div>
        <button
          type="button"
          onClick={onReorganize}
          disabled={isReorganizing}
          className="nexus-button-utility flex items-center gap-1 px-2 py-1 text-[11px] disabled:opacity-50"
        >
          {isReorganizing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
          整理标签
        </button>
      </div>

      {reorganizeResult && (
        reorganizeResult.aiUnavailable ? (
          <p className="text-xs text-muted-foreground">AI 未启用，无法整理标签</p>
        ) : reorganizeResult.changes.length === 0 ? (
          <p className="text-xs text-muted-foreground">共扫描 {reorganizeResult.scannedCount} 篇笔记，无需调整</p>
        ) : (
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-foreground space-y-0.5 max-h-40 overflow-y-auto">
            <p className="text-[11px] text-muted-foreground mb-1">
              共扫描 {reorganizeResult.scannedCount} 篇笔记，{reorganizeResult.changes.length} 篇标签已调整：
            </p>
            {reorganizeResult.changes.map((change, idx) => (
              <p key={idx}>
                {change.title || '（无标题）'}：{change.oldTag || '无标签'} → {change.newTag}
              </p>
            ))}
          </div>
        )
      )}

      <input
        value={titleQuery}
        onChange={(e) => onTitleQueryChange(e.target.value)}
        placeholder="按标题关键词筛选..."
        className="nexus-input w-full px-3 py-1.5 text-sm"
      />

      {/* 汇总检索场景的标签多选不限制数量，与笔记录入的 maxTags=1 区分 */}
      <TagPicker availableTags={availableTags} selectedTags={selectedTags} onChange={onTagsChange} />

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onSummarize}
          disabled={!canSummarize || isSummarizing}
          className="nexus-button-primary flex items-center gap-1.5 px-3 py-1.5 text-xs disabled:opacity-50"
        >
          {isSummarizing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <FileSearch className="h-3.5 w-3.5" />
          )}
          生成汇总
        </button>
      </div>

      {result && (
        result.matchedCount === 0 ? (
          <p className="text-xs text-muted-foreground">未找到匹配笔记</p>
        ) : (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">匹配到 {result.matchedCount} 篇笔记</span>
              <button
                type="button"
                onClick={handleCopy}
                className="nexus-button-utility flex items-center gap-1 px-2 py-1 text-[11px]"
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? '已复制' : '复制'}
              </button>
            </div>
            <div className="rounded-md border bg-muted/30 px-3 py-2 max-h-64 overflow-y-auto text-xs text-foreground [&_h1]:text-sm [&_h1]:font-bold [&_h1]:mt-2 [&_h1]:mb-1 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mt-2 [&_h2]:mb-1 [&_h3]:text-xs [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:my-0.5 [&_p]:my-1 [&_strong]:font-semibold [&_code]:text-[11px] [&_code]:bg-muted [&_code]:px-1 [&_code]:rounded [&_a]:text-primary [&_a]:underline">
              <ReactMarkdown>{result.markdown ?? ''}</ReactMarkdown>
            </div>
          </div>
        )
      )}
    </div>
  )
}
