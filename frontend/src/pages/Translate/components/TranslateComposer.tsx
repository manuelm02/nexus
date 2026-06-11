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

// TranslateComposer 承载原文输入、语言选择、风格和提交动作，桌面端工具栏横向，移动端独立分行。
export function TranslateComposer({ sourceText, targetLang, style, pending, providerMissing, providerChecking, mode, onSourceTextChange, onTargetLangChange, onStyleChange, onTranslate }: TranslateComposerProps) {
  const disabled = !sourceText.trim() || pending || providerMissing || providerChecking
  const buttonText = providerChecking ? '检查 Provider...' : providerMissing ? '先配置 Provider' : pending ? '正在生成...' : '翻译'

  const languageSelect = (
    <Select.Root value={targetLang} onValueChange={onTargetLangChange}>
      <Select.Trigger className="nexus-input inline-flex h-11 w-full items-center justify-between gap-2 px-3 text-sm font-semibold text-foreground shadow-sm hover:bg-accent/40 focus:outline-none focus:ring-2 focus:ring-ring">
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

  return (
    <section className="nexus-surface p-4 md:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-foreground">输入原文</h2>
          {mode === 'desktop' && <p className="text-xs leading-6 text-muted-foreground">保持上下文完整，译文会更稳定。</p>}
        </div>
        <span className="text-xs font-semibold text-muted-foreground">{sourceText.length} 字符</span>
      </div>
      <textarea
        value={sourceText}
        onChange={(event) => onSourceTextChange(event.target.value)}
        placeholder="输入要翻译的文本..."
        rows={mode === 'desktop' ? 6 : 5}
        className={cn('nexus-input w-full resize-none p-3 text-sm leading-7', mode === 'desktop' ? 'min-h-[156px]' : 'min-h-[120px]')}
      />

      {mode === 'desktop' ? (
        // 桌面端：语言、风格、按钮横向工具栏
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="w-[240px] shrink-0">{languageSelect}</div>
          <div className="flex min-w-0 flex-1 gap-1.5">
            {STYLES.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => onStyleChange(item.value)}
                className={cn(
                  'nexus-button-utility h-11 shrink-0 px-4 text-xs font-extrabold',
                  style === item.value && 'border-primary bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground'
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
            className="nexus-button-primary ml-auto inline-flex min-w-[132px] items-center justify-center gap-2 px-5 py-2 text-sm"
          >
            {pending || providerChecking || providerMissing ? buttonText : <>{buttonText} <ArrowRight className="h-4 w-4" /></>}
          </button>
        </div>
      ) : (
        // 移动端：语言一行、风格横滑 chips、按钮全宽
        <div className="mt-4 space-y-3">
          {languageSelect}
          <div className="-mx-1 overflow-x-auto px-1 pb-1">
            <div className="flex min-w-max gap-2">
              {STYLES.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => onStyleChange(item.value)}
                  className={cn(
                    'nexus-button-utility min-h-10 shrink-0 px-4 text-xs font-extrabold',
                    style === item.value && 'border-primary bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground'
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
            className="nexus-button-primary flex w-full items-center justify-center gap-2 px-5 py-2 text-sm"
          >
            {pending || providerChecking || providerMissing ? buttonText : <>{buttonText} <ArrowRight className="h-4 w-4" /></>}
          </button>
        </div>
      )}
    </section>
  )
}
