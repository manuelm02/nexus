# Translate Layout Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh the current Translate workbench so it feels denser and more tool-like, with stacked desktop layout, result-localized provider messaging, searchable paginated history, and a separately designed mobile experience.

**Architecture:** Keep the current Translate business flow, streaming events, result typing, and history rehydrate logic in `frontend/src/pages/Translate/index.tsx`. Refactor only the presentation layer and UI-only page state: remove provider badge from header, move provider messaging into result panel, redesign composer/result stacking in desktop view, and split desktop/mobile history behaviors while preserving one shared route and one shared data flow.

**Tech Stack:** React 18, TypeScript, TanStack Query, React Router v6, Tailwind CSS v3, Radix Select, lucide-react, pnpm 11

---

## File Structure

- Modify: `frontend/src/pages/Translate/index.tsx`
- Modify: `frontend/src/pages/Translate/TranslateDesktopView.tsx`
- Modify: `frontend/src/pages/Translate/TranslateMobileView.tsx`
- Modify: `frontend/src/pages/Translate/translate.shared.ts`
- Modify: `frontend/src/pages/Translate/components/TranslateHeader.tsx`
- Modify: `frontend/src/pages/Translate/components/TranslateComposer.tsx`
- Modify: `frontend/src/pages/Translate/components/TranslateResultPanel.tsx`
- Modify: `frontend/src/pages/Translate/components/TranslateHistoryList.tsx`
- Modify: `frontend/src/pages/Translate/components/ProviderEmptyState.tsx`

### Task 1: Remove header provider badge and localize provider messaging to result state

**Files:**
- Modify: `frontend/src/pages/Translate/components/TranslateHeader.tsx`
- Modify: `frontend/src/pages/Translate/components/TranslateResultPanel.tsx`
- Modify: `frontend/src/pages/Translate/index.tsx`

- [ ] **Step 1: Write the failing UI expectation into the component contract**

```tsx
// TranslateHeader 只负责标题区，不再展示 provider ready 或 provider checking 状态，避免正常状态抢占注意力。
export function TranslateHeader() {
  return (
    <header>
      <p>Translate</p>
      <h1>轻量翻译工作台</h1>
      <p>同一个意思，换一种语言，你会看见它不同的棱角。</p>
    </header>
  )
}
```

```tsx
// TranslateResultPanel 集中处理 provider 检测中和 provider 未配置状态，保证异常只在结果语境中出现。
type TranslateResultPanelProps = {
  providerMissing: boolean
  providerChecking: boolean
}
```

- [ ] **Step 2: Run frontend lint to verify the old props shape still leaks provider badge state into header**

Run:

```bash
cd frontend && pnpm lint
```

Expected: FAIL or surface type mismatches because `TranslateHeader` currently still expects `providerMissing` and `providerChecking`.

- [ ] **Step 3: Update `index.tsx` and both view files to stop passing provider badge props into the header**

```tsx
<TranslateDesktopView
  {...viewProps}
/>
```

```tsx
<TranslateHeader />
```

```tsx
<TranslateResultPanel
  result={props.result}
  resultStage={props.resultStage}
  copied={props.copied}
  pending={props.pending}
  providerMissing={props.providerMissing}
  providerChecking={props.providerChecking}
  errorMessage={props.errorMessage}
  onCopy={props.onCopy}
/>
```

- [ ] **Step 4: Re-run lint and build**

Run:

```bash
cd frontend && pnpm lint
cd frontend && pnpm build
```

Expected: PASS. Header no longer contains provider badge logic.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Translate/index.tsx frontend/src/pages/Translate/TranslateDesktopView.tsx frontend/src/pages/Translate/TranslateMobileView.tsx frontend/src/pages/Translate/components/TranslateHeader.tsx frontend/src/pages/Translate/components/TranslateResultPanel.tsx
git commit -m "refactor: move translate provider messaging into result panel"
```

### Task 2: Convert desktop layout from side-by-side columns to stacked workbench

**Files:**
- Modify: `frontend/src/pages/Translate/TranslateDesktopView.tsx`
- Modify: `frontend/src/pages/Translate/components/TranslateComposer.tsx`
- Modify: `frontend/src/pages/Translate/components/TranslateResultPanel.tsx`

- [ ] **Step 1: Write the failing desktop layout target**

```tsx
// TranslateDesktopView 改为单列堆叠工作台，让输入后视线自然向下进入结果区，而不是横向切换阅读焦点。
export function TranslateDesktopView(props: TranslateViewProps) {
  return (
    <div className="hidden space-y-4 md:block">
      <TranslateHeader />
      <TranslateComposer {...props} mode="desktop" />
      <TranslateResultPanel {...resultProps} mode="desktop" />
      <TranslateHistoryList {...historyProps} mode="desktop" />
    </div>
  )
}
```

- [ ] **Step 2: Run lint to confirm the current layout contract does not yet support stacked mode**

Run:

```bash
cd frontend && pnpm lint
```

Expected: FAIL because `TranslateComposer` and `TranslateResultPanel` do not yet accept `mode` or the desktop view still uses a grid.

- [ ] **Step 3: Update the desktop view and reduce result panel spacing for full-width reading**

```tsx
return (
  <div className="hidden space-y-5 md:block">
    <TranslateHeader />
    <TranslateComposer {...props} mode="desktop" />
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
    <TranslateHistoryList history={props.history} onReuse={props.onReuseHistory} mode="desktop" />
  </div>
)
```

- [ ] **Step 4: Re-run lint and build**

Run:

```bash
cd frontend && pnpm lint
cd frontend && pnpm build
```

Expected: PASS. Desktop no longer renders side-by-side composer/result columns.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Translate/TranslateDesktopView.tsx frontend/src/pages/Translate/components/TranslateComposer.tsx frontend/src/pages/Translate/components/TranslateResultPanel.tsx
git commit -m "refactor: stack translate desktop workbench"
```

### Task 3: Make the composer tighter and consolidate controls into a toolbar-like row

**Files:**
- Modify: `frontend/src/pages/Translate/components/TranslateComposer.tsx`
- Modify: `frontend/src/pages/Translate/translate.shared.ts`

- [ ] **Step 1: Write the failing composer layout shape**

```tsx
type TranslateComposerProps = {
  mode: 'desktop' | 'mobile'
}
```

```tsx
<textarea
  rows={mode === 'desktop' ? 6 : 5}
  className={cn(
    'nexus-input w-full resize-none p-3 text-sm leading-7',
    mode === 'desktop' ? 'min-h-[156px]' : 'min-h-[120px]'
  )}
/>
```

```tsx
<div className={cn(
  'mt-4 gap-3',
  mode === 'desktop' ? 'flex items-end justify-between' : 'grid'
)}>
  {/* language */}
  {/* style */}
  {/* action */}
</div>
```

- [ ] **Step 2: Run lint to confirm the current composer still uses the old two-column controls plus button-below pattern**

Run:

```bash
cd frontend && pnpm lint
```

Expected: FAIL until the new `mode` prop and toolbar layout are wired through.

- [ ] **Step 3: Implement compact desktop controls and mobile-first stacked controls**

```tsx
{mode === 'desktop' ? (
  <div className="mt-4 flex flex-wrap items-end gap-3">
    <div className="w-[240px] shrink-0">{/* target language select */}</div>
    <div className="min-w-[320px] flex-1">{/* compact style segmented row */}</div>
    <button type="button" className="nexus-button-primary ml-auto inline-flex min-w-[132px] items-center justify-center gap-2 px-5 py-2 text-sm">
      翻译
    </button>
  </div>
) : (
  <div className="mt-4 space-y-3">
    <div>{/* target language select */}</div>
    <div className="overflow-x-auto pb-1">{/* horizontally scrollable style chips */}</div>
    <button type="button" className="nexus-button-primary w-full px-5 py-2 text-sm">
      翻译
    </button>
  </div>
)}
```

- [ ] **Step 4: Re-run lint and build**

Run:

```bash
cd frontend && pnpm lint
cd frontend && pnpm build
```

Expected: PASS. Desktop composer feels tighter and mobile controls no longer mirror desktop.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Translate/components/TranslateComposer.tsx frontend/src/pages/Translate/translate.shared.ts
git commit -m "refactor: tighten translate composer controls"
```

### Task 4: Redesign result panel states for full-width reading and lighter alternatives

**Files:**
- Modify: `frontend/src/pages/Translate/components/TranslateResultPanel.tsx`
- Modify: `frontend/src/pages/Translate/components/ProviderEmptyState.tsx`

- [ ] **Step 1: Write the failing panel state target**

```tsx
type TranslateResultPanelProps = {
  mode: 'desktop' | 'mobile'
  providerChecking: boolean
}
```

```tsx
if (providerChecking && !result && !providerMissing) {
  return (
    <section className="nexus-surface p-5">
      <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground">Result</p>
      <div className="mt-8 max-w-md">
        <h2 className="text-xl font-extrabold text-foreground">正在检查翻译能力</h2>
        <p className="mt-2 text-sm leading-7 text-muted-foreground">如果可用 provider 已配置，结果会在这里显示；如果未配置，也只会在这里提示。</p>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Run lint to verify the current result panel does not yet accept providerChecking and mode**

Run:

```bash
cd frontend && pnpm lint
```

Expected: FAIL until props and state rendering are updated.

- [ ] **Step 3: Implement full-width reading spacing and lighter alternative rows**

```tsx
{alternatives.length > 0 && (
  <div className="mt-5 border-t border-border pt-4">
    <h3 className="text-sm font-extrabold text-foreground">Alternatives</h3>
    <div className="mt-2 space-y-2">
      {visibleAlternatives.map((alternative) => (
        <button
          key={alternative}
          type="button"
          className="w-full rounded-lg border border-border bg-muted/35 px-3 py-2.5 text-left text-sm leading-6 text-foreground transition-colors hover:border-input hover:bg-muted/55"
        >
          {alternative}
        </button>
      ))}
    </div>
  </div>
)}
```

```tsx
// ProviderEmptyState 在结果面板语境内解释“为什么没结果”，不再像全局告警条。
export function ProviderEmptyState() {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-lg font-extrabold text-foreground">还没有可用翻译模型</h3>
      <p className="text-sm leading-7 text-muted-foreground">Translate 需要先在 Settings 中配置可用的 LLM provider。配置完成后，这里会直接显示译文、解释、关键词和备选表达。</p>
      <Link to="/settings" className="nexus-button-primary inline-flex w-full items-center justify-center px-4 py-2 text-sm sm:w-auto">前往 Settings</Link>
    </div>
  )
}
```

- [ ] **Step 4: Re-run lint and build**

Run:

```bash
cd frontend && pnpm lint
cd frontend && pnpm build
```

Expected: PASS. Result panel becomes the single source of provider status and reads better at full width.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Translate/components/TranslateResultPanel.tsx frontend/src/pages/Translate/components/ProviderEmptyState.tsx
git commit -m "refactor: redesign translate result panel states"
```

### Task 5: Add search, pagination, and denser cards to the history section

**Files:**
- Modify: `frontend/src/pages/Translate/index.tsx`
- Modify: `frontend/src/pages/Translate/components/TranslateHistoryList.tsx`
- Modify: `frontend/src/pages/Translate/translate.shared.ts`

- [ ] **Step 1: Write the failing history UI state**

```tsx
const [historyQuery, setHistoryQuery] = useState('')
const [historyPage, setHistoryPage] = useState(1)
const historyPageSize = isMobile ? 8 : 12
```

```ts
export function filterTranslationHistory(history: TranslationResult[], query: string) {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return history
  return history.filter((item) =>
    item.sourceText.toLowerCase().includes(normalized) ||
    item.translatedText.toLowerCase().includes(normalized) ||
    (item.keywords ?? []).some((keyword) => keyword.toLowerCase().includes(normalized))
  )
}
```

- [ ] **Step 2: Run lint to confirm the current history component only renders a sliced top-10 list**

Run:

```bash
cd frontend && pnpm lint
```

Expected: FAIL until `TranslateHistoryList` accepts search and pagination props.

- [ ] **Step 3: Implement searchable, paginated, denser history rendering**

```tsx
type TranslateHistoryListProps = {
  history: TranslationResult[]
  historyQuery: string
  historyPage: number
  totalPages: number
  onHistoryQueryChange: (value: string) => void
  onHistoryPageChange: (page: number) => void
  onReuse: (item: TranslationResult) => void
  mode: 'desktop' | 'mobile'
}
```

```tsx
<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
  <input
    value={historyQuery}
    onChange={(event) => onHistoryQueryChange(event.target.value)}
    placeholder="搜索原文、译文或关键词"
    className="nexus-input w-full px-3 text-sm md:max-w-sm"
  />
  <div className="flex items-center justify-between gap-2 text-xs font-semibold text-muted-foreground">
    <button type="button" onClick={() => onHistoryPageChange(historyPage - 1)} disabled={historyPage <= 1} className="nexus-button-utility px-3 text-xs">上一页</button>
    <span>{historyPage} / {totalPages}</span>
    <button type="button" onClick={() => onHistoryPageChange(historyPage + 1)} disabled={historyPage >= totalPages} className="nexus-button-utility px-3 text-xs">下一页</button>
  </div>
</div>
```

```tsx
<ul className={mode === 'desktop' ? 'grid gap-2 md:grid-cols-2' : 'space-y-2'}>
  {pagedHistory.map((item) => (
    <li key={item.id}>
      <button type="button" onClick={() => onReuse(item)} className="nexus-surface w-full p-3 text-left transition-colors hover:border-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {/* denser metadata */}
      </button>
    </li>
  ))}
</ul>
```

- [ ] **Step 4: Re-run lint and build**

Run:

```bash
cd frontend && pnpm lint
cd frontend && pnpm build
```

Expected: PASS. History shows search, pagination, and denser cards.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Translate/index.tsx frontend/src/pages/Translate/components/TranslateHistoryList.tsx frontend/src/pages/Translate/translate.shared.ts
git commit -m "feat: add translate history search and pagination"
```

### Task 6: Redesign the mobile view as a phone-first workflow

**Files:**
- Modify: `frontend/src/pages/Translate/TranslateMobileView.tsx`
- Modify: `frontend/src/pages/Translate/components/TranslateComposer.tsx`
- Modify: `frontend/src/pages/Translate/components/TranslateHistoryList.tsx`
- Modify: `frontend/src/pages/Translate/components/TranslateResultPanel.tsx`

- [ ] **Step 1: Write the failing mobile structure target**

```tsx
// TranslateMobileView 改为手机优先的工作流：轻 header、紧凑输入卡、移动控制条、结果卡、搜索后的历史列表。
export function TranslateMobileView(props: TranslateViewProps) {
  return (
    <div className="space-y-4 pb-20 md:hidden">
      <TranslateHeader />
      <TranslateComposer {...props} mode="mobile" />
      <TranslateResultPanel {...resultProps} mode="mobile" />
      <TranslateHistoryList {...historyProps} mode="mobile" />
    </div>
  )
}
```

- [ ] **Step 2: Run lint to confirm mobile-specific props are not yet fully wired**

Run:

```bash
cd frontend && pnpm lint
```

Expected: FAIL until all mobile-aware props are passed consistently.

- [ ] **Step 3: Implement phone-first controls and denser single-column history**

```tsx
// mobile composer
<div className="mt-4 space-y-3">
  <div>{/* target language select */}</div>
  <div className="-mx-1 overflow-x-auto px-1 pb-1">
    <div className="flex min-w-max gap-2">
      {STYLES.map((item) => (
        <button key={item.value} type="button" className="nexus-button-utility min-h-10 shrink-0 px-4 text-xs font-extrabold">
          {item.label}
        </button>
      ))}
    </div>
  </div>
  <button type="button" className="nexus-button-primary w-full px-5 py-2 text-sm">翻译</button>
</div>
```

```tsx
// mobile history card
<button type="button" className="nexus-surface w-full p-3 text-left">
  <p className="line-clamp-1 text-sm text-muted-foreground">{item.sourceText}</p>
  <p className="mt-1 line-clamp-1 text-sm font-semibold text-foreground">{item.translatedText}</p>
  <p className="mt-2 text-xs font-semibold text-muted-foreground">{formatRelative(item.createdAt)} · {item.targetLang} · {styleLabel(item.style)}</p>
</button>
```

- [ ] **Step 4: Re-run lint and build**

Run:

```bash
cd frontend && pnpm lint
cd frontend && pnpm build
```

Expected: PASS. Mobile no longer feels like compressed desktop.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Translate/TranslateMobileView.tsx frontend/src/pages/Translate/components/TranslateComposer.tsx frontend/src/pages/Translate/components/TranslateHistoryList.tsx frontend/src/pages/Translate/components/TranslateResultPanel.tsx
git commit -m "refactor: redesign translate mobile workflow"
```

### Task 7: Final verification against the refresh spec

**Files:**
- Modify: `docs/superpowers/specs/2026-06-12-translate-layout-refresh-design.md`
- Modify: `docs/superpowers/plans/2026-06-12-translate-layout-refresh.md`

- [ ] **Step 1: Run final frontend verification**

Run:

```bash
cd frontend && pnpm lint
cd frontend && pnpm build
```

Expected: PASS.

- [ ] **Step 2: Manually verify the refreshed UX against the design spec**

```text
Check the following in browser:
- header has no provider ready badge
- desktop composer/result are stacked vertically
- textarea is visibly shorter than the previous version
- controls feel like one tool row on desktop
- provider missing only appears in result panel
- history supports search and pagination
- mobile layout uses separate control flow and denser history
```

- [ ] **Step 3: Commit final cleanup if documentation changed during implementation**

```bash
git add docs/superpowers/specs/2026-06-12-translate-layout-refresh-design.md docs/superpowers/plans/2026-06-12-translate-layout-refresh.md
git commit -m "docs: finalize translate layout refresh plan"
```
