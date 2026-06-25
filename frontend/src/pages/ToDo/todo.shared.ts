import type { Todo } from '../../types/domain.types'

export type Priority = Todo['priority']
export type TodoStatus = Todo['status']
export type TodoTab = 'list' | 'tasks' | 'history'

export const PRIORITIES: Priority[] = ['low', 'medium', 'high']
export const TODO_STATUSES: TodoStatus[] = ['pending', 'cancelled', 'not_started', 'in_progress', 'done']

export const PRIORITY_STYLES: Record<Priority, string> = {
  low: 'border-muted-foreground/20 bg-muted/40 text-muted-foreground',
  medium: 'border-muted-foreground/30 bg-muted/50 text-foreground',
  high: 'border-primary/30 bg-primary/5 text-primary',
}

export const PRIORITY_ROW_STYLES: Record<Priority, string> = {
  low: 'border-l-muted-foreground/30',
  medium: 'border-l-muted-foreground/50',
  high: 'border-l-primary',
}

export const todayString = () => new Date().toISOString().slice(0, 10)

export const normalizePriority = (priority?: string): Priority => {
  if (priority === 'low' || priority === 'medium' || priority === 'high') return priority
  if (priority === 'urgent') return 'high'
  return 'medium'
}

export function getNextRowStatus(status: TodoStatus): TodoStatus {
  if (status === 'not_started') return 'in_progress'
  if (status === 'in_progress') return 'done'
  return status
}

/** 判断截止日期是否早于计划日期 */
export const isDueDateInvalid = (scheduledDate?: string, dueDate?: string) =>
  Boolean(scheduledDate && dueDate && dueDate < scheduledDate)
