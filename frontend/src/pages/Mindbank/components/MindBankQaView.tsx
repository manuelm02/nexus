import { useState, useRef, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Send, Loader2, FileText, ExternalLink } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { mindbankApi } from '../../../api/mindbank.api'
import type { Workspace, QaMessage } from '../../../types/mindbank.types'
import { cn } from '../../../lib/utils'

type MindBankQaViewProps = {
  workspace: Workspace
}

/**
 * Mindbank Q&A 视图：基于 Workspace 知识库的 RAG 问答。
 * 非流式输出（AnythingLLM 同步返回），本地 useState 管理消息列表，不持久化到 DB。
 */
export function MindBankQaView({ workspace }: MindBankQaViewProps) {
  const [messages, setMessages] = useState<QaMessage[]>([])
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const chatMutation = useMutation({
    mutationFn: (question: string) => mindbankApi.qaChat(workspace.id, question),
    onSuccess: (res) => {
      const data = res.data.data
      if (data) {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: data.answer,
            sources: data.sources,
          },
        ])
      }
    },
    onError: () => {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: '抱歉，查询知识库时出现错误，请稍后重试。',
        },
      ])
    },
  })

  const handleSend = () => {
    const question = input.trim()
    if (!question || chatMutation.isPending) return

    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: 'user', content: question },
    ])
    setInput('')
    chatMutation.mutate(question)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* 顶部说明栏 */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-bold text-foreground">
          基于《{workspace.name}》知识库问答
        </span>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
          {workspace.documentCount} 个文档
        </span>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <p className="text-sm font-bold text-muted-foreground">向知识库提问</p>
            <p className="max-w-xs text-xs text-muted-foreground/70">
              输入问题，AI 将基于 {workspace.name} 的知识库内容为你解答
            </p>
          </div>
        )}
        <div className="space-y-4">
          {messages.map((msg) => (
            <QaMessageBubble key={msg.id} message={msg} />
          ))}
          {chatMutation.isPending && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl border bg-card px-4 py-3">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">正在查询知识库…</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 输入区 */}
      <div className="border-t border-border p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入问题…"
            rows={1}
            className="nexus-input min-h-[40px] flex-1 resize-none px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || chatMutation.isPending}
            className="nexus-button-primary inline-flex h-10 w-10 shrink-0 items-center justify-center disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

/** Q&A 消息气泡，区分 user/assistant，assistant 消息支持 Markdown 渲染和来源引用 */
function QaMessageBubble({ message }: { message: QaMessage }) {
  const isUser = message.role === 'user'

  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div className="max-w-[85%] space-y-2">
        <div
          className={cn(
            'rounded-2xl px-4 py-2.5 text-sm',
            isUser
              ? 'bg-primary text-primary-foreground'
              : 'border bg-card text-foreground',
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>
        {/* 来源引用卡片 */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="space-y-1">
            {message.sources.map((source, idx) => (
              <a
                key={idx}
                href={source}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-md border bg-muted/50 px-2.5 py-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ExternalLink className="h-3 w-3 shrink-0" />
                <span className="truncate">{source}</span>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
