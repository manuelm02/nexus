import { useState } from 'react'
import { Menu } from 'lucide-react'
import { useConversations } from './hooks/useConversations'
import { useMessages } from './hooks/useMessages'
import { useStreamingMessage } from './hooks/useStreamingMessage'
import { useSuggestions } from './hooks/useSuggestions'
import { ChatSidebar } from './ChatSidebar'
import { WelcomeView } from './WelcomeView'
import { ChatView } from './ChatView'
import { ConversationRenameDialog } from './components/ConversationRenameDialog'
import type { ChatConversation } from '../../types/domain.types'

// ChatPage 编排日常问答会话：侧边栏、空状态、对话视图、重命名弹窗与 SSE 流式发送
export default function ChatPage() {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [renameTarget, setRenameTarget] = useState<ChatConversation | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const {
    conversations,
    filteredConversations,
    isLoading,
    search,
    setSearch,
    createConversation,
    deleteConversation,
    renameConversation,
    generateTitle,
    isGeneratingTitle,
  } = useConversations()

  const { suggestions } = useSuggestions()
  const { messages, isLoading: messagesLoading } = useMessages(activeId)

  const { streamingContent, isStreaming, streamingError, send } = useStreamingMessage(activeId)

  const activeConversation = conversations.find((c) => c.id === activeId)

  // 新建时回到首页（WelcomeView），对话在发送第一条消息时才持久化
  const handleCreate = () => {
    setActiveId(null)
    setSidebarOpen(false)
  }

  const handleSelect = (conversation: ChatConversation) => {
    setActiveId(conversation.id)
    setSidebarOpen(false)
  }

  // 删除时若删除的是当前对话，立即清空 activeId，避免后续请求打到已删除的 ID
  const handleDelete = (id: string) => {
    if (activeId === id) setActiveId(null)
    deleteConversation(id)
  }

  const handleSend = async (message: string) => {
    if (!activeId) {
      const res = await createConversation()
      const conversation = res.data?.data
      if (!conversation) return
      setActiveId(conversation.id)
      send(message, conversation.id)
      return
    }
    send(message)
  }

  const handleRenameSave = (id: string, title: string) => {
    renameConversation({ id, title, titleAi: false })
    setRenameTarget(null)
  }

  const handleAiGenerate = async (id: string) => {
    const res = await generateTitle(id)
    const newTitle = res.data?.data
    if (newTitle && renameTarget) {
      setRenameTarget({ ...renameTarget, title: newTitle })
    }
  }

  return (
    <div className="nexus-page-enter flex h-dvh flex-col">
      {/* 移动端顶部栏：有活跃对话时显示对话标题 */}
      <div className="flex items-center justify-between border-b bg-card p-3 md:hidden">
        <h1 className="truncate text-base font-black">
          {activeConversation ? activeConversation.title : 'Chat'}
        </h1>
        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="nexus-button-utility ml-2 h-9 w-9 shrink-0 p-0"
          aria-label="打开对话列表"
        >
          <Menu className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* 桌面端侧边栏 */}
        <ChatSidebar
          conversations={filteredConversations}
          activeId={activeId}
          search={search}
          isLoading={isLoading}
          onSearchChange={setSearch}
          onCreate={handleCreate}
          onSelect={handleSelect}
          onDelete={handleDelete}
          onRename={setRenameTarget}
        />

        {/* 移动端侧边栏 */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 flex md:hidden">
            <div className="w-64 bg-card shadow-xl">
              <ChatSidebar
                conversations={filteredConversations}
                activeId={activeId}
                search={search}
                isLoading={isLoading}
                onSearchChange={setSearch}
                onCreate={handleCreate}
                onSelect={handleSelect}
                onDelete={handleDelete}
                onRename={setRenameTarget}
              />
            </div>
            <div className="flex-1 bg-black/50" onClick={() => setSidebarOpen(false)} />
          </div>
        )}

        <main className="flex-1 overflow-hidden bg-background">
          {activeId && activeConversation ? (
            <ChatView
              conversation={activeConversation}
              messages={messages}
              isLoading={messagesLoading}
              isStreaming={isStreaming}
              streamingContent={streamingContent}
              onSend={handleSend}
              onRename={() => setRenameTarget(activeConversation)}
            />
          ) : (
            <WelcomeView suggestions={suggestions} isStreaming={isStreaming} onSend={handleSend} />
          )}
        </main>
      </div>

      {streamingError && (
        <div className="border-t bg-destructive-soft px-4 py-2 text-xs text-destructive">
          {streamingError}
        </div>
      )}

      <ConversationRenameDialog
        conversation={renameTarget}
        isGenerating={isGeneratingTitle}
        onClose={() => setRenameTarget(null)}
        onSave={handleRenameSave}
        onAiGenerate={handleAiGenerate}
      />
    </div>
  )
}
