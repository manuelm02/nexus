// MindbankPage 是知识沉淀流程的入口页面。
export default function MindbankPage() {
  return (
    <div className="nexus-page-enter mx-auto max-w-3xl space-y-4 p-4 pt-5 md:p-6">
      <div>
        <p className="text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground">Knowledge memory</p>
        <h1 className="mt-1 text-2xl font-black md:text-[28px]">Mindbank</h1>
        <p className="mt-2 text-sm font-medium text-muted-foreground">知识沉淀、审核和检索工作区。</p>
      </div>
      <section className="nexus-surface p-4">
        <p className="text-sm font-semibold text-foreground">阶段2实现中…</p>
        <p className="mt-1 text-xs leading-6 text-muted-foreground">后续这里会承接文件收件箱、元数据审核和知识库问答。</p>
      </section>
    </div>
  )
}
