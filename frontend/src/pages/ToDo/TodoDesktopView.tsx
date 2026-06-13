import { cn } from '../../lib/utils'
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

const METRIC_CARD_STYLES: Record<HeaderMetric['tone'], string> = {
  primary: 'border-[hsl(var(--primary)/0.25)] bg-[hsl(var(--primary)/0.06)] text-primary',
  success: 'border-[hsl(var(--success)/0.22)] bg-[hsl(var(--success-soft))] text-[hsl(var(--success))]',
  danger: 'border-[hsl(var(--destructive)/0.22)] bg-[hsl(var(--destructive-soft))] text-destructive',
  warning: 'border-[hsl(var(--warning)/0.28)] bg-[hsl(var(--warning-soft))] text-[hsl(var(--warning))]',
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
  headerMetrics,
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
  return (
    <div className="nexus-page-enter mx-auto hidden max-w-[1180px] space-y-4 p-4 md:block lg:p-6">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground">Today execution</p>
          <h1 className="mt-1 text-[28px] font-black leading-tight">ToDo</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">看板、任务和历史。</p>
        </div>
        <div className="grid grid-cols-4 gap-2 justify-self-end">
          {headerMetrics.map((metric) => (
            <div
              key={metric.label}
              className={cn(
                'flex h-14 w-[68px] flex-col justify-center rounded-lg border bg-card px-3 shadow-[var(--shadow-xs)]',
                METRIC_CARD_STYLES[metric.tone],
              )}
            >
              <p className="text-lg font-black leading-none">{metric.value}</p>
              <p className="mt-1 truncate text-[10px] font-bold text-muted-foreground">{metric.label}</p>
            </div>
          ))}
        </div>
      </div>

      <QuickCreate pending={createPending} onCreate={onCreate} />
      {operationError && (
        <div className="rounded-xl border border-[hsl(var(--destructive)/0.24)] bg-[hsl(var(--destructive-soft))] px-4 py-3 text-sm font-semibold text-destructive">
          ToDo 操作失败，请确认后端服务和登录状态后再试。
        </div>
      )}

      <TodoTabs activeTab={activeTab} onTabChange={onTabChange} />

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

function TodoTabs({ activeTab, onTabChange }: { activeTab: TodoTab; onTabChange: (tab: TodoTab) => void }) {
  return (
    <div className="grid h-11 grid-cols-3 rounded-lg border bg-card p-1 shadow-[var(--shadow-xs)]">
      {([
        ['list', 'ToDo List'],
        ['tasks', '任务'],
        ['history', '历史'],
      ] as const).map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onTabChange(key)}
          className={cn(
            'h-full rounded-md text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            activeTab === key ? 'bg-primary text-primary-foreground' : 'text-accent-foreground hover:bg-accent',
          )}
        >
          {label}
        </button>
      ))}
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
