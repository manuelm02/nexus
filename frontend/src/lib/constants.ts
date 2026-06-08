export const NAV_ITEMS = [
  { path: '/focus',    label: 'Focus',    icon: 'Target'    },
  { path: '/fleeting', label: 'Fleeting', icon: 'Feather'   },
  { path: '/prism',    label: 'Prism',    icon: 'Layers'    },
  { path: '/mindbank', label: 'Mindbank', icon: 'Brain'     },
  { path: '/radar',    label: 'Radar',    icon: 'Radio'     },
  { path: '/ledger',   label: 'Ledger',   icon: 'CreditCard'},
  { path: '/forge',    label: 'Forge',    icon: 'Hammer'    },
  { path: '/muse',     label: 'Muse',     icon: 'Sparkles'  },
] as const

export const PRIORITY_LABELS: Record<string, string> = {
  low:    '低',
  medium: '中',
  high:   '高',
  urgent: '紧急',
}

export const STATUS_LABELS: Record<string, string> = {
  not_started: '未开始',
  in_progress: '进行中',
  done:        '已完成',
  archived:    '已归档',
}

export const BILLING_TYPE_LABELS: Record<string, string> = {
  monthly:  '按月',
  yearly:   '按年',
  per_token:'按量',
  lifetime: '买断',
  one_time: '一次性',
}
