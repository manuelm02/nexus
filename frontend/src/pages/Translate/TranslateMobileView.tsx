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

// TranslateMobileView 改为手机优先的工作流：轻 header、紧凑输入卡、移动控制条、结果卡、搜索后的历史列表。
export function TranslateMobileView(props: TranslateViewProps & HistorySectionProps) {
  return (
    <div className="md:hidden">
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
          mode="mobile"
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
          mode="mobile"
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
          mode="mobile"
        />
      </PageShell>
    </div>
  )
}
