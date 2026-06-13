import type { Todo } from '../../types/domain.types'
import { TodoDetailDialog } from './todo.components'
import { TodoDesktopView, type HeaderMetric, type TodoMainViewProps } from './TodoDesktopView'
import { TodoMobileView } from './TodoMobileView'
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
      <TodoDesktopView {...mainViewProps} />
      <TodoMobileView {...mainViewProps} />
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
