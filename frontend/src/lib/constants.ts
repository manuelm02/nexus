export const NAV_ITEMS = [
  { path: '/chat',            label: 'Chat',            icon: 'Sparkles'  },
  { path: '/todo',            label: 'ToDo',            icon: 'Target'    },
  { path: '/inbox',           label: 'Inbox',           icon: 'Feather'   },
  { path: '/notes',           label: 'Notes',           icon: 'FileText'  },
  { path: '/crawl',           label: 'Crawl',           icon: 'Radio'     },
  { path: '/mindbank',        label: 'Mindbank',        icon: 'Brain'     },
  { path: '/coding-practice', label: 'Coding Practice', icon: 'Hammer'    },
  { path: '/translate',       label: 'Translate',       icon: 'Languages' },
  { path: '/subscriptions',   label: 'Subscriptions',   icon: 'CreditCard'},
] as const

export const PRIORITY_LABELS: Record<string, string> = {
  low:    '低',
  medium: '中',
  high:   '高',
}

export const STATUS_LABELS: Record<string, string> = {
  pending:     '待分配',
  cancelled:   '已取消',
  not_started: '未开始',
  in_progress: '进行中',
  done:        '已完成',
}

export const BILLING_TYPE_LABELS: Record<string, string> = {
  monthly:  '按月',
  yearly:   '按年',
  per_token:'按量',
  lifetime: '买断',
  one_time: '一次性',
}
