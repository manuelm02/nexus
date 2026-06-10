// ChatPage 是日常问答对话窗口的入口页面。
export default function ChatPage() {
  return (
    <div className="nexus-page-enter mx-auto max-w-3xl space-y-4 p-4 pt-5 md:p-8">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground">Daily assistant</p>
        <h1 className="mt-1 text-3xl font-black md:text-4xl">Chat</h1>
        <p className="mt-2 text-sm font-medium text-muted-foreground">轻量日常问答窗口。</p>
      </div>
      <section className="nexus-surface p-4">
        <p className="text-sm font-semibold text-foreground">阶段2实现中…</p>
        <p className="mt-1 text-xs leading-6 text-muted-foreground">后续这里会承接日常问答、上下文输入和结果输出。</p>
      </section>
    </div>
  )
}
