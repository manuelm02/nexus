import { useState, useRef, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Send, Loader2, FileText, ExternalLink, ChevronDown, ChevronRight, Sparkles } from 'lucide-react'
import * as Switch from '@radix-ui/react-switch'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { mindbankApi } from '../../../api/mindbank.api'
import type { Workspace, QaMessage } from '../../../types/mindbank.types'
import { cn } from '../../../lib/utils'
import { AgentTraceLoader } from './AgentTraceLoader'

type MindBankQaViewProps = {
  workspace: Workspace
}

/**
 * Mindbank Q&A 视图：基于 Workspace 知识库的 RAG 问答。
 * 支持两种模式：
 * - 简单模式（默认）：固定单 Workspace RAG，AnythingLLM 同步返回，快但只查一个库
 * - Agent 模式：Agent C 自主检索多个 Workspace，多轮检索后综合回答，慢但更全面
 *
 * Agent 模式下 AI 回答附带可展开的执行轨迹（复用 AgentTraceLoader 组件）。
 * 非流式输出，本地 useState 管理消息列表，不持久化到 DB。
 */
export function MindBankQaView({ workspace }: MindBankQaViewProps) {
  const [messages, setMessages] = useState<QaMessage[]>([])
  const [input, setInput] = useState('')
  // Agent 模式开关，默认关闭省 token；用户主动开启获得更智能的检索
  const [agentMode, setAgentMode] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const chatMutation = useMutation({
    mutationFn: (params: { question: string; agentMode: boolean }) =>
      mindbankApi.qaChat(workspace.id, params.question, params.agentMode),
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
            // Agent 模式返回 agentTaskId，用于展开执行轨迹
            agentTaskId: data.agentTaskId,
            agentMode: data.mode === 'agent',
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
    chatMutation.mutate({ question, agentMode })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* 顶部说明栏 + Agent 模式开关 */}
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="text-xs font-bold text-foreground truncate">
            基于《{workspace.name}》知识库问答
          </span>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary shrink-0">
            {workspace.documentCount} 个文档
          </span>
        </div>
        <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground shrink-0 cursor-pointer">
          <span className={cn(agentMode && 'text-primary font-bold')}>Agent 模式</span>
          <Switch.Root
            checked={agentMode}
            onCheckedChange={setAgentMode}
            className={cn(
              'relative h-5 w-9 rounded-full transition-colors',
              agentMode ? 'bg-primary' : 'bg-muted',
            )}
          >
            <Switch.Thumb className="block h-4 w-4 rounded-full bg-white shadow transition-transform translate-x-0.5 data-[state=checked]:translate-x-[1.125rem]" />
          </Switch.Root>
        </label>
      </div>

      {/* Agent 模式提示条 */}
      {agentMode && (
        <div className="flex items-center gap-1.5 bg-primary/5 px-4 py-1.5 text-[11px] text-primary">
          <Sparkles className="h-3 w-3" />
          Agent 模式：AI 将自主检索多个知识库，更智能但响应较慢
        </div>
      )}

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <p className="text-sm font-bold text-muted-foreground">向知识库提问</p>
            <p className="max-w-xs text-xs text-muted-foreground/70">
              输入问题，AI 将基于 {workspace.name} {agentMode ? '及关联知识库' : ''}的内容为你解答
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
                <span className="text-xs text-muted-foreground">
                  {agentMode ? 'Agent 正在检索知识库…' : '正在查询知识库…'}
                </span>
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

/** Q&A 消息气泡，区分 user/assistant，assistant 消息支持 Markdown 渲染、来源引用和 Agent 轨迹展开 */
function QaMessageBubble({ message }: { message: QaMessage & { agentTaskId?: number; agentMode?: boolean } }) {
  const isUser = message.role === 'user'
  const [traceExpanded, setTraceExpanded] = useState(false)

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
        {/* 来源引用卡片（简单模式） */}
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
        {/* Agent 执行轨迹（Agent 模式）：可展开查看 Agent C 的思考过程和工具调用 */}
        {!isUser && message.agentTaskId && (
          <div className="border-l-2 border-primary/30 pl-3">
            <button
              type="button"
              onClick={() => setTraceExpanded(!traceExpanded)}
              className="flex items-center gap-1 text-[11px] font-bold text-primary"
            >
              {traceExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              查看 Agent 思考过程
            </button>
            {traceExpanded && (
              <div className="mt-2">
                <AgentTraceLoader agentTaskId={message.agentTaskId} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
