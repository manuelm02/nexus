import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { translateApi } from '../../api/translate.api'
import type { Translation } from '../../types/domain.types'
import { formatRelative, cn } from '../../lib/utils'
import { ArrowRight, Copy, Check } from 'lucide-react'

const LANGUAGES = ['中文', '英文', '日文', '法文', '德文', '西班牙文', '韩文']
const STYLES = [
  { value: '',         label: '默认' },
  { value: 'formal',   label: '正式' },
  { value: 'casual',   label: '口语' },
  { value: 'technical',label: '技术' },
]

// TranslatePage 提供文本翻译和最近翻译历史。
export default function TranslatePage() {
  const [sourceText, setSourceText] = useState('')
  const [targetLang, setTargetLang] = useState('英文')
  const [style, setStyle] = useState('')
  const [copied, setCopied] = useState(false)
  const [result, setResult] = useState<Translation | null>(null)

  const { data: historyData } = useQuery({
    queryKey: ['translate-history'],
    queryFn: () => translateApi.history(),
  })

  const translateMutation = useMutation({
    mutationFn: () => translateApi.translate({ sourceText, targetLang, style: style || undefined }),
    onSuccess: ({ data }) => {
      if (data.data) setResult(data.data)
    },
  })

  const history: Translation[] = historyData?.data?.data ?? []

  const handleCopy = async () => {
    if (!result) return
    await navigator.clipboard.writeText(result.translatedText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Translate</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          同一个意思，换一种语言，你会看见它不同的棱角。
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex gap-3 flex-wrap items-center">
          <select
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value)}
            className="rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <div className="flex gap-1">
            {STYLES.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setStyle(value)}
                className={cn(
                  'rounded px-2.5 py-1 text-xs border transition-colors',
                  style === value ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <textarea
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            placeholder="输入要翻译的文本…"
            rows={6}
            className="rounded-lg border bg-card p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
          <div className="relative rounded-lg border bg-card p-3 min-h-[120px]">
            {result ? (
              <>
                <p className="text-sm whitespace-pre-wrap">{result.translatedText}</p>
                <button
                  onClick={handleCopy}
                  className="absolute top-2 right-2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">翻译结果将显示在这里</p>
            )}
          </div>
        </div>

        <button
          onClick={() => translateMutation.mutate()}
          disabled={!sourceText.trim() || translateMutation.isPending}
          className="flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {translateMutation.isPending ? '翻译中…' : <>翻译 <ArrowRight className="h-4 w-4" /></>}
        </button>
      </div>

      {history.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-muted-foreground">历史记录</h2>
          <ul className="space-y-2">
            {history.slice(0, 10).map((t) => (
              <li key={t.id} className="rounded-lg border bg-card p-3 text-sm">
                <div className="grid md:grid-cols-2 gap-2">
                  <p className="text-muted-foreground line-clamp-2">{t.sourceText}</p>
                  <p className="line-clamp-2">{t.translatedText}</p>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{formatRelative(t.createdAt)} · {t.targetLang}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
