import { Sparkles } from 'lucide-react'
import { SuggestionChips } from './components/SuggestionChips'
import { ChatInputBar } from './components/ChatInputBar'
import { EmptyState } from '@/components/shell'
import type { ChatSuggestion } from '../../types/domain.types'

type WelcomeViewProps = {
  suggestions: ChatSuggestion[]
  isStreaming: boolean
  onSend: (message: string) => void
}

// WelcomeView Chat 空状态首页：EmptyState + 推荐词条 + 底部输入栏
export function WelcomeView({ suggestions, isStreaming, onSend }: WelcomeViewProps) {
  return (
    <div className="flex h-full flex-col">
      {/* 居中空状态 + 推荐词条 */}
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-12">
        <EmptyState
          icon={Sparkles}
          title="开始新对话"
          hint="选择左侧会话或输入问题开始。"
          action={
            <SuggestionChips suggestions={suggestions} onSelect={onSend} />
          }
        />
      </div>

      {/* 底部输入栏：全宽不再受 max-w-lg 约束，跟随父面板宽度 */}
      <div className="border-t border-border p-4">
        <ChatInputBar placeholder="输入任何问题…" isStreaming={isStreaming} onSend={onSend} />
      </div>
    </div>
  )
}