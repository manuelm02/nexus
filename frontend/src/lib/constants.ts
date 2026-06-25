export const NAV_ITEMS = [
  { path: '/chat',            label: 'Chat',            icon: 'Sparkles',  group: 'space'   },
  { path: '/todo',            label: 'ToDo',            icon: 'Target',    group: 'tools'   },
  { path: '/inbox',           label: 'Inbox',           icon: 'Feather',   group: 'capture' },
  { path: '/notes',           label: 'Notes',           icon: 'FileText',  group: 'space'   },
  { path: '/crawl',           label: 'Crawl',           icon: 'Radio',     group: 'capture' },
  { path: '/mindbank',        label: 'Mindbank',        icon: 'Brain',     group: 'space'   },
  { path: '/coding-practice', label: 'Coding Practice', icon: 'Hammer',    group: 'tools'   },
  { path: '/translate',       label: 'Translate',       icon: 'Languages', group: 'tools'   },
  { path: '/panel-hub',      label: 'Panel Hub',        icon: 'LayoutDashboard', group: 'manage'},
] as const

// NAV_GROUPS 定义侧栏分组顺序与中文标签，保持与 NAV_ITEMS.group 单一数据源
export const NAV_GROUPS = [
  { key: 'space',   label: '空间' },
  { key: 'capture', label: '收集' },
  { key: 'tools',   label: '工具' },
  { key: 'manage',  label: '管理' },
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
  lifetime: '买断',
  one_time: '一次性',
}
