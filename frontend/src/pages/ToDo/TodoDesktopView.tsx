import { Tabs } from '../../components/shell'
import type { Todo } from '../../types/domain.types'
import {
  ErrorRow,
  QuickCreate,
  StatusFilterSelect,
  TodoRow,
  TodoSection,
  TaskCard,
} from './todo.components'
import type { Priority, TodoStatus, TodoTab } from './todo.shared'

export type HeaderMetric = {
  label: string
  value: number
  tone: 'primary' | 'success' | 'danger' | 'warning'
}

export type TodoMainViewProps = {
  activeTab: TodoTab
  historyStatus: TodoStatus | ''
  headerMetrics: readonly HeaderMetric[]
  operationError: boolean
  createPending: boolean
  boardLoading: boolean
  boardError: boolean
  historyLoading: boolean
  historyError: boolean
  todayItems: Todo[]
  futureItems: Todo[]
  overdueItems: Todo[]
  taskItems: Todo[]
  historyItems: Todo[]
  overdueOpen: boolean
  onCreate: (input: { title: string; priority: Priority; scheduledDate?: string; dueDate?: string }) => void
  onTabChange: (tab: TodoTab) => void
  onHistoryStatusChange: (status: TodoStatus | '') => void
  onOverdueOpenChange: (open: boolean) => void
  onStatusStep: (item: Todo) => void
  onStatusChange: (item: Todo, status: TodoStatus) => void
  onScheduleTask: (id: string, scheduledDate: string) => void
  onOpenTodo: (item: Todo) => void
}

// TodoDesktopView 保留桌面端信息密度和 hover 交互，展示看板三栏 + 任务 + 历史。
export function TodoDesktopView({
  activeTab,
  historyStatus,
  operationError,
  createPending,
  boardLoading,
  boardError,
  historyLoading,
  historyError,
  todayItems,
  futureItems,
  overdueItems,
  taskItems,
  historyItems,
  overdueOpen,
  onCreate,
  onTabChange,
  onHistoryStatusChange,
  onOverdueOpenChange,
  onStatusStep,
  onStatusChange,
  onScheduleTask,
  onOpenTodo,
}: TodoMainViewProps) {
  // padding 由 PageShell 统一提供（TodoView 包裹），此处只保留区块间距
  return (
    <div className="hidden space-y-4 md:block">
      <QuickCreate pending={createPending} onCreate={onCreate} />
      {operationError && (
        <div className="rounded-xl border border-[hsl(var(--destructive)/0.24)] bg-[hsl(var(--destructive-soft))] px-4 py-3 text-sm font-semibold text-destructive">
          ToDo 操作失败，请确认后端服务和登录状态后再试。
        </div>
      )}

      <Tabs
        variant="segmented"
        value={activeTab}
        onChange={onTabChange}
        items={[
          { value: 'list', label: 'ToDo List' },
          { value: 'tasks', label: '任务' },
          { value: 'history', label: '历史' },
        ]}
      />

      {activeTab === 'list' ? (
        <BoardSections
          boardLoading={boardLoading}
          boardError={boardError}
          todayItems={todayItems}
          futureItems={futureItems}
          overdueItems={overdueItems}
          overdueOpen={overdueOpen}
          onOverdueOpenChange={onOverdueOpenChange}
          onStatusStep={onStatusStep}
          onOpenTodo={onOpenTodo}
        />
      ) : activeTab === 'tasks' ? (
        <TodoSection title="任务" loading={boardLoading} empty="没有任务">
          {boardError && <ErrorRow text="任务加载失败，请确认后端服务已启动。" />}
          {taskItems.map((item) => (
            <TaskCard
              key={item.id}
              item={item}
              onOpen={() => onOpenTodo(item)}
              onSchedule={(date) => onScheduleTask(item.id, date)}
              onCancel={() => onStatusChange(item, 'cancelled')}
            />
          ))}
        </TodoSection>
      ) : (
        <TodoSection
          title="历史 ToDo"
          loading={historyLoading}
          empty="没有匹配的历史任务"
          toolbar={<StatusFilterSelect value={historyStatus} onChange={onHistoryStatusChange} />}
        >
          {historyError && <ErrorRow text="历史 ToDo 加载失败，请确认后端服务已启动。" />}
          {historyItems.map((item) => (
            <TodoRow key={item.id} item={item} onOpen={() => onOpenTodo(item)} onStatusStep={() => onStatusStep(item)} />
          ))}
        </TodoSection>
      )}
    </div>
  )
}

function BoardSections({
  boardLoading,
  boardError,
  todayItems,
  futureItems,
  overdueItems,
  overdueOpen,
  onOverdueOpenChange,
  onStatusStep,
  onOpenTodo,
}: Pick<TodoMainViewProps, 'boardLoading' | 'boardError' | 'todayItems' | 'futureItems' | 'overdueItems' | 'overdueOpen' | 'onOverdueOpenChange' | 'onStatusStep' | 'onOpenTodo'>) {
  return (
    <div className="space-y-4">
      <TodoSection title="今日" loading={boardLoading} empty="今天还没有执行项">
        {boardError && <ErrorRow text="看板加载失败，请确认后端服务已启动。" />}
        {todayItems.map((item) => (
          <TodoRow key={item.id} item={item} onOpen={() => onOpenTodo(item)} onStatusStep={() => onStatusStep(item)} />
        ))}
      </TodoSection>

      <TodoSection title="未来" loading={boardLoading} empty="没有未来计划">
        {futureItems.map((item) => (
          <TodoRow key={item.id} item={item} onOpen={() => onOpenTodo(item)} onStatusStep={() => onStatusStep(item)} />
        ))}
      </TodoSection>

      <TodoSection title="已过期" loading={boardLoading} empty="没有过期任务" collapsible open={overdueOpen} onOpenChange={onOverdueOpenChange}>
        {overdueItems.map((item) => (
          <TodoRow key={item.id} item={item} onOpen={() => onOpenTodo(item)} onStatusStep={() => onStatusStep(item)} />
        ))}
      </TodoSection>
    </div>
  )
}
