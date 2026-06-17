import { useEffect, useState } from 'react'
import { Sparkles, Loader2 } from 'lucide-react'
import type { ChatConversation } from '../../../types/domain.types'

type ConversationRenameDialogProps = {
  conversation: ChatConversation | null
  isGenerating: boolean
  onClose: () => void
  onSave: (id: string, title: string) => void
  onAiGenerate: (id: string) => void
}

// ConversationRenameDialog 提供手动重命名与 AI 提炼标题功能
export function ConversationRenameDialog({
  conversation,
  isGenerating,
  onClose,
  onSave,
  onAiGenerate,
}: ConversationRenameDialogProps) {
  const [title, setTitle] = useState('')
  // originalTitle 只在对话切换时更新，AI 提炼只改 title 不改 originalTitle，
  // 这样 AI 生成新标题后与原始标题不同，保存按钮才能正常启用。
  const [originalTitle, setOriginalTitle] = useState('')

  // 对话切换时重置两个状态
  useEffect(() => {
    if (conversation) {
      setTitle(conversation.title)
      setOriginalTitle(conversation.title)
    }
  }, [conversation?.id])

  // AI 提炼返回后同步输入框（conversation.title 变化），但不更新 originalTitle
  useEffect(() => {
    if (conversation) {
      setTitle(conversation.title)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation?.title])

  if (!conversation) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    onSave(conversation.id, trimmed)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-5 shadow-lg">
        <h3 className="text-base font-black">重命名对话</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {conversation.titleAi ? 'AI 已根据内容自动命名，可直接修改或让 AI 重新提炼。' : '手动命名后 AI 将不再覆盖。'}
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div className="relative">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="输入对话标题"
              className="nexus-input h-10 w-full pr-20 text-sm"
              maxLength={30}
            />
            <button
              type="button"
              onClick={() => onAiGenerate(conversation.id)}
              disabled={isGenerating}
              className="absolute right-1 top-1 inline-flex h-8 items-center gap-1 rounded-md border border-border bg-muted px-2 text-[11px] font-bold text-muted-foreground transition-colors hover:bg-accent disabled:opacity-50"
            >
              {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
              {isGenerating ? '生成中…' : 'AI 提炼'}
            </button>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="nexus-button-utility px-4 text-xs">
              取消
            </button>
            <button
              type="submit"
              disabled={!title.trim() || title.trim() === originalTitle}
              className="nexus-button-primary px-4 text-xs disabled:opacity-50"
            >
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
