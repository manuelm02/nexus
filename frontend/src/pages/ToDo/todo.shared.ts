import type { Todo } from '../../types/domain.types'

export type Priority = Todo['priority']
export type TodoStatus = Todo['status']
export type TodoTab = 'list' | 'tasks' | 'history'

export const PRIORITIES: Priority[] = ['low', 'medium', 'high']
export const TODO_STATUSES: TodoStatus[] = ['pending', 'cancelled', 'not_started', 'in_progress', 'done']

export const PRIORITY_STYLES: Record<Priority, string> = {
  low: 'border-[hsl(var(--success)/0.25)] bg-[hsl(var(--success-soft))] text-[hsl(var(--success))]',
  medium: 'border-[hsl(var(--warning)/0.28)] bg-[hsl(var(--warning-soft))] text-[hsl(var(--warning))]',
  high: 'border-[hsl(var(--destructive)/0.24)] bg-[hsl(var(--destructive-soft))] text-[hsl(var(--destructive))]',
}

export const PRIORITY_ROW_STYLES: Record<Priority, string> = {
  low: 'border-l-[hsl(var(--success)/0.5)]',
  medium: 'border-l-[hsl(var(--warning)/0.5)]',
  high: 'border-l-[hsl(var(--destructive)/0.6)]',
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
