import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { apiClient } from '../../api/client'
import { normalizeTranslationResult, translateApi } from '../../api/translate.api'
import type { ApiResponse } from '../../types/api.types'
import type { LlmProvider, TranslationResult, WorkflowLlmConfig } from '../../types/domain.types'
import { TranslateDesktopView } from './TranslateDesktopView'
import { TranslateMobileView } from './TranslateMobileView'

// TranslatePage 负责统一编排查询、mutation、回填和复制反馈，桌面端与移动端共用这一套业务状态。
export default function TranslatePage() {
  const [sourceText, setSourceText] = useState('')
  const [targetLang, setTargetLang] = useState('英文')
  const [style, setStyle] = useState('')
  const [copied, setCopied] = useState(false)
  const [result, setResult] = useState<TranslationResult | null>(null)
  const [resultStage, setResultStage] = useState<'idle' | 'waiting-draft' | 'draft' | 'streaming' | 'enhancing' | 'done' | 'error'>('idle')
  // 历史搜索和分页：搜索仍是前端处理（后端返回全量），分页走后端接口
  const [historyQuery, setHistoryQuery] = useState('')
  const [historyPage, setHistoryPage] = useState(1)
  const [historyPageSize, setHistoryPageSize] = useState(10)
  const queryClient = useQueryClient()

  // 后端分页查询历史记录，页面/每页条数切换或翻译完成后刷新
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['translate-history', historyPage, historyPageSize],
    queryFn: () => translateApi.history(historyPage, historyPageSize),
  })

  // provider 状态提前查询，避免翻译时才发现不可用。
  const providerQuery = useQuery({
    queryKey: ['llm-providers'],
    queryFn: () => apiClient.get<ApiResponse<LlmProvider[]>>('/settings/llm/providers'),
  })
  const workflowQuery = useQuery({
    queryKey: ['llm-workflows'],
    queryFn: () => apiClient.get<ApiResponse<WorkflowLlmConfig[]>>('/settings/llm/workflows'),
  })

  // 删除历史记录，成功后刷新当前页（如果当前页变空则回退一页）
  const deleteMutation = useMutation({
    mutationFn: (id: string) => translateApi.deleteHistory(id),
    onSuccess: () => {
      const items = historyData?.data?.data?.items ?? []
      // 如果当前页只剩最后一条且不是第一页，回退一页
      if (items.length <= 1 && historyPage > 1) {
        setHistoryPage(historyPage - 1)
      } else {
        queryClient.invalidateQueries({ queryKey: ['translate-history'] })
      }
    },
  })

  // mutation 只在 page 层存在，避免桌面端和移动端复制两套翻译业务流。
  const translateMutation = useMutation({
    mutationFn: () => translateApi.stream({ sourceText, targetLang, style: style || undefined }, (event) => {
      // 后端流式处理内部错误（如 LLM 调用失败），payload 为 null，提前退出
      if (event.type === 'error') {
        setResultStage('error')
        return
      }
      if (!event.payload) return // 防御：非 error 事件理论上 payload 必存在

      const payload = event.payload

      if (event.type === 'draft') {
        setResultStage('draft')
        setResult(normalizeTranslationResult({
          id: 'streaming', sourceText, targetLang, style,
          translatedText: payload.translatedText,
          createdAt: new Date().toISOString(),
        }))
      } else if (event.type === 'token') {
        setResultStage('streaming')
        setResult((current) => normalizeTranslationResult({
          id: current?.id ?? 'streaming', sourceText, targetLang, style,
          createdAt: current?.createdAt ?? new Date().toISOString(),
          translatedText: payload.translatedText,
        }))
      } else if (event.type === 'enhanced') {
        setResultStage('enhancing')
        setResult((current) => normalizeTranslationResult({
          id: current?.id ?? 'streaming', sourceText, targetLang, style,
          createdAt: current?.createdAt ?? new Date().toISOString(),
          translatedText: payload.translatedText,
          explanation: payload.explanation,
          keywords: payload.keywords,
          alternatives: payload.alternatives,
        }))
      } else if (event.type === 'done') {
        setResultStage('done')
      }
    }),
    onSuccess: () => {
      setResultStage('done')
      setHistoryPage(1)
      queryClient.invalidateQueries({ queryKey: ['translate-history'] })
    },
    onError: () => setResultStage('error'),
  })

  const history: TranslationResult[] = historyData?.data?.data?.items ?? []
  const historyTotal = historyData?.data?.data?.total ?? 0
  const historyTotalPages = Math.max(1, Math.ceil(historyTotal / historyPageSize))

  const error = translateMutation.error as AxiosError<ApiResponse<unknown>> | null
  const providers = providerQuery.data?.data?.data ?? []
  const translateWorkflow = workflowQuery.data?.data?.data?.find((workflow) => workflow.workflowType === 'translate')
  const translateProvider = providers.find((provider) => provider.id === translateWorkflow?.providerId)
  const hasResolvableProvider = Boolean(translateProvider?.enabled) || providers.some((provider) => provider.enabled && provider.defaultProvider)
  const providerMissing = error?.response?.data?.errorCode === 'TRANSLATION_PROVIDER_NOT_CONFIGURED' || (!providerQuery.isLoading && !workflowQuery.isLoading && !hasResolvableProvider)
  const providerChecking = providerQuery.isLoading || workflowQuery.isLoading
  const errorMessage = providerMissing ? undefined : error?.response?.data?.message

  const handleCopy = async () => {
    if (!result) return
    await navigator.clipboard.writeText(result.translatedText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleReuseHistory = (item: TranslationResult) => {
    const normalized = normalizeTranslationResult(item)
    setSourceText(normalized.sourceText)
    setTargetLang(normalized.targetLang)
    setStyle(normalized.style ?? '')
    setResult(normalized)
    setResultStage('done')
    setCopied(false)
  }

  const viewProps = {
    sourceText, targetLang, style, result, resultStage, history,
    pending: translateMutation.isPending, copied,
    providerMissing, providerChecking, errorMessage,
    onSourceTextChange: setSourceText,
    onTargetLangChange: setTargetLang,
    onStyleChange: setStyle,
    onTranslate: () => {
      if (providerMissing || providerQuery.isLoading) return
      setResult(null)
      setCopied(false)
      setResultStage('waiting-draft')
      setHistoryQuery('')
      setHistoryPage(1)
      translateMutation.mutate()
    },
    onCopy: handleCopy,
    onReuseHistory: handleReuseHistory,
  }

  const historyProps = {
    history,
    historyLoading,
    historyQuery,
    historyPage,
    historyPageSize,
    historyTotal,
    historyTotalPages,
    onHistoryQueryChange: (q: string) => { setHistoryQuery(q); setHistoryPage(1) },
    onHistoryPageChange: setHistoryPage,
    onHistoryPageSizeChange: (size: number) => { setHistoryPageSize(size); setHistoryPage(1) },
    onReuse: handleReuseHistory,
    onDelete: (id: string) => deleteMutation.mutate(id),
  }

  return (
    <main className="nexus-page-enter mx-auto w-full max-w-[1180px] p-4 sm:p-4 lg:p-6">
      <TranslateDesktopView {...viewProps} {...historyProps} />
      <TranslateMobileView {...viewProps} {...historyProps} />
    </main>
  )
}
