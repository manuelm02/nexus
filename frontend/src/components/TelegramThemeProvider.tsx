import { useEffect, type ReactNode } from 'react'

declare global {
  interface Window {
    Telegram?: { WebApp?: { colorScheme?: string; ready?: () => void } }
  }
}

// TelegramThemeProvider 适配 Telegram Mini App 环境，检测 colorScheme 并自动切换 dark mode。
export function TelegramThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const tg = window.Telegram?.WebApp
    if (!tg) return
    tg.ready?.()
    if (tg.colorScheme === 'dark') {
      document.documentElement.classList.add('dark')
    }
  }, [])

  return <>{children}</>
}
