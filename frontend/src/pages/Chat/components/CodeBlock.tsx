import { useState } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Check, Copy } from 'lucide-react'
import { cn } from '../../../lib/utils'

type CodeBlockProps = {
  language: string
  value: string
}

// CodeBlock 渲染带语言标签与一键复制的高亮代码块
export function CodeBlock({ language, value }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="my-3 overflow-hidden rounded-lg border bg-[#282c34]">
      <div className="flex items-center justify-between border-b border-white/10 bg-black/20 px-3 py-1.5">
        <span className="text-[11px] font-bold text-white/70">{language || 'text'}</span>
        <button
          type="button"
          onClick={handleCopy}
          className={cn(
            'inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold text-white/80 transition-colors hover:bg-white/10',
            copied && 'text-success',
          )}
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? '已复制' : '复制'}
        </button>
      </div>
      <SyntaxHighlighter
        language={language || 'text'}
        style={oneDark}
        customStyle={{ margin: 0, padding: '1rem', fontSize: '0.8rem', background: 'transparent' }}
      >
        {value}
      </SyntaxHighlighter>
    </div>
  )
}
