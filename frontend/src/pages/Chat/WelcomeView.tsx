import { MessageCircle } from 'lucide-react'
import { SuggestionChips } from './components/SuggestionChips'
import { ChatInputBar } from './components/ChatInputBar'
import type { ChatSuggestion } from '../../types/domain.types'

type WelcomeViewProps = {
  suggestions: ChatSuggestion[]
  isStreaming: boolean
  onSend: (message: string) => void
}

// WelcomeView Chat 空状态首页：主题图标、标题、推荐词条与输入栏
export function WelcomeView({ suggestions, isStreaming, onSend }: WelcomeViewProps) {
  return (
    <div className="flex h-full flex-col">
      {/* 居中内容区 */}
      <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 py-12">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/[0.06]">
          <MessageCircle className="h-7 w-7 text-primary/40" />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-black text-foreground">今天想聊点什么？</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            日常问答、代码解释、知识梳理，都可以问我。
          </p>
        </div>
        <div className="w-full max-w-lg">
          <SuggestionChips suggestions={suggestions} onSelect={onSend} />
        </div>
      </div>

      {/* 底部输入栏：全宽不再受 max-w-lg 约束，跟随父面板宽度 */}
      <div className="border-t border-border p-4">
        <ChatInputBar placeholder="输入任何问题…" isStreaming={isStreaming} onSend={onSend} />
      </div>
    </div>
  )
}