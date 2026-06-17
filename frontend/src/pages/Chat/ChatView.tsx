import { useEffect, useRef } from 'react'
import { Loader2, Pencil } from 'lucide-react'
import { MessageBubble } from './components/MessageBubble'
import { ChatInputBar } from './components/ChatInputBar'
import type { ChatConversation, ChatMessage } from '../../types/domain.types'

type ChatViewProps = {
  conversation: ChatConversation
  messages: ChatMessage[]
  isLoading: boolean
  isStreaming: boolean
  streamingContent: string
  onSend: (message: string) => void
  onRename: () => void
}

// ChatView 活跃对话视图：标题头部、消息列表（自动滚动到底部）+ 输入栏
export function ChatView({ conversation, messages, isLoading, isStreaming, streamingContent, onSend, onRename }: ChatViewProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  return (
    <div className="flex h-full flex-col">
      {/* 对话标题栏（桌面端，移动端已在顶部栏显示） */}
      <div className="hidden items-center gap-2 border-b bg-card/60 px-4 py-2.5 md:flex">
        <span className="flex-1 truncate text-sm font-bold text-foreground">{conversation.title}</span>
        <button
          type="button"
          onClick={onRename}
          className="nexus-button-utility h-7 w-7 shrink-0 p-0"
          aria-label="重命名对话"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {messages.filter(Boolean).map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {isStreaming && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl border bg-card px-4 py-2.5 text-sm text-foreground">
                  {streamingContent ? (
                    <p className="whitespace-pre-wrap leading-relaxed">{streamingContent}</p>
                  ) : (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
              </div>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t bg-card p-3 md:p-4">
        <ChatInputBar isStreaming={isStreaming} onSend={onSend} />
      </div>
    </div>
  )
}
