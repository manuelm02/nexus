import { useState, useRef, useEffect } from 'react'
import { Send, Loader2 } from 'lucide-react'
import { cn } from '../../../lib/utils'

type ChatInputBarProps = {
  placeholder?: string
  disabled?: boolean
  isStreaming?: boolean
  onSend: (message: string) => void
}

// ChatInputBar 提供多行输入框、发送按钮和 Enter/Shift+Enter 快捷键
export function ChatInputBar({ placeholder = '输入消息…', disabled, isStreaming, onSend }: ChatInputBarProps) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }, [value])

  const handleSubmit = () => {
    const trimmed = value.trim()
    if (!trimmed || disabled || isStreaming) return
    onSend(trimmed)
    setValue('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="relative rounded-xl border bg-card shadow-[var(--shadow-sm)]">
      <textarea
        ref={textareaRef}
        rows={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled || isStreaming}
        placeholder={placeholder}
        className="max-h-40 min-h-[72px] w-full resize-none bg-transparent px-4 pb-10 pt-3 text-sm font-medium outline-none placeholder:text-muted-foreground disabled:opacity-60"
      />
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!value.trim() || disabled || isStreaming}
        className={cn(
          'nexus-button-primary absolute bottom-2 right-2 h-8 w-8 shrink-0 p-0',
          (!value.trim() || disabled || isStreaming) && 'opacity-50',
        )}
        aria-label="发送"
      >
        {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
      </button>
    </div>
  )
}
