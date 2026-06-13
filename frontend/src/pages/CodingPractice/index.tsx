// CodingPracticePage 是算法刷题对话框能力的入口页面。
export default function CodingPracticePage() {
  return (
    <div className="nexus-page-enter mx-auto max-w-3xl space-y-4 p-4 pt-5 md:p-6">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground">Practice lab</p>
        <h1 className="mt-1 text-2xl font-black md:text-[28px]">Coding Practice</h1>
        <p className="mt-2 text-sm font-medium text-muted-foreground">算法刷题与对话练习入口。</p>
      </div>
      <section className="nexus-surface p-4">
        <p className="text-sm font-semibold text-foreground">阶段2实现中…</p>
        <p className="mt-1 text-xs leading-6 text-muted-foreground">后续这里会承接题目上下文、提示和练习记录。</p>
      </section>
    </div>
  )
}
