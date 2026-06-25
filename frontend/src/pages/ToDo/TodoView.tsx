import type { Todo } from '../../types/domain.types'
import { TodoDetailDialog } from './todo.components'
import { TodoDesktopView, type HeaderMetric, type TodoMainViewProps } from './TodoDesktopView'
import { TodoMobileView } from './TodoMobileView'
import { PageHeader, PageShell } from '../../components/shell'
import type { TodoStatus, TodoTab } from './todo.shared'

export type TodoViewProps = TodoMainViewProps & {
  detailTarget: Todo | null
  dateValidation: string | null
  saving: boolean
  deleting: boolean
  onCloseDetail: () => void
  onSave: (id: string, data: Partial<Todo> & { clearScheduledDate?: boolean; clearDueDate?: boolean }) => void
  onDelete: (id: string) => void
}

export type { HeaderMetric }

// TodoView 作为响应式组合层：业务 props 共享，桌面和移动端视图彻底隔离。
export function TodoView({
  detailTarget,
  dateValidation,
  saving,
  deleting,
  onCloseDetail,
  onSave,
  onDelete,
  ...mainViewProps
}: TodoViewProps) {
  return (
    <>
    <PageShell
      variant="full"
      header={
        <PageHeader
          eyebrow="EXECUTION"
          title="ToDo"
          subtitle="看板、任务和历史。"
          actions={
            <div className="grid grid-cols-4 gap-2">
              {mainViewProps.headerMetrics.map((metric) => (
                <div
                  key={metric.label}
                  className="flex h-14 w-[68px] flex-col justify-center rounded-lg border bg-card px-3 shadow-[var(--shadow-xs)]"
                >
                  <p className="text-lg font-black leading-none text-foreground">{metric.value}</p>
                  <p className="mt-1 truncate text-[10px] font-bold text-muted-foreground">{metric.label}</p>
                </div>
              ))}
            </div>
          }
        />
      }
    >
      <TodoDesktopView {...mainViewProps} />
      <TodoMobileView {...mainViewProps} />
    </PageShell>
    <TodoDetailDialog
      item={detailTarget}
      dateValidation={dateValidation}
      saving={saving}
      deleting={deleting}
      onOpenChange={(open) => !open && onCloseDetail()}
      onSave={onSave}
      onDelete={onDelete}
    />
    </>
  )
}

export type TodoViewTab = TodoTab
export type TodoViewStatus = TodoStatus
