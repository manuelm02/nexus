# Inbox 笔记标签机制重构：单标签 + 按标签存储 + AI 标签整理 + 汇总 Markdown 渲染

## 背景与问题

上一轮 Inbox 笔记重构（速记/备忘录拆分 + 标签索引 + AI 汇总）已落地，但实际使用中发现：

1. **标签未生效**：用户点击「AI 整理」后能看到建议标签，但若未先点「合并到当前笔记」就直接「保存原文」，标签会丢失——笔记文件 front matter 没有 `tags`，标签索引文件也没有写入新标签。本质原因是"AI 整理"和"保存"是两个独立动作，标签只在用户手动应用建议后才进入 `selectedTags`。
2. **汇总结果展示**：`NoteSummaryPanel` 把 AI 生成的 Markdown 汇总当纯文本展示（`whitespace-pre-wrap`），希望改为 Markdown 预览渲染；复制按钮需要复制完整 Markdown 源文本（这一点现状已满足，保留即可）。
3. **存储结构与标签数量**：笔记不再按年/月目录存储，改为按标签分类存储；每篇笔记标签数从"≤3"改为"恰好 1 个"，且不允许为空——若用户保存时未选标签，由 AI 自动打 1 个标签。由于"只有 1 个标签"，后续会有更合适的标签出现，因此新增"AI 整理标签"功能：手动触发后，AI 重新评估所有笔记的标签并把文件移动到新的标签目录。
4. **文件命名**：笔记文件名改为 `{标题}.md`（不再用时间戳前缀），同目录下标题重复时追加序号 `-2`、`-3` 避免覆盖。

## 范围确认

- **历史笔记不主动迁移**：旧的按年/月存储的笔记保留原位；但"AI 整理标签"功能扫描整个笔记目录（含旧结构），会把扫描到的笔记按新规则（`{tag}/{标题}.md`）重新归位，因此旧笔记可通过手动触发整理来迁移。
- **AI 标签整理为手动触发**：在「笔记汇总」面板新增「整理标签」按钮，点击后立即执行（不是预览-确认两步），执行完成后展示变更列表。
- front matter 中标签字段保持 `tags:` YAML 列表格式（仅含 1 个元素），与现有 `NoteSummaryService` 的 front matter 解析逻辑保持兼容，无需改动该解析逻辑。

---

## 1. 单标签机制 + 保存时 AI 自动打标签

### `NoteAiService`（修改）

- `capTags()`：上限从 3 改为 1（`tags.size() > 1 ? subList(0,1) : tags`）。
- `buildNoteAnalyzePrompt()`：标签要求改为"tags 字段最终数量（复用 + 新建）恰好 1 个"；其余措辞同步调整（不再提"不超过 3 个"）。
- 新增方法：

```java
/**
 * 为未选择标签的笔记自动建议唯一标签：优先复用标签索引中语义匹配的标签，
 * AI 不可用或解析失败时降级为"未分类"（若索引中已存在"未分类"则不重复写入说明）。
 *
 * @param content 笔记正文
 * @param kind    笔记类型：quick_note / memo
 * @return 标签建议：name 为最终标签名；description 非 null 时表示这是一个需要写入标签索引的新标签
 */
public NoteTagSuggestionResponse suggestSingleTag(String content, String kind)
```

实现要点：
- 读取 `noteTagIndexService.listTags(kind)` 作为已有标签索引。
- LLM 不可用 → 检查索引中是否已有 `"未分类"`；若没有则 `description = "AI 未启用或暂不可用时的默认分类，可手动整理"`，否则 `description = null`。`name = "未分类"`。
- LLM 可用 → 构建一个精简版 prompt（要求返回 `{"tag": "...", "is_new": true/false, "description": "..."}`，优先复用索引中标签），解析失败时同样降级为"未分类"逻辑。
- 新增 DTO `backend/src/main/java/com/nexus/dto/response/NoteTagSuggestionResponse.java`：

```java
package com.nexus.dto.response;

import lombok.Data;

/** 单标签建议：AI 为缺少标签的笔记自动建议的标签名及（若为新标签）说明。 */
@Data
public class NoteTagSuggestionResponse {
    private String name;
    /** 非 null 表示该标签不在现有索引中，需要随保存写回标签索引 */
    private String description;
}
```

### `ObsidianMarkdownWriter`（重写路径与标签逻辑）

- 移除按年/月的路径结构与 `FILE_TIMESTAMP` 文件名格式。
- 新路径：`{vaultRoot}/{noteDir}/{tag}/{文件名}.md`。
- 标签确定逻辑：
  - `req.getTags()` 非空 → 取第一个元素作为 `tag`，忽略多余元素。
  - `req.getTags()` 为空 → 调用 `noteAiService.suggestSingleTag(req.getContent(), req.getKind())` 得到 `tag`；若返回的 `description != null`，加入待同步的 `newTagDescriptions`（与 `req.getNewTagDescriptions()` 合并）。
- 文件名：
  - 基础名 = `req.getTitle()` 非空时取其 `slugify()` 结果，否则用 `"未命名笔记"`。
  - 若 `{tag}/` 目录下 `{基础名}.md` 已存在，依次尝试 `{基础名}-2.md`、`{基础名}-3.md`... 直到不冲突。
- front matter：`tags:` 列表写入这 1 个 `tag`（保持现有格式不变）。
- 保存后调用 `noteTagIndexService.syncNewTags(req.getKind(), newTagDescriptions)`（合并 `req.getNewTagDescriptions()` 与上面自动打标签产生的新标签说明）。
- `QuickNoteResponse` 新增字段 `private String tag;`，返回最终写入的标签，供前端展示反馈（如"已保存到「{tag}」分类"）。
- 路径穿越校验逻辑保留（vaultRoot 校验）。
- `slugify()` 复用现有实现（替换非法文件名字符），用于标签目录名和文件基础名。

### 测试

- `ObsidianMarkdownWriterTest`：
  - 标题非空、有标签 → 文件写入 `{noteDir}/{tag}/{标题}.md`，front matter 含该标签。
  - 标签为空、AI 可用 → mock `noteAiService.suggestSingleTag` 返回新标签，验证文件写入对应目录、`syncNewTags` 被调用、`QuickNoteResponse.tag` 正确。
  - 标签为空、AI 不可用 → 落到"未分类"目录。
  - 标题为空 → 文件名为 `未命名笔记.md`。
  - 同目录同名文件已存在 → 写入 `标题-2.md`。
- `NoteAiServiceTest`：新增 `suggestSingleTag` 的 AI 可用/不可用/解析失败三种场景测试；`capTags` 上限改为 1 的相关断言更新。

---

## 2. AI 标签整理（新增接口）

### DTO

`backend/src/main/java/com/nexus/dto/request/NoteReorganizeRequest.java`：

```java
package com.nexus.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/** 笔记标签整理请求：对指定 kind 下所有笔记重新评估标签并归位。 */
@Data
public class NoteReorganizeRequest {
    @NotBlank(message = "kind 不能为空")
    private String kind;
}
```

`backend/src/main/java/com/nexus/dto/response/NoteReorganizeResponse.java`：

```java
package com.nexus.dto.response;

import lombok.Data;

import java.util.List;

/** 笔记标签整理结果。 */
@Data
public class NoteReorganizeResponse {
    /** 本次扫描到的笔记总数 */
    private int scannedCount;
    /** 标签发生变化并已移动的笔记列表 */
    private List<NoteReorganizeChange> changes;
    /** AI 不可用时为 true，此时不执行任何变更，changes 为空 */
    private boolean aiUnavailable;

    @Data
    public static class NoteReorganizeChange {
        private String title;
        private String oldTag;
        private String newTag;
        /** 相对 Vault 的旧路径 */
        private String oldPath;
        /** 相对 Vault 的新路径 */
        private String newPath;
    }
}
```

### `NoteTagReorganizeService`（新增）

```java
package com.nexus.service;
```

职责：
- `isInboxAiAvailable()` 为 false → 直接返回 `{ scannedCount: 0, changes: [], aiUnavailable: true }`，不扫描文件。
- 扫描 `{vaultRoot}/{noteDir}`（`noteDir` 同 `NoteSummaryService` 中按 `kind` 选择 `getObsidianQuickNoteDir()` / `getObsidianMemoDir()`）下所有 `.md` 文件（递归，复用 `Files.walk`）。
- 对每个文件：
  - 读取内容，解析 front matter 中的 `tags`（取第一个，若没有则视为无标签）与正文首个 `# ` 标题（同 `NoteSummaryService.extractTitleFromContent`）。
  - 调用 `noteAiService.suggestSingleTag(正文内容, kind)`，结合标签索引得到 `newTag`。
  - 若 `newTag` 与当前 `oldTag` 不同（大小写敏感比较；`oldTag` 为空也视为不同）：
    - 计算新路径：`{noteDir}/{newTag}/{文件名}.md`，文件名沿用原文件的基础名（不重新从标题派生，避免与第 1 节的命名规则产生歧义）；目标目录下若已存在同名文件，追加 `-2`/`-3` 避免覆盖。
    - 更新该文件 front matter 的 `tags:` 为 `[newTag]`，并 `Files.move` 到新路径（必要时 `Files.createDirectories`）。
    - 若 `newTag` 是新标签（`suggestSingleTag` 返回 `description != null`），收集后统一 `syncNewTags`。
    - 记录一条 `NoteReorganizeChange`。
- 返回 `scannedCount` 和 `changes` 列表。

### Controller

`InboxController` 新增：

```java
/** AI 重新评估并归位指定类型下所有笔记的标签（手动触发，立即执行） */
@PostMapping("/notes/reorganize-tags")
public ApiResponse<NoteReorganizeResponse> reorganizeNoteTags(@Valid @RequestBody NoteReorganizeRequest req) {
    try {
        return ApiResponse.ok(noteTagReorganizeService.reorganize(req));
    } catch (Exception e) {
        log.error("笔记标签整理失败", e);
        return ApiResponse.error("NOTE_REORGANIZE_FAILED", "标签整理失败");
    }
}
```

### 测试

`NoteTagReorganizeServiceTest`：
- AI 不可用 → 返回 `aiUnavailable=true`，`changes` 为空，不修改任何文件。
- 标签不变 → `changes` 为空。
- 标签变化 → 文件被移动到新目录、front matter 更新、`changes` 含正确的 old/new path。
- 文件名冲突 → 追加序号。

`InboxControllerTest`：新增 `/inbox/notes/reorganize-tags` 基本用例（成功、AI 不可用）。

---

## 3. 前端：单标签选择 + 自动打标签反馈

- `NoteComposer.tsx`：`<TagPicker maxTags={1} .../>`，标签区说明文案改为"标签（最多 1 个，留空时 AI 自动打标签）"。
- `useNoteSection.ts`：
  - `onApplySuggestion` 中 `aiResult.suggestedTags.slice(0, 3)` → `.slice(0, 1)`。
  - 保存成功后（`saveMutation.onSuccess`），若 `result.tag` 存在，把它合入 `selectedTags`（覆盖为 `[result.tag]`），让用户看到本次实际写入的标签；同时若该标签不在 `availableTags` 中，临时加入 `pendingNewTags`（复用现有机制），随后 `invalidateQueries` 会刷新真实索引。
  - 新增"标签整理"相关状态与 mutation（见第 4 节）。
- `types/domain.types.ts`：
  - `QuickNoteResponse` 新增 `tag?: string`。
  - 新增 `NoteReorganizeRequest { kind: 'quick_note' | 'memo' }`、`NoteReorganizeChange { title: string; oldTag: string; newTag: string; oldPath: string; newPath: string }`、`NoteReorganizeResponse { scannedCount: number; changes: NoteReorganizeChange[]; aiUnavailable: boolean }`。
- `inbox.api.ts`：新增

```typescript
/** 手动触发：AI 重新评估并归位指定类型下所有笔记的标签 */
reorganizeTags: (data: NoteReorganizeRequest) =>
  apiClient.post<ApiResponse<NoteReorganizeResponse>>('/inbox/notes/reorganize-tags', data),
```

---

## 4. 前端：汇总 Markdown 渲染 + 标签整理入口

### `NoteSummaryPanel.tsx`

- 引入 `react-markdown`（已在 `package.json` 依赖中，项目内首次使用），将结果区的

```tsx
<div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-foreground whitespace-pre-wrap font-mono max-h-64 overflow-y-auto">
  {result.markdown}
</div>
```

改为用 `<ReactMarkdown>{result.markdown}</ReactMarkdown>` 渲染，外层容器保留 `rounded-md border bg-muted/30 px-3 py-2 max-h-64 overflow-y-auto`，并补充 `prose prose-sm dark:prose-invert max-w-none`（若项目未启用 `@tailwindcss/typography`，改用手写的最小化样式：给容器加 `text-xs text-foreground [&_h1]:text-sm [&_h1]:font-bold [&_h2]:text-sm [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:pl-4 [&_li]:my-0.5 [&_p]:my-1` 等，实现前先检查 `tailwind.config` 是否已有 `typography` 插件，按实际情况选择）。
- 复制按钮逻辑不变（复制 `result.markdown` 原始字符串）。
- 新增 Props：

```typescript
onReorganize: () => void
isReorganizing: boolean
reorganizeResult: NoteReorganizeResponse | null
```

- 在标题旁新增"整理标签"按钮（图标可用 `lucide-react` 的 `Wand2` 或 `ArrowDownUp`），点击调用 `onReorganize`；`isReorganizing` 时显示 loading。
- `reorganizeResult` 展示：
  - `aiUnavailable` → 提示"AI 未启用，无法整理标签"。
  - `changes.length === 0` → 提示"共扫描 N 篇笔记，无需调整"。
  - 否则列出每条 `{title}: {oldTag || '无标签'} → {newTag}`（简单列表即可）。

### `useNoteSection.ts`

```typescript
const [reorganizeResult, setReorganizeResult] = useState<NoteReorganizeResponse | null>(null)
const reorganizeMutation = useMutation({
  mutationFn: () => inboxApi.notes.reorganizeTags({ kind }),
  onSuccess: (res) => {
    const result = res.data?.data
    if (result) setReorganizeResult(result)
    // 标签可能新增/变化，刷新标签索引和汇总相关查询
    qc.invalidateQueries({ queryKey: ['inbox', 'notes', 'tags', kind] })
  },
})
const onReorganize = () => { setReorganizeResult(null); reorganizeMutation.mutate() }
```

返回值新增 `onReorganize`、`isReorganizing: reorganizeMutation.isPending`、`reorganizeResult`。

### `InboxDesktopView.tsx` / `InboxMobileView.tsx`

- `<NoteSummaryPanel>` 新增传入 `onReorganize={ns.onReorganize}`、`isReorganizing={ns.isReorganizing}`、`reorganizeResult={ns.reorganizeResult}`。

---

## 风险与边界情况

- "标签整理"对每篇笔记单独调用 LLM，笔记数量较多时耗时较长——本版本不做分页/进度展示，作为已知限制；按钮 loading 期间禁用重复点击。
- 文件移动若中途失败（如权限问题），已处理的笔记保持已移动状态，未处理的保持原状——不做整体事务回滚，记录 warning 日志，作为已知限制。
- "未分类"作为默认标签名是固定字符串；若用户的标签索引中已有同名标签，直接复用，不重复写入索引说明。
