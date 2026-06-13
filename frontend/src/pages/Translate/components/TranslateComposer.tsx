import { useRef, useCallback } from 'react'
import * as Select from '@radix-ui/react-select'
import { ArrowRight, Check, ChevronDown } from 'lucide-react'
import { cn } from '../../../lib/utils'
import { LANGUAGES, STYLES } from '../translate.shared'

type TranslateComposerProps = {
  sourceText: string
  targetLang: string
  style: string
  pending: boolean
  providerMissing: boolean
  providerChecking: boolean
  mode: 'desktop' | 'mobile'
  onSourceTextChange: (value: string) => void
  onTargetLangChange: (value: string) => void
  onStyleChange: (value: string) => void
  onTranslate: () => void
}

// TranslateComposer 承载原文输入、语言选择、风格和提交动作。
// 输入框默认两行起步，通过 scrollHeight 自动增高，禁止手动 resize 避免布局抖动。
export function TranslateComposer({ sourceText, targetLang, style, pending, providerMissing, providerChecking, mode, onSourceTextChange, onTargetLangChange, onStyleChange, onTranslate }: TranslateComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const disabled = !sourceText.trim() || pending || providerMissing || providerChecking
  const buttonText = providerChecking ? '检查 Provider...' : providerMissing ? '先配置 Provider' : pending ? '正在生成...' : '翻译'

  // 文本变化时同步 textarea 高度：以 scrollHeight 自动增高，清空后回到最小高度。
  // 使用 scrollHeight 而非固定 rows 是为了兼容长文本一次性粘贴的场景，同时不引入外部库。
  const handleInput = useCallback((value: string) => {
    onSourceTextChange(value)
    // 在下一个事件循环中同步高度，确保 DOM 已更新
    requestAnimationFrame(() => {
      const el = textareaRef.current
      if (el) {
        el.style.height = 'auto'
        el.style.height = `${el.scrollHeight}px`
      }
    })
  }, [onSourceTextChange])

  const languageSelect = (
    <Select.Root value={targetLang} onValueChange={onTargetLangChange}>
      <Select.Trigger className="nexus-input inline-flex h-10 md:h-9 w-full items-center justify-between gap-2 px-3 text-sm font-semibold text-foreground shadow-none hover:bg-accent/40 focus:outline-none focus:ring-2 focus:ring-ring">
        <Select.Value />
        <Select.Icon>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content position="popper" sideOffset={6} className="z-[70] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg">
          <Select.Viewport>
            {LANGUAGES.map((language) => (
              <Select.Item key={language} value={language} className="relative flex h-10 cursor-default select-none items-center rounded-lg px-9 text-sm font-semibold outline-none transition-colors data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground">
                <Select.ItemIndicator className="absolute left-3 flex h-4 w-4 items-center justify-center text-primary">
                  <Check className="h-3.5 w-3.5" />
                </Select.ItemIndicator>
                <Select.ItemText>{language}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  )

  // 桌面端两行起点高度 ≈ 2 行 × line-height(1.7) × 15px + padding ≈ 80px
  const desktopMinH = 'min-h-[80px]'
  // 移动端两行起点高度稍低 ≈ 72px
  const mobileMinH = 'min-h-[72px]'

  return (
    <section className="nexus-surface p-4 md:p-5">
      {/* 标题行：标题 + 字符计数，视觉权重降低 */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold text-foreground md:text-lg">输入原文</h2>
        </div>
        <span className="text-[11px] font-semibold text-muted-foreground/60">{sourceText.length}</span>
      </div>

      {/* 原文输入区：默认两行，自动增高，禁止手动 resize */}
      <textarea
        ref={textareaRef}
        value={sourceText}
        onChange={(event) => handleInput(event.target.value)}
        placeholder="输入要翻译的文本..."
        rows={2}
        className={cn(
          'nexus-input w-full resize-none p-3 text-sm leading-7',
          mode === 'desktop' ? desktopMinH : mobileMinH,
        )}
      />

      {mode === 'desktop' ? (
        // 桌面端：语言、风格、按钮紧凑横向工具栏
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="w-[180px] shrink-0">{languageSelect}</div>
          <div className="flex min-w-0 flex-1 gap-1">
            {STYLES.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => onStyleChange(item.value)}
                className={cn(
                  'nexus-button-utility h-9 shrink-0 px-3 text-[11px] font-extrabold',
                  style === item.value && 'border-primary bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onTranslate}
            disabled={disabled}
            className="nexus-button-primary ml-auto inline-flex min-w-[100px] items-center justify-center gap-1.5 px-4 py-2 text-xs"
          >
            {pending || providerChecking || providerMissing ? buttonText : <>{buttonText} <ArrowRight className="h-3.5 w-3.5" /></>}
          </button>
        </div>
      ) : (
        // 移动端：语言一行、风格横滑 chips、按钮全宽
        <div className="mt-3 space-y-2.5">
          {languageSelect}
          <div className="-mx-1 overflow-x-auto px-1 pb-1">
            <div className="flex min-w-max gap-1.5">
              {STYLES.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => onStyleChange(item.value)}
                  className={cn(
                    'nexus-button-utility h-10 shrink-0 px-3 text-[11px] font-extrabold',
                    style === item.value && 'border-primary bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={onTranslate}
            disabled={disabled}
            className="nexus-button-primary flex w-full items-center justify-center gap-2 px-5 py-2.5 text-sm"
          >
            {pending || providerChecking || providerMissing ? buttonText : <>{buttonText} <ArrowRight className="h-4 w-4" /></>}
          </button>
        </div>
      )}
    </section>
  )
}
