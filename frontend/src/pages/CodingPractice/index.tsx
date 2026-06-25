import { PageHeader, PageShell } from '@/components/shell'

// CodingPracticePage 是算法刷题对话框能力的入口页面。
export default function CodingPracticePage() {
  return (
    <PageShell variant="full" header={
      <PageHeader eyebrow="PRACTICE" title="Coding Practice" subtitle="算法练习与解题记录" />
    }>
      <section className="nexus-surface p-4">
        <p className="text-sm font-semibold text-foreground">阶段2实现中…</p>
        <p className="mt-1 text-xs leading-6 text-muted-foreground">后续这里会承接题目上下文、提示和练习记录。</p>
      </section>
    </PageShell>
  )
}
