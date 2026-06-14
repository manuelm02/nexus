import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { inboxApi } from '../../../api/inbox.api'
import { mergeNoteContent } from '../utils/noteMerge'
import type {
  NoteAnalyzeResponse,
  NoteTagEntry,
  NoteSummarizeResponse,
  NoteReorganizeResponse,
  QuickNoteResponse,
} from '../../../types/domain.types'

/**
 * 封装速记 / 备忘录单个分区（kind 固定）的全部状态与请求逻辑：
 * 草稿编辑、AI 分析与应用建议、保存（含标签索引写回）、标签索引拉取、笔记汇总检索。
 * 速记和备忘录分别调用一次该 hook，状态完全隔离。
 */
export function useNoteSection(kind: 'quick_note' | 'memo') {
  const qc = useQueryClient()

  // ==================== 草稿编辑状态 ====================
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  // AI 分析返回的新建标签说明，随保存请求一起提交，由后端写回标签索引文件
  const [newTagDescriptions, setNewTagDescriptions] = useState<Record<string, string>>({})
  const [lastResult, setLastResult] = useState<QuickNoteResponse | null>(null)

  // ==================== 标签索引 ====================
  const tagsQuery = useQuery({
    queryKey: ['inbox', 'notes', 'tags', kind],
    queryFn: () => inboxApi.notes.tags(kind),
  })
  const indexedTags = tagsQuery.data?.data?.data ?? []

  // AI 本次建议的新标签：写回索引前也需要在 TagPicker 中可见/可勾选，因此先合入本地可选列表
  const [pendingNewTags, setPendingNewTags] = useState<NoteTagEntry[]>([])
  const availableTags: NoteTagEntry[] = [
    ...indexedTags,
    ...pendingNewTags.filter((t) => !indexedTags.some((e) => e.name === t.name)),
  ]

  // ==================== AI 分析 ====================
  const [aiResult, setAiResult] = useState<NoteAnalyzeResponse | null>(null)

  const analyzeMutation = useMutation({
    mutationFn: (data: Parameters<typeof inboxApi.notes.analyze>[0]) => inboxApi.notes.analyze(data),
    onSuccess: (res) => {
      const result = res.data?.data
      if (result) setAiResult(result)
    },
  })

  const onAnalyze = () => {
    analyzeMutation.mutate({
      content,
      title: title || undefined,
      kind,
      tags: selectedTags.length > 0 ? selectedTags : undefined,
    })
  }

  const resetAnalyze = () => setAiResult(null)

  // 应用 AI 建议：覆盖标题、采用建议标签（截断至 1）、保守合并整理后的正文；
  // AI 新建的标签先加入本地可选列表供勾选，真正写回索引在保存时发生
  const onApplySuggestion = () => {
    if (!aiResult) return
    if (aiResult.suggestedTitle) setTitle(aiResult.suggestedTitle)
    if (aiResult.suggestedTags) setSelectedTags(aiResult.suggestedTags.slice(0, 1))
    if (aiResult.cleanedMarkdown) {
      setContent((prev) => mergeNoteContent(prev, aiResult.cleanedMarkdown))
    }
    if (aiResult.newTagDescriptions && Object.keys(aiResult.newTagDescriptions).length > 0) {
      setNewTagDescriptions(aiResult.newTagDescriptions)
      setPendingNewTags(
        Object.entries(aiResult.newTagDescriptions).map(([name, description]) => ({ name, description })),
      )
    }
    setAiResult(null)
  }

  // ==================== 保存 ====================
  const saveMutation = useMutation({
    mutationFn: (data: Parameters<typeof inboxApi.notes.create>[0]) => inboxApi.notes.create(data),
    onSuccess: (res) => {
      const result = res.data?.data
      if (result) setLastResult(result)
      // 用户未选标签时由后端 AI 自动打标签；保存成功后用 result.tag 同步前端选中状态，
      // 让用户看到本次实际写入的标签。若该标签是后端新建的（不在当前可选列表中），
      // 临时加入 pendingNewTags 供 TagPicker 立即可见，真实索引由下方 invalidateQueries 刷新
      if (result?.tag) {
        setSelectedTags([result.tag])
        if (!availableTags.some((t) => t.name === result.tag)) {
          setPendingNewTags((prev) => [...prev, { name: result.tag!, description: '' }])
        }
      }
      // 保存成功后标签索引可能新增了标签，刷新供 TagPicker 使用
      qc.invalidateQueries({ queryKey: ['inbox', 'notes', 'tags', kind] })
    },
  })

  const onSave = () => {
    setLastResult(null)
    saveMutation.mutate({
      content,
      title: title || undefined,
      kind,
      tags: selectedTags.length > 0 ? selectedTags : undefined,
      newTagDescriptions: Object.keys(newTagDescriptions).length > 0 ? newTagDescriptions : undefined,
    })
  }

  const saveError = saveMutation.isError
    ? (saveMutation.error as { response?: { data?: { message?: string } } })?.response?.data?.message
      || (saveMutation.error as Error)?.message || '保存失败'
    : undefined

  // Obsidian 配置状态：通过笔记保存错误码判断
  const obsidianConfigured = saveMutation.error
    ? (saveMutation.error as { response?: { data?: { errorCode?: string } } })?.response?.data?.errorCode !== 'OBSIDIAN_NOT_CONFIGURED'
    : true

  // 一键清空草稿：标题/内容/标签/AI 建议/上次保存结果一并清空
  const onClearDraft = () => {
    setTitle('')
    setContent('')
    setSelectedTags([])
    setNewTagDescriptions({})
    setPendingNewTags([])
    setAiResult(null)
    setLastResult(null)
  }

  // ==================== 汇总检索 ====================
  const [summaryTitleQuery, setSummaryTitleQuery] = useState('')
  const [summaryTags, setSummaryTags] = useState<string[]>([])
  const [summaryResult, setSummaryResult] = useState<NoteSummarizeResponse | null>(null)

  const summarizeMutation = useMutation({
    mutationFn: (data: Parameters<typeof inboxApi.notes.summarize>[0]) => inboxApi.notes.summarize(data),
    onSuccess: (res) => {
      const result = res.data?.data
      if (result) setSummaryResult(result)
    },
  })

  const onSummarize = () => {
    summarizeMutation.mutate({
      kind,
      titleQuery: summaryTitleQuery || undefined,
      tags: summaryTags.length > 0 ? summaryTags : undefined,
    })
  }

  // ==================== AI 标签整理 ====================
  const [reorganizeResult, setReorganizeResult] = useState<NoteReorganizeResponse | null>(null)

  const reorganizeMutation = useMutation({
    mutationFn: () => inboxApi.notes.reorganizeTags({ kind }),
    onSuccess: (res) => {
      const result = res.data?.data
      if (result) setReorganizeResult(result)
      // 整理后标签可能新增/变化，刷新标签索引供 TagPicker 使用
      qc.invalidateQueries({ queryKey: ['inbox', 'notes', 'tags', kind] })
    },
  })

  const onReorganize = () => {
    setReorganizeResult(null)
    reorganizeMutation.mutate()
  }

  return {
    kind,
    title,
    content,
    selectedTags,
    onTitleChange: setTitle,
    onContentChange: setContent,
    onTagsChange: setSelectedTags,
    availableTags,
    aiAvailable: true,
    aiResult,
    isAnalyzing: analyzeMutation.isPending,
    onAnalyze,
    onApplySuggestion,
    resetAnalyze,
    onSave,
    isSaving: saveMutation.isPending,
    saveError,
    obsidianConfigured,
    lastResult,
    onClearResult: () => setLastResult(null),
    onClearDraft,
    summaryTitleQuery,
    onSummaryTitleQueryChange: setSummaryTitleQuery,
    summaryTags,
    onSummaryTagsChange: setSummaryTags,
    onSummarize,
    isSummarizing: summarizeMutation.isPending,
    summaryResult,
    onReorganize,
    isReorganizing: reorganizeMutation.isPending,
    reorganizeResult,
  }
}

export type NoteSectionState = ReturnType<typeof useNoteSection>
