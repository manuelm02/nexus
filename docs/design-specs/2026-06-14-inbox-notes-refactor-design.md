# Inbox 笔记页面重构设计：速记 / 备忘录拆分 + 标签索引 + AI 汇总

## 背景与目标

当前 Inbox「笔记」Tab 是一个统一的 Quick Note / Memo 编辑器（`NoteComposer` + `NoteAiSuggestionPanel`），用户手动切换 kind、手动输入标签，标签会无序增长。同时后端存在一套未在前端接入的"合并笔记到 Obsidian"接口（`/notes/consolidate/preview`、`/notes/consolidate/write`）。

本次重构目标：

1. 将「笔记」拆分为「速记」（Quick Note）和「备忘录」（Memo）两个二级页面，结构对称。
2. 每个页面提供录入区：标题 + 内容 + AI 整理（含标签建议）+ 保存。
3. 为速记、备忘录各维护一份标签索引文件，AI 打标签时优先复用索引中的标签，新建标签需写回索引；单篇笔记标签数 ≤ 3。
4. 每个页面提供"汇总"功能：按标题关键词 + 标签多选检索笔记，AI 生成 Markdown 汇总，前端展示并提供复制按钮（不写文件）。
5. 清理未使用的设计：`QuickNotePanel.tsx`、consolidate 系列接口/DTO/类型、Settings 中过时的"Consolidated"目录展示。

## 1. 导航与页面结构

- `INBOX_TABS` 中的「笔记」主 Tab 保持不变（顶层仍是 书签/文档/笔记 三个 Tab）。
- 「笔记」内部新增二级 Tab："速记" / "备忘录"，复用 `InboxSettingsPanel` 中 inner-tab 的视觉模式（`grid` + 选中态高亮）。
- 两个二级页面结构完全对称，由同一组组件渲染，仅 `kind` 不同（`quick_note` / `memo`）：
  - **录入区**（沿用 `NoteComposer` 改造版）：标题输入（含模板）、内容文本域、AI 整理按钮、标签选择器（`TagPicker`，见第 4 节）、保存按钮、清空按钮。移除原有的 quick_note/memo 切换分段控件（kind 已由二级 Tab 固定）。
  - **AI 建议区**（`NoteAiSuggestionPanel`，保留现有展示逻辑：建议标题/标签/分类/清洗预览/行动项/合并到当前笔记）。
  - **汇总区**（新组件 `NoteSummaryPanel`，见第 5 节）：标题关键词输入 + 标签多选 + 生成汇总按钮 + Markdown 结果只读区 + 复制按钮。

- `frontend/src/pages/Inbox/index.tsx` 新增 `useNoteSection(kind: 'quick_note' | 'memo')` hook，封装：
  - 草稿状态：title/content/selectedTags
  - AI 分析 mutation（analyze）与建议应用逻辑（含现有 `mergeNoteContent`）
  - 保存 mutation（create）
  - 标签索引查询（tags list for TagPicker）
  - 汇总查询状态（titleQuery、selectedSummaryTags）与 summarize mutation

  在 `index.tsx` 中分别调用两次（`quick_note` / `memo`），向桌面/移动视图传 `quickNoteProps` / `memoProps`，移除原先单一的 `noteProps`（含 `noteKind` 切换相关字段）。

## 2. 标签索引文件

### 存储位置

```
{Vault}/{InboxDir}/tags/quick-note-tags.md
{Vault}/{InboxDir}/tags/memo-tags.md
```

`InboxSettingsService` 新增：
- `getObsidianTagsDir()` → `resolveChildDir(inboxRootDir, "tags")`
- `getQuickNoteTagIndexPath()` / `getMemoTagIndexPath()`

### 文件格式

Markdown 无序列表，每行一个标签 + 简要范围说明：

```markdown
# Quick Note 标签索引

- 技术: 编程、工具链、技术学习相关内容
- 生活: 日常生活、习惯、健康相关
- 想法: 待孵化的点子和灵感
```

### `NoteTagIndexService`（新增）

职责：读取/写入标签索引文件，供 AI 分析时引用、供前端 TagPicker 拉取、供保存笔记时写回新标签。

- `List<TagEntry> listTags(String kind)`：读取并解析索引文件，文件不存在时返回空列表。`TagEntry { name, description }`。
- `void syncNewTags(String kind, Map<String, String> newTagDescriptions)`：将索引中不存在的标签按 `name: description` 追加写入文件末尾；已存在的标签跳过（不更新已有说明，避免并发写入覆盖人工/历史信息）。
- 路径校验复用现有 vault 范围校验逻辑（防路径穿越）。

## 3. AI 标签流程（analyze 改造）

`NoteAiService.analyze(NoteAnalyzeRequest req)` 改动：

1. 调用前先通过 `NoteTagIndexService.listTags(req.getKind())` 读取当前 kind 的标签索引。
2. Prompt 中追加"已有标签索引"列表（`name: description`），并明确要求：
   - 优先从已有标签中选择语义匹配的标签；
   - 全部标签数量（包含复用 + 新建）不超过 3 个；
   - 若确有必要新建标签，需在响应中通过 `new_tags` 字段给出 `{name, description}`，description 用一句话概括该标签的适用范围。
3. 响应解析新增 `newTagDescriptions: Map<String,String>`（仅包含本次新建、且不在现有索引中的标签）。`suggestedTags` 仍按现有逻辑解析，但限制最终数量 ≤ 3（截断多余项）。

`NoteAnalyzeResponse` 新增字段：
```java
/** AI 新建标签的范围说明，key 为标签名；仅包含索引中尚不存在的标签 */
private Map<String, String> newTagDescriptions;
```

LLM 不可用时降级：`newTagDescriptions` 为空 map，`suggestedTags` 回退为 `req.getTags()`（不超过 3 个）。

## 4. 标签选择 UI（TagPicker）

新增前端组件 `frontend/src/pages/Inbox/components/notes/TagPicker.tsx`：

- Props：`kind`、`availableTags: TagEntry[]`（来自新接口）、`selectedTags: string[]`、`onChange(tags: string[])`、`maxTags = 3`。
- 渲染：从索引拉取的标签以可勾选 chip 列表展示（无输入框）。勾选数达到 3 时，其余 chip 置为 disabled。
- 不提供文本输入新增标签的入口——新标签只能通过 AI 分析响应中的 `newTagDescriptions` 出现（应用 AI 建议后，前端把这些新标签临时加入 `availableTags` 本地列表，使其在 TagPicker 中可见/可勾选；真正写入索引文件发生在保存笔记时）。

`NoteComposer` 改动：
- 移除现有自由文本标签输入框（`tagInput` + Plus 按钮 + 标签 chip 自带删除按钮）。
- 用 `TagPicker` 替换标签展示区，`selectedTags` 由 `useNoteSection` 管理。
- 应用 AI 建议（`onApplySuggestion`）时，把 `suggestedTags` 设为 `selectedTags`（截断至 3），并将 `newTagDescriptions` 暂存于 hook state，随保存请求一起提交。
- 类型切换分段控件整体移除。

## 5. 标签索引接口 & 标签写回

### 新增接口：`GET /inbox/notes/tags?kind=quick_note|memo`

返回 `List<TagEntry>`（`{ name, description }`），供前端 `TagPicker` 拉取可选标签列表。

### `QuickNoteRequest` 新增字段

```java
/** AI 本次分析新建的标签说明（仅在 tags 含新标签时提供），保存时写回标签索引 */
private Map<String, String> newTagDescriptions;
```

### `ObsidianMarkdownWriter.write()` 改动

写入笔记文件后，若 `req.getTags()` 非空，调用：
```java
noteTagIndexService.syncNewTags(req.getKind(), req.getNewTagDescriptions());
```
（`newTagDescriptions` 为 null 时传空 map，`syncNewTags` 内部按"索引中不存在则写入"处理；若某个 `tags` 中的标签既不在索引也没有 description，记录 warning 但不中断保存——属于异常路径，正常 AI 流程不会出现。）

## 6. 汇总功能

### 新增接口：`POST /inbox/notes/summarize`

请求 `NoteSummarizeRequest`：
```java
private String kind;          // quick_note | memo，必填
private String titleQuery;    // 标题关键词，可选
private List<String> tags;    // 选中的标签，可选
```

筛选逻辑（扫描对应 kind 目录下所有 `.md` 文件，解析 front matter 的 `tags` 与正文首个 `# ` 标题）：
- `titleQuery` 和 `tags` 均为空 → 不扫描，直接返回空结果（`matchedCount = 0`，`markdown = null`），前端据此禁用"生成汇总"按钮。
- 仅 `titleQuery` 非空 → 标题包含关键词（忽略大小写）。
- 仅 `tags` 非空 → 笔记标签与选中标签有交集。
- 两者都非空 → 同时满足（交集）。

匹配到笔记后，读取正文（去除 front matter），调用 LLM 生成汇总 Markdown（复用现有 `NoteConsolidationService` 中 prompt 构建与 JSON 提取逻辑，新方法命名为 `summarize`）；LLM 不可用时降级为简单拼接（保留现有 `buildFallbackMarkdown` 逻辑，去掉 `mode/topic` 相关参数，改为按匹配到的笔记顺序拼接）。

响应 `NoteSummarizeResponse`：
```java
private String markdown;       // 汇总后的 Markdown，可能为 null（无匹配）
private int matchedCount;      // 匹配到的笔记数量
```

不写入任何文件。

### 前端 `NoteSummaryPanel`

- 标题关键词输入框 + `TagPicker`（复用同一标签索引接口，多选不限 3 个——汇总场景的标签选择与笔记标签上限是两个不同语义，需在组件层面区分：`TagPicker` 增加 `maxTags?: number`，汇总场景不传即不限制）。
- "生成汇总"按钮：两项均为空时禁用。
- 结果区：只读 Markdown 文本块 + 复制按钮（`navigator.clipboard.writeText`），复制成功有短暂提示（参考现有 toast/反馈模式）。
- `matchedCount === 0` 时展示"未找到匹配笔记"提示。

## 7. 清理项

### 前端

- 删除 `frontend/src/pages/Inbox/components/QuickNotePanel.tsx`（未被引用的死代码）。
- `frontend/src/api/inbox.api.ts`：删除 `consolidatePreview`、`consolidateWrite`，新增 `tags(kind)`、`summarize(data)`。
- `frontend/src/types/domain.types.ts`：删除 `NoteConsolidatePreviewRequest/Response`、`NoteConsolidateWriteRequest`；新增 `TagEntry`、`NoteSummarizeRequest/Response`；`NoteAnalyzeResponse` 增加 `newTagDescriptions`。
- `NoteComposer.tsx`：移除 kind 切换分段控件、自由文本标签输入；接入 `TagPicker`。

### 后端

- 删除 `NoteConsolidatePreviewRequest`、`NoteConsolidatePreviewResponse`、`NoteConsolidateWriteRequest` DTO。
- `NoteConsolidationService`：删除 `write()`、`buildConsolidatedMarkdown()`、`generateSuggestedPath()`、路径相关常量；保留并改造 `readSourceNotes`（改为按目录扫描而非显式路径列表）、`buildFallbackMarkdown`（去除 mode/topic）、JSON 提取工具方法；新增 `summarize()`。是否重命名为 `NoteSummaryService` 由实现时按改动幅度决定（若改动后职责清晰则重命名，否则保留类名）。
- `InboxController`：删除 `/notes/consolidate/preview`、`/notes/consolidate/write`；新增 `GET /notes/tags`、`POST /notes/summarize`。
- `InboxSettingsService`：删除 `CONSOLIDATED_DIR`、`getObsidianConsolidationDir()`；新增 `getObsidianTagsDir()` 及标签索引文件路径方法。`InboxSettingsResponse` 删除 `obsidianConsolidationDir` 字段。

### Settings 前端

- `InboxSettingsPanel.tsx` 的 `ObsidianSettingsCard`："系统目录"展示列表由 `Quick Note / Memo / Consolidated` 改为 `Quick Note / Memo / tags`。

## 8. 测试

- 后端：`InboxControllerTest` 移除 consolidate 相关用例，新增 `/notes/tags`、`/notes/summarize` 的基本用例（含 LLM 不可用降级、空筛选条件返回空结果）。
- `NoteTagIndexService` 单元测试：索引文件不存在时返回空列表；`syncNewTags` 去重追加；解析格式异常行时容错跳过。
- 前端：`pnpm build` 通过；手动验收速记/备忘录两页面的录入、AI 整理、标签选择（≤3）、汇总检索 + 复制。

## 9. 风险与边界情况

- 标签索引文件被外部（Obsidian）手动编辑导致格式不规范：`NoteTagIndexService` 解析时跳过无法识别的行，不报错。
- 用户在禁用 AI 的情况下保存笔记：`TagPicker` 仍可从已有索引中选择标签（不新建），`newTagDescriptions` 为空。
- 汇总扫描的笔记数量较大时可能导致 prompt 过长：本版本不做分页/截断处理，作为已知限制记录，后续如遇到问题再优化。
