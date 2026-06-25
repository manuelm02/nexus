import type { TranslationResult } from '../../types/domain.types'
import type { TranslateViewProps } from './translate.shared'
import { PageHeader, PageShell } from '@/components/shell'
import { TranslateComposer } from './components/TranslateComposer'
import { TranslateHistoryList } from './components/TranslateHistoryList'
import { TranslateResultPanel } from './components/TranslateResultPanel'

type HistorySectionProps = {
  history: TranslationResult[]
  historyLoading: boolean
  historyQuery: string
  historyPage: number
  historyPageSize: number
  historyTotal: number
  historyTotalPages: number
  onHistoryQueryChange: (value: string) => void
  onHistoryPageChange: (page: number) => void
  onHistoryPageSizeChange: (size: number) => void
  onReuse: (item: TranslationResult) => void
  onDelete: (id: string) => void
}

// TranslateDesktopView 改为单列堆叠工作台，让输入后视线自然向下进入结果区，而不是横向切换阅读焦点。
export function TranslateDesktopView(props: TranslateViewProps & HistorySectionProps) {
  return (
    <div className="hidden md:block">
      <PageShell variant="full" header={<PageHeader eyebrow="TRANSLATE" title="Translate" subtitle="同一个意思，换一种语言。" />}>
        <TranslateComposer
          sourceText={props.sourceText}
          targetLang={props.targetLang}
          style={props.style}
          pending={props.pending}
          providerMissing={props.providerMissing}
          providerChecking={props.providerChecking}
          onSourceTextChange={props.onSourceTextChange}
          onTargetLangChange={props.onTargetLangChange}
          onStyleChange={props.onStyleChange}
          onTranslate={props.onTranslate}
          mode="desktop"
        />
        <TranslateResultPanel
          result={props.result}
          resultStage={props.resultStage}
          copied={props.copied}
          pending={props.pending}
          providerMissing={props.providerMissing}
          providerChecking={props.providerChecking}
          errorMessage={props.errorMessage}
          onCopy={props.onCopy}
          mode="desktop"
        />
        <TranslateHistoryList
          history={props.history}
          historyLoading={props.historyLoading}
          historyQuery={props.historyQuery}
          historyPage={props.historyPage}
          historyPageSize={props.historyPageSize}
          historyTotal={props.historyTotal}
          historyTotalPages={props.historyTotalPages}
          onHistoryQueryChange={props.onHistoryQueryChange}
          onHistoryPageChange={props.onHistoryPageChange}
          onHistoryPageSizeChange={props.onHistoryPageSizeChange}
          onReuse={props.onReuse}
          onDelete={props.onDelete}
          mode="desktop"
        />
      </PageShell>
    </div>
  )
}
