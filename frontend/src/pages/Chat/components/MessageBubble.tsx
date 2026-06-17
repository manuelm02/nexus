import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ChatMessage } from '../../../types/domain.types'
import { CodeBlock } from './CodeBlock'
import { cn } from '../../../lib/utils'

type MessageBubbleProps = {
  message: ChatMessage
}

// MessageBubble 区分 user / assistant 消息气泡，assistant 消息使用 Markdown 渲染
export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'border bg-card text-foreground',
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '')
                  const value = String(children).replace(/\n$/, '')
                  if (match) {
                    return <CodeBlock language={match[1]} value={value} />
                  }
                  return (
                    <code className="rounded bg-muted px-1 py-0.5 text-xs font-semibold" {...props}>
                      {children}
                    </code>
                  )
                },
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  )
}
