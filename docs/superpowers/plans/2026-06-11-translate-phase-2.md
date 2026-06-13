# Translate Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Nexus Translate Phase 2 as a shared-logic, desktop/mobile translation workbench with richer result structure, provider-empty guidance, and history rehydrate support.

**Architecture:** Keep `/translate` as one route and move all data orchestration into `frontend/src/pages/Translate/index.tsx`. Expand the backend translate contract first so the frontend can render layered results without ad-hoc parsing, then split the frontend into desktop/mobile view files and focused presentational components that inherit the existing `DESIGN.md` system.

**Tech Stack:** Spring Boot 3.3, MyBatis-Plus, Flyway, React 18, TypeScript, TanStack Query, React Router v6, Tailwind CSS v3, pnpm 11

---

## File Structure

- Modify: `backend/src/main/java/com/nexus/entity/Translation.java`
- Modify: `backend/src/main/java/com/nexus/service/TranslateService.java`
- Modify: `backend/src/main/java/com/nexus/controller/TranslateController.java`
- Modify: `backend/src/main/java/com/nexus/dto/request/TranslateRequest.java`
- Create: `backend/src/main/resources/db/migration/V1_3__expand_translation_result_fields.sql`
- Create: `backend/src/main/java/com/nexus/translate/TranslationProviderPort.java`
- Create: `backend/src/main/java/com/nexus/translate/LlmTranslationProvider.java`
- Create: `backend/src/test/java/com/nexus/service/TranslateServiceTest.java`
- Modify: `frontend/src/types/domain.types.ts`
- Modify: `frontend/src/api/translate.api.ts`
- Modify: `frontend/src/pages/Translate/index.tsx`
- Create: `frontend/src/pages/Translate/translate.shared.ts`
- Create: `frontend/src/pages/Translate/TranslateDesktopView.tsx`
- Create: `frontend/src/pages/Translate/TranslateMobileView.tsx`
- Create: `frontend/src/pages/Translate/components/TranslateHeader.tsx`
- Create: `frontend/src/pages/Translate/components/TranslateComposer.tsx`
- Create: `frontend/src/pages/Translate/components/TranslateResultPanel.tsx`
- Create: `frontend/src/pages/Translate/components/TranslateHistoryList.tsx`
- Create: `frontend/src/pages/Translate/components/ProviderEmptyState.tsx`

### Task 1: Expand the backend translate contract

**Files:**
- Create: `backend/src/main/resources/db/migration/V1_3__expand_translation_result_fields.sql`
- Modify: `backend/src/main/java/com/nexus/entity/Translation.java`
- Modify: `backend/src/main/java/com/nexus/dto/request/TranslateRequest.java`

- [ ] **Step 1: Write the failing migration and entity shape**

```sql
ALTER TABLE translations
  ADD COLUMN explanation TEXT,
  ADD COLUMN keywords JSONB,
  ADD COLUMN alternatives JSONB,
  ADD COLUMN provider VARCHAR(100);
```

```java
/** Translation 记录一次翻译结果及其补充信息，支撑 Translate 工作台回填和历史浏览。 */
@TableName("translations")
public class Translation {
    private String id;
    private String sourceText;
    private String translatedText;
    private String sourceLang;
    private String targetLang;
    private String style;
    private String explanation;
    private String keywords;
    private String alternatives;
    private String provider;
    private LocalDateTime createdAt;
}
```

- [ ] **Step 2: Run backend tests to confirm current code does not yet support the new shape**

Run:

```bash
cd backend && mvn test -Dtest=TranslateServiceTest
```

Expected: FAIL because `TranslateServiceTest` and new persistence fields are not implemented yet.

- [ ] **Step 3: Add request-level context field for future provider prompts**

```java
public class TranslateRequest {
    @NotBlank
    private String sourceText;

    @NotBlank
    private String targetLang;

    private String sourceLang;

    private String style;

    /** 为 Phase 2 预留上下文，后续可用于术语或场景约束。 */
    private String context;
}
```

- [ ] **Step 4: Run compile-oriented verification**

Run:

```bash
cd backend && mvn -q -DskipTests compile
```

Expected: FAIL or compile warnings until provider abstraction and service mapping are completed in Task 2.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/resources/db/migration/V1_3__expand_translation_result_fields.sql backend/src/main/java/com/nexus/entity/Translation.java backend/src/main/java/com/nexus/dto/request/TranslateRequest.java
git commit -m "feat: expand translation result schema"
```

### Task 2: Introduce provider abstraction and richer translate service output

**Files:**
- Create: `backend/src/main/java/com/nexus/translate/TranslationProviderPort.java`
- Create: `backend/src/main/java/com/nexus/translate/LlmTranslationProvider.java`
- Modify: `backend/src/main/java/com/nexus/service/TranslateService.java`
- Modify: `backend/src/main/java/com/nexus/controller/TranslateController.java`
- Test: `backend/src/test/java/com/nexus/service/TranslateServiceTest.java`

- [ ] **Step 1: Write the failing service test**

```java
@Test
void translateShouldReturnLayeredResultAndPersistProviderMetadata() {
    TranslateRequest req = new TranslateRequest();
    req.setSourceText("今天的会议推迟到下午三点");
    req.setTargetLang("英文");
    req.setStyle("formal");

    Translation saved = translateService.translate(req);

    assertThat(saved.getTranslatedText()).isNotBlank();
    assertThat(saved.getExplanation()).isNotBlank();
    assertThat(saved.getKeywords()).contains("会议");
    assertThat(saved.getAlternatives()).contains("The meeting has been moved");
    assertThat(saved.getProvider()).isEqualTo("llm");
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
cd backend && mvn test -Dtest=TranslateServiceTest
```

Expected: FAIL because no provider abstraction exists and `TranslateService` only returns one text field.

- [ ] **Step 3: Add the provider port and LLM implementation**

```java
public interface TranslationProviderPort {
    TranslationResultPayload translate(TranslateRequest request);
}
```

```java
@Component
public class LlmTranslationProvider implements TranslationProviderPort {
    public TranslationResultPayload translate(TranslateRequest request) {
        return new TranslationResultPayload(
            translatedText,
            explanation,
            keywords,
            alternatives,
            "llm"
        );
    }
}
```

- [ ] **Step 4: Update `TranslateService` to persist layered output and provider-empty guidance**

```java
public Translation translate(TranslateRequest req) {
    TranslationResultPayload payload = translationProvider.translate(req);

    Translation entity = new Translation();
    entity.setSourceText(req.getSourceText());
    entity.setSourceLang(req.getSourceLang());
    entity.setTargetLang(req.getTargetLang());
    entity.setStyle(req.getStyle());
    entity.setTranslatedText(payload.translatedText());
    entity.setExplanation(payload.explanation());
    entity.setKeywords(writeJson(payload.keywords()));
    entity.setAlternatives(writeJson(payload.alternatives()));
    entity.setProvider(payload.provider());
    translationMapper.insert(entity);
    return entity;
}
```

- [ ] **Step 5: Run backend verification**

Run:

```bash
cd backend && mvn test -Dtest=TranslateServiceTest
cd backend && mvn -q -DskipTests compile
```

Expected: PASS for the targeted test and successful compile.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/com/nexus/translate backend/src/main/java/com/nexus/service/TranslateService.java backend/src/main/java/com/nexus/controller/TranslateController.java backend/src/test/java/com/nexus/service/TranslateServiceTest.java
git commit -m "feat: add translation provider abstraction"
```

### Task 3: Update frontend types and API compatibility

**Files:**
- Modify: `frontend/src/types/domain.types.ts`
- Modify: `frontend/src/api/translate.api.ts`

- [ ] **Step 1: Write the failing frontend type usage**

```ts
export interface TranslationResult {
  id: string
  sourceText: string
  translatedText: string
  sourceLang?: string
  targetLang: string
  style?: string
  explanation?: string
  keywords?: string[]
  alternatives?: string[]
  provider?: string
  createdAt: string
}
```

```ts
translate: (data: {
  sourceText: string
  targetLang: string
  sourceLang?: string
  style?: string
  context?: string
}) => apiClient.post<ApiResponse<TranslationResult>>('/translate/translate', data)
```

- [ ] **Step 2: Run lint to confirm current UI references still assume the old shape**

Run:

```bash
cd frontend && pnpm lint
```

Expected: FAIL if existing code still imports `Translation` and assumes only `translatedText`.

- [ ] **Step 3: Add a compatibility comment and normalize optional arrays**

```ts
// Phase 2 结果字段会由后端逐步补齐，因此前端先把 explanation/keywords/alternatives 视为可选字段，避免前后端必须同步上线。
export function normalizeTranslationResult(input: TranslationResult): TranslationResult {
  return {
    ...input,
    keywords: input.keywords ?? [],
    alternatives: input.alternatives ?? [],
  }
}
```

- [ ] **Step 4: Re-run lint**

Run:

```bash
cd frontend && pnpm lint
```

Expected: PASS for the updated type/API layer, or remaining failures isolated to `frontend/src/pages/Translate/index.tsx` until Task 4 begins.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types/domain.types.ts frontend/src/api/translate.api.ts
git commit -m "feat: expand translate frontend contract"
```

### Task 4: Split the Translate page into shared logic plus desktop/mobile views

**Files:**
- Modify: `frontend/src/pages/Translate/index.tsx`
- Create: `frontend/src/pages/Translate/translate.shared.ts`
- Create: `frontend/src/pages/Translate/TranslateDesktopView.tsx`
- Create: `frontend/src/pages/Translate/TranslateMobileView.tsx`

- [ ] **Step 1: Write the shared constants and props contract**

```ts
export const LANGUAGES = ['中文', '英文', '日文', '法文', '德文', '西班牙文', '韩文'] as const

export const STYLES = [
  { value: '', label: '默认' },
  { value: 'formal', label: '正式' },
  { value: 'casual', label: '口语' },
  { value: 'technical', label: '技术' },
] as const
```

```ts
export interface TranslateViewProps {
  sourceText: string
  targetLang: string
  style: string
  result: TranslationResult | null
  history: TranslationResult[]
  pending: boolean
  copied: boolean
  providerMissing: boolean
  onSourceTextChange: (value: string) => void
  onTargetLangChange: (value: string) => void
  onStyleChange: (value: string) => void
  onTranslate: () => void
  onCopy: () => void
  onReuseHistory: (item: TranslationResult) => void
}
```

- [ ] **Step 2: Run lint to verify the new file split is required**

Run:

```bash
cd frontend && pnpm lint
```

Expected: FAIL because the new props contract is not yet wired into page code.

- [ ] **Step 3: Refactor `index.tsx` into orchestration only**

```tsx
// TranslatePage 负责统一编排查询、mutation、回填和复制反馈，桌面端与移动端共用这一套业务状态。
export default function TranslatePage() {
  const [sourceText, setSourceText] = useState('')
  const [targetLang, setTargetLang] = useState('英文')
  const [style, setStyle] = useState('')
  const [copied, setCopied] = useState(false)
  const [result, setResult] = useState<TranslationResult | null>(null)

  const translateMutation = useMutation({
    mutationFn: () => translateApi.translate({ sourceText, targetLang, style: style || undefined }),
    onSuccess: ({ data }) => {
      if (data.data) setResult(normalizeTranslationResult(data.data))
    },
  })

  const reuseHistory = (item: TranslationResult) => {
    setSourceText(item.sourceText)
    setTargetLang(item.targetLang)
    setStyle(item.style ?? '')
    setResult(normalizeTranslationResult(item))
  }
}
```

- [ ] **Step 4: Add separate desktop/mobile layout files**

```tsx
// TranslateDesktopView 负责桌面端双栏工作台布局，避免把复杂响应式判断塞回 page 层。
export function TranslateDesktopView(props: TranslateViewProps) {
  return <div className="hidden gap-6 md:grid md:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.9fr)]">{/* ... */}</div>
}
```

```tsx
// TranslateMobileView 负责移动端纵向卡片流，保证触控优先的阅读和操作顺序。
export function TranslateMobileView(props: TranslateViewProps) {
  return <div className="space-y-4 md:hidden">{/* ... */}</div>
}
```

- [ ] **Step 5: Run lint and build**

Run:

```bash
cd frontend && pnpm lint
cd frontend && pnpm build
```

Expected: PASS. The Translate page should now compile with shared logic and split views.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/Translate/index.tsx frontend/src/pages/Translate/translate.shared.ts frontend/src/pages/Translate/TranslateDesktopView.tsx frontend/src/pages/Translate/TranslateMobileView.tsx
git commit -m "feat: split translate page views"
```

### Task 5: Add presentational components for result, history, and empty states

**Files:**
- Create: `frontend/src/pages/Translate/components/TranslateHeader.tsx`
- Create: `frontend/src/pages/Translate/components/TranslateComposer.tsx`
- Create: `frontend/src/pages/Translate/components/TranslateResultPanel.tsx`
- Create: `frontend/src/pages/Translate/components/TranslateHistoryList.tsx`
- Create: `frontend/src/pages/Translate/components/ProviderEmptyState.tsx`
- Modify: `frontend/src/pages/Translate/TranslateDesktopView.tsx`
- Modify: `frontend/src/pages/Translate/TranslateMobileView.tsx`

- [ ] **Step 1: Create the result panel contract**

```tsx
// TranslateResultPanel 展示 Phase 2 分层结果，兼容 explanation/keywords/alternatives 缺省的后端过渡期。
export function TranslateResultPanel({
  result,
  copied,
  pending,
  providerMissing,
  onCopy,
}: {
  result: TranslationResult | null
  copied: boolean
  pending: boolean
  providerMissing: boolean
  onCopy: () => void
}) {
  if (providerMissing) return <ProviderEmptyState />
  if (pending) return <div className="nexus-surface p-4">正在生成翻译结果…</div>
  if (!result) return <div className="nexus-surface p-4 text-sm text-muted-foreground">翻译结果将显示在这里</div>
  return <section className="nexus-surface p-4">{/* ... */}</section>
}
```

- [ ] **Step 2: Run lint to catch missing imports and props**

Run:

```bash
cd frontend && pnpm lint
```

Expected: FAIL until all new component props are wired up.

- [ ] **Step 3: Implement history rehydrate UI and provider empty state**

```tsx
// TranslateHistoryList 把历史记录变成可回填的工作记忆，而不是只读列表。
export function TranslateHistoryList({ history, onReuse }: { history: TranslationResult[]; onReuse: (item: TranslationResult) => void }) {
  return (
    <ul className="space-y-2">
      {history.map((item) => (
        <li key={item.id}>
          <button type="button" onClick={() => onReuse(item)} className="nexus-surface w-full p-3 text-left transition-colors hover:border-input">
            {/* ... */}
          </button>
        </li>
      ))}
    </ul>
  )
}
```

```tsx
// ProviderEmptyState 在模型未配置时提供明确去路，避免用户误以为是普通网络失败。
export function ProviderEmptyState() {
  return (
    <div className="nexus-surface flex flex-col gap-3 p-4">
      <h3 className="text-base font-extrabold">未配置可用翻译模型</h3>
      <p className="text-sm leading-7 text-muted-foreground">请先前往 Settings 配置 LLM provider，Translate 才能生成译文、解释和备选表达。</p>
      <Link to="/settings" className="nexus-button-primary w-full px-4 py-2 text-sm sm:w-auto">去配置</Link>
    </div>
  )
}
```

- [ ] **Step 4: Verify end-to-end frontend output**

Run:

```bash
cd frontend && pnpm lint
cd frontend && pnpm build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Translate/components frontend/src/pages/Translate/TranslateDesktopView.tsx frontend/src/pages/Translate/TranslateMobileView.tsx
git commit -m "feat: add translate result and history panels"
```

### Task 6: Final verification and documentation sync

**Files:**
- Modify: `docs/superpowers/specs/2026-06-11-translate-phase-2-design.md`
- Modify: `docs/superpowers/plans/2026-06-11-translate-phase-2.md`

- [ ] **Step 1: Verify backend checks**

Run:

```bash
cd backend && mvn test -Dtest=TranslateServiceTest
cd backend && mvn -q -DskipTests compile
```

Expected: PASS.

- [ ] **Step 2: Verify frontend checks**

Run:

```bash
cd frontend && pnpm lint
cd frontend && pnpm build
```

Expected: PASS.

- [ ] **Step 3: Review spec-to-plan coverage**

```text
Confirm the implementation includes:
- desktop/mobile split views
- layered result structure
- provider empty state
- history rehydrate
- DESIGN.md visual alignment
```

- [ ] **Step 4: Commit final documentation adjustments**

```bash
git add docs/superpowers/specs/2026-06-11-translate-phase-2-design.md docs/superpowers/plans/2026-06-11-translate-phase-2.md
git commit -m "docs: finalize translate phase 2 plan"
```
