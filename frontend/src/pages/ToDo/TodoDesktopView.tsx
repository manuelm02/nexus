import { X } from 'lucide-react'
import type { Todo } from '../../types/domain.types'
import { cn } from '../../lib/utils'
import {
  ErrorRow,
  QuickCreate,
  ScheduleTodayPopover,
  StatusFilterSelect,
  TodoGroupLabel,
  TodoRow,
  TodoSection,
} from './todo.components'
import type { Priority, TodoStatus, TodoTab } from './todo.shared'

export type HeaderMetric = {
  label: string
  value: number
  tone: 'default' | 'danger'
}

export type TodoMainViewProps = {
  activeTab: TodoTab
  historyStatus: TodoStatus | ''
  today: string
  headerMetrics: readonly HeaderMetric[]
  operationError: boolean
  createPending: boolean
  schedulePending: boolean
  todayLoading: boolean
  todayError: boolean
  pendingLoading: boolean
  pendingError: boolean
  overdueLoading: boolean
  overdueError: boolean
  historyLoading: boolean
  historyError: boolean
  todayInProgress: Todo[]
  todayNotStarted: Todo[]
  pendingItems: Todo[]
  overdueItems: Todo[]
  historyItems: Todo[]
  poolOpen: boolean
  overdueOpen: boolean
  onCreate: (input: { title: string; priority: Priority; addToday: boolean; dueDate?: string }) => void
  onTabChange: (tab: TodoTab) => void
  onHistoryStatusChange: (status: TodoStatus | '') => void
  onPoolOpenChange: (open: boolean) => void
  onOverdueOpenChange: (open: boolean) => void
  onStatusStep: (item: Todo) => void
  onStatusChange: (item: Todo, status: TodoStatus) => void
  onScheduleToday: (item: Todo, dueDate: string) => void
  onOpenTodo: (item: Todo) => void
}

// TodoDesktopView 保留桌面端信息密度和 hover 交互，避免移动端重构影响 Web 端。
export function TodoDesktopView({
  activeTab,
  historyStatus,
  today,
  headerMetrics,
  operationError,
  createPending,
  schedulePending,
  todayLoading,
  todayError,
  pendingLoading,
  pendingError,
  overdueLoading,
  overdueError,
  historyLoading,
  historyError,
  todayInProgress,
  todayNotStarted,
  pendingItems,
  overdueItems,
  historyItems,
  poolOpen,
  overdueOpen,
  onCreate,
  onTabChange,
  onHistoryStatusChange,
  onPoolOpenChange,
  onOverdueOpenChange,
  onStatusStep,
  onStatusChange,
  onScheduleToday,
  onOpenTodo,
}: TodoMainViewProps) {
  return (
    <div className="nexus-page-enter mx-auto hidden max-w-[1180px] space-y-5 p-8 md:block">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.12em] text-muted-foreground">Today execution</p>
          <h1 className="mt-1 text-[44px] font-black leading-[1.03]">ToDo</h1>
          <p className="mt-2 text-[15px] font-medium leading-7 text-muted-foreground">今日执行、待分配、过期处理和历史恢复。</p>
        </div>
        <div className="grid grid-cols-3 gap-2 justify-self-end">
          {headerMetrics.map((metric) => (
            <div
              key={metric.label}
              className={cn(
                'min-w-16 rounded-xl border bg-card px-3 py-2 shadow-[var(--shadow-sm)]',
                metric.tone === 'danger' && 'border-[hsl(var(--destructive)/0.22)] bg-[hsl(var(--destructive-soft))]',
              )}
            >
              <p className={cn('text-lg font-black leading-none', metric.tone === 'danger' && 'text-destructive')}>{metric.value}</p>
              <p className={cn('mt-1 truncate text-[10px] font-bold text-muted-foreground', metric.tone === 'danger' && 'text-destructive/75')}>{metric.label}</p>
            </div>
          ))}
        </div>
      </div>

      <QuickCreate today={today} pending={createPending} onCreate={onCreate} />
      {operationError && (
        <div className="rounded-xl border border-[hsl(var(--destructive)/0.24)] bg-[hsl(var(--destructive-soft))] px-4 py-3 text-sm font-semibold text-destructive">
          ToDo 操作失败，请确认后端服务和登录状态后再试。
        </div>
      )}

      <TodoTabs activeTab={activeTab} onTabChange={onTabChange} />

      {activeTab === 'today' ? (
        <TodaySections
          today={today}
          schedulePending={schedulePending}
          todayLoading={todayLoading}
          todayError={todayError}
          pendingLoading={pendingLoading}
          pendingError={pendingError}
          overdueLoading={overdueLoading}
          overdueError={overdueError}
          todayInProgress={todayInProgress}
          todayNotStarted={todayNotStarted}
          pendingItems={pendingItems}
          overdueItems={overdueItems}
          poolOpen={poolOpen}
          overdueOpen={overdueOpen}
          onPoolOpenChange={onPoolOpenChange}
          onOverdueOpenChange={onOverdueOpenChange}
          onStatusStep={onStatusStep}
          onStatusChange={onStatusChange}
          onScheduleToday={onScheduleToday}
          onOpenTodo={onOpenTodo}
        />
      ) : (
        <HistorySection
          historyStatus={historyStatus}
          historyLoading={historyLoading}
          historyError={historyError}
          historyItems={historyItems}
          onHistoryStatusChange={onHistoryStatusChange}
          onStatusStep={onStatusStep}
          onOpenTodo={onOpenTodo}
        />
      )}
    </div>
  )
}

function TodoTabs({ activeTab, onTabChange }: { activeTab: TodoTab; onTabChange: (tab: TodoTab) => void }) {
  return (
    <div className="grid grid-cols-2 rounded-[0.9375rem] border bg-card p-1 shadow-[var(--shadow-xs)]">
      {([
        ['today', '今日'],
        ['history', '历史'],
      ] as const).map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onTabChange(key)}
          className={cn(
            'h-11 rounded-[0.6875rem] text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            activeTab === key ? 'bg-primary text-primary-foreground' : 'text-accent-foreground hover:bg-accent',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function TodaySections({
  today,
  schedulePending,
  todayLoading,
  todayError,
  pendingLoading,
  pendingError,
  overdueLoading,
  overdueError,
  todayInProgress,
  todayNotStarted,
  pendingItems,
  overdueItems,
  poolOpen,
  overdueOpen,
  onPoolOpenChange,
  onOverdueOpenChange,
  onStatusStep,
  onStatusChange,
  onScheduleToday,
  onOpenTodo,
}: Pick<TodoMainViewProps,
  'today' | 'schedulePending' | 'todayLoading' | 'todayError' | 'pendingLoading' | 'pendingError' |
  'overdueLoading' | 'overdueError' | 'todayInProgress' | 'todayNotStarted' | 'pendingItems' |
  'overdueItems' | 'poolOpen' | 'overdueOpen' | 'onPoolOpenChange' | 'onOverdueOpenChange' |
  'onStatusStep' | 'onStatusChange' | 'onScheduleToday' | 'onOpenTodo'
>) {
  return (
    <div className="space-y-5">
      <TodoSection title="今日" loading={todayLoading} empty="今天还没有执行项">
        {todayError && <ErrorRow text="今日 ToDo 加载失败，请确认后端服务已启动。" />}
        {todayInProgress.length > 0 && <TodoGroupLabel label="进行中" />}
        {todayInProgress.map((item) => (
          <TodoRow key={item.id} item={item} onOpen={() => onOpenTodo(item)} onStatusStep={() => onStatusStep(item)} />
        ))}
        {todayNotStarted.length > 0 && <TodoGroupLabel label="未开始" />}
        {todayNotStarted.map((item) => (
          <TodoRow key={item.id} item={item} onOpen={() => onOpenTodo(item)} onStatusStep={() => onStatusStep(item)} />
        ))}
      </TodoSection>

      <TodoSection title="待分配" loading={pendingLoading} empty="没有待分配任务" collapsible open={poolOpen} onOpenChange={onPoolOpenChange}>
        {pendingError && <ErrorRow text="待分配 ToDo 加载失败，请确认后端服务已启动。" />}
        {pendingItems.map((item) => (
          <TodoRow
            key={item.id}
            item={item}
            onOpen={() => onOpenTodo(item)}
            onStatusStep={() => onStatusStep(item)}
            trailing={
              <div className="flex items-center gap-1.5">
                <ScheduleTodayPopover item={item} today={today} pending={schedulePending} onConfirm={(dueDate) => onScheduleToday(item, dueDate)} />
                <button
                  type="button"
                  onClick={() => onStatusChange(item, 'cancelled')}
                  className="nexus-button-utility h-9 shrink-0 gap-1.5 px-2.5 text-xs text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">取消</span>
                </button>
              </div>
            }
          />
        ))}
      </TodoSection>

      <TodoSection title="已过期" loading={overdueLoading} empty="没有过期任务" collapsible open={overdueOpen} onOpenChange={onOverdueOpenChange}>
        {overdueError && <ErrorRow text="已过期 ToDo 加载失败，请确认后端服务已启动。" />}
        {overdueItems.map((item) => (
          <TodoRow key={item.id} item={item} onOpen={() => onOpenTodo(item)} onStatusStep={() => onStatusStep(item)} />
        ))}
      </TodoSection>
    </div>
  )
}

function HistorySection({
  historyStatus,
  historyLoading,
  historyError,
  historyItems,
  onHistoryStatusChange,
  onStatusStep,
  onOpenTodo,
}: Pick<TodoMainViewProps, 'historyStatus' | 'historyLoading' | 'historyError' | 'historyItems' | 'onHistoryStatusChange' | 'onStatusStep' | 'onOpenTodo'>) {
  return (
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
  )
}
