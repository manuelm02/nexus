import { Link } from 'react-router-dom'
import { Settings } from 'lucide-react'

// ProviderEmptyState 在结果面板语境内解释"为什么没结果"，不再像全局告警条。
export function ProviderEmptyState() {
  return (
    <div className="nexus-surface flex flex-col gap-3 p-5">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-primary"><Settings className="h-5 w-5" /></div>
      <div>
        <h3 className="text-lg font-extrabold text-foreground">还没有可用翻译模型</h3>
        <p className="mt-2 text-sm leading-7 text-muted-foreground">Translate 需要先在 Settings 中配置可用的 LLM provider。配置完成后，这里会直接显示译文、解释、关键词和备选表达。</p>
      </div>
      <Link to="/settings" className="nexus-button-primary inline-flex w-full items-center justify-center px-4 py-2 text-sm sm:w-auto">前往 Settings</Link>
    </div>
  )
}
