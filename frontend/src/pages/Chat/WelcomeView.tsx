import { SuggestionChips } from './components/SuggestionChips'
import { ChatInputBar } from './components/ChatInputBar'
import type { ChatSuggestion } from '../../types/domain.types'

type WelcomeViewProps = {
  suggestions: ChatSuggestion[]
  isStreaming: boolean
  onSend: (message: string) => void
}

// WelcomeView Chat 空状态首页：标题、推荐词条与输入栏
export function WelcomeView({ suggestions, isStreaming, onSend }: WelcomeViewProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-4 py-8">
      <div className="text-center">
        <h2 className="text-2xl font-black text-foreground">今天想聊点什么？</h2>
        <p className="mt-1 text-xs text-muted-foreground">日常问答、代码解释、知识梳理，都可以问我。</p>
      </div>
      <div className="w-full max-w-xl">
        <SuggestionChips suggestions={suggestions} onSelect={onSend} />
      </div>
      <div className="w-full max-w-xl">
        <ChatInputBar placeholder="输入任何问题…" isStreaming={isStreaming} onSend={onSend} />
      </div>
    </div>
  )
}
