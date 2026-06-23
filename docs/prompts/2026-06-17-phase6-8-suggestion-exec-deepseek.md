# Phase 6-8 — 巡检建议自动执行提示词

执行计划：`docs/superpowers/plans/2026-06-17-mindbank-crawl-phase6.md`（Phase 6.9 节）  
架构设计：`docs/nexus-mindbank-pipeline-agent-design.md`（第 6.3 节 Agent B 巡检）  
前置：Phase 6-1~6-7 均已完成。Agent B 巡检可产出建议，Agent A/C 已接入，采纳按钮目前只改状态标记

---

你正在开发 Nexus 项目（路径：`/Users/manuelm/Workspace/Projects/Nexus/nexus`），Spring Boot 3.x 后端 + React 18 + TypeScript 前端。请先阅读 `CLAUDE.md` 和 `AGENTS.md`，再阅读计划文档 Phase 6.9 节。

本阶段目标：让 Agent B 巡检建议的"采纳"按钮**真正触发自动执行**——拆分 Workspace、合并笔记、修正索引等。

**架构关键**：建议采纳后的执行是**确定性操作**（不需要 Agent 判断），用普通 Service 方法实现，通过 Port 接口操作外部系统。所有操作**不自动删除源数据**，只创建/归档，用户手动确认后才真正删除。

---

## 第一步：SuggestionExecutor 服务

创建 `backend/src/main/java/com/nexus/service/MindBankSuggestionExecutor.java`：

```java
/**
 * 执行用户采纳的巡检建议。
 * 每种 suggestion_type 对应一个确定性执行方法，通过 Port 接口完成所有操作。
 *
 * 安全原则：
 * - 所有操作通过 Port 接口，不直接操作文件系统
 * - 不自动删除源 Workspace 或源笔记，只标记/归档
 * - LLM 调用失败时回滚已创建的资源
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MindBankSuggestionExecutor {

    private final NotePort notePort;
    private final KnowledgeBasePort knowledgeBasePort;
    private final StoragePort storagePort;
    private final MindBankWorkspaceService workspaceService;
    private final MindBankWorkspaceMapper workspaceMapper;
    private final MindBankDocumentMapper documentMapper;
    private final LlmConfigService llmConfigService;
    private final SystemConfigService systemConfigService;
    private final ObjectMapper objectMapper;

    /**
     * 根据建议类型分发执行。
     * @return 执行结果描述（展示在前端）
     */
    public String execute(MindBankAgentSuggestion suggestion) {
        String type = suggestion.getSuggestionType();
        log.info("执行巡检建议 id={} type={}", suggestion.getId(), type);

        return switch (type) {
            case "split_note" -> executeSplitNote(suggestion);
            case "merge_workspace" -> executeMergeWorkspace(suggestion);
            case "resplit_workspace" -> executeResplitWorkspace(suggestion);
            case "fix_index" -> executeFixIndex(suggestion);
            case "orphan_note" -> executeOrphanNote(suggestion);
            default -> throw new IllegalArgumentException("未知建议类型：" + type);
        };
    }
}
```

## 第二步：split_note — 拆分过长 Master Note

```java
/**
 * 拆分过长的 Master Note：用 LLM 按主题拆分，为每份创建新 Workspace + 笔记 + embedding。
 * 源 Workspace 保留不删除，用户确认后手动删除。
 */
private String executeSplitNote(MindBankAgentSuggestion suggestion) {
    // 1. 解析 proposed_action
    Map<String, Object> action = parseProposedAction(suggestion);
    String sourceWorkspaceName = getAffectedWorkspaceName(suggestion, 0);

    // 2. 读取源 Master Note
    String masterContent = notePort.readMaster(sourceWorkspaceName);
    if (masterContent == null || masterContent.isBlank()) {
        return "源 Workspace「" + sourceWorkspaceName + "」无 Master Note，跳过";
    }

    // 3. 用 LLM 拆分内容
    ChatLanguageModel model = llmConfigService.resolveModel("mindbank_organize");
    if (model == null) throw new IllegalStateException("请先配置 mindbank_organize 模型");

    String splitPrompt = """
        将以下知识笔记按主题拆分为多份独立的知识笔记。
        每份应围绕一个独立的主题，内容完整可独立阅读。

        输出 JSON 格式：
        [
          {"title": "主题名称", "content": "完整笔记内容（Markdown）"},
          ...
        ]

        原始笔记：

        """ + masterContent;

    String splitResult = model.generate(splitPrompt);

    // 4. 解析 JSON
    List<Map<String, String>> parts = parseSplitResult(splitResult);
    if (parts.isEmpty() || parts.size() < 2) {
        return "LLM 未能将笔记拆分为多个主题，请检查笔记内容或手动拆分";
    }

    // 5. 为每份创建新 Workspace + 写笔记 + embedding
    String subFolder = systemConfigService.get("notes.obsidian.sub_folder", "Mindbank");
    List<String> createdNames = new ArrayList<>();

    for (Map<String, String> part : parts) {
        String newName = part.get("title");
        String newContent = part.get("content");

        try {
            // 创建 Workspace
            CreateWorkspaceRequest req = new CreateWorkspaceRequest();
            req.setName(newName);
            req.setDomainTag(getSourceDomainTag(sourceWorkspaceName));
            req.setDescription("从「" + sourceWorkspaceName + "」拆分");
            MindBankWorkspace newWorkspace = workspaceService.create(req);

            // 写 Master Note
            notePort.writeMaster(newName, subFolder, newContent);

            // 更新 DB
            String vaultRoot = systemConfigService.get("notes.obsidian.vault_path");
            String safeName = newName.replaceAll("[/\\\\:*?\"<>|]", "_");
            newWorkspace.setMasterNotePath(vaultRoot + "/" + subFolder + "/" + safeName + "__master.md");
            workspaceMapper.updateById(newWorkspace);

            // 创建 embedding
            if (newWorkspace.getAnythingllmSlug() != null) {
                try {
                    String docId = knowledgeBasePort.uploadDocument(
                        newWorkspace.getAnythingllmSlug(), newContent, newName + "_master.md");
                    newWorkspace.setAnythingllmDocId(docId);
                    workspaceMapper.updateById(newWorkspace);
                } catch (Exception e) {
                    log.warn("新 Workspace「{}」embedding 创建失败：{}", newName, e.getMessage());
                }
            }

            createdNames.add(newName);
        } catch (Exception e) {
            log.error("拆分创建 Workspace「{}」失败：{}", newName, e.getMessage());
        }
    }

    if (createdNames.isEmpty()) {
        throw new RuntimeException("所有拆分子项创建失败");
    }

    return String.format("已从「%s」拆分为 %d 个新 Workspace：%s。源 Workspace 保留，请确认无误后手动删除。",
        sourceWorkspaceName, createdNames.size(), String.join("、", createdNames));
}
```

## 第三步：merge_workspace — 合并重叠 Workspace

```java
/**
 * 合并内容重叠的 Workspace：用 LLM 合并多份 Master Note，迁移文档记录。
 * 源 Workspace 保留不删除。
 */
private String executeMergeWorkspace(MindBankAgentSuggestion suggestion) {
    // 1. 解析 affected 列表（要合并的 Workspace 名称）
    List<String> workspaceNames = parseAffectedNotes(suggestion);
    if (workspaceNames.size() < 2) {
        return "合并至少需要 2 个 Workspace";
    }

    // 2. 读取所有 Master Note
    Map<String, String> masterNotes = new LinkedHashMap<>();
    for (String name : workspaceNames) {
        String content = notePort.readMaster(name);
        if (content != null && !content.isBlank()) {
            masterNotes.put(name, content);
        }
    }

    if (masterNotes.isEmpty()) {
        return "所有待合并 Workspace 均无 Master Note";
    }

    // 3. 用 LLM 合并
    ChatLanguageModel model = llmConfigService.resolveModel("mindbank_organize");
    StringBuilder mergeInput = new StringBuilder();
    for (var entry : masterNotes.entrySet()) {
        mergeInput.append("## 来自「").append(entry.getKey()).append("」\n\n")
            .append(entry.getValue()).append("\n\n---\n\n");
    }

    String mergePrompt = """
        将以下多份知识笔记合并为一份完整的知识笔记。
        要求：消除重复内容，保留所有独特的知识点，章节结构清晰连贯。

        """ + mergeInput;

    String mergedContent = model.generate(mergePrompt);

    // 4. 确定目标 Workspace（使用第一个，或从 proposed_action 解析目标名称）
    String targetName = workspaceNames.get(0);
    Map<String, Object> action = parseProposedAction(suggestion);
    if (action.containsKey("targetName")) {
        targetName = (String) action.get("targetName");
    }

    // 5. 写入合并后 Master Note
    String subFolder = systemConfigService.get("notes.obsidian.sub_folder", "Mindbank");
    notePort.writeMaster(targetName, subFolder, mergedContent);

    // 6. 更新目标 Workspace 的 masterNotePath 和 embedding
    MindBankWorkspace targetWorkspace = findWorkspaceByName(targetName);
    if (targetWorkspace != null) {
        String vaultRoot = systemConfigService.get("notes.obsidian.vault_path");
        String safeName = targetName.replaceAll("[/\\\\:*?\"<>|]", "_");
        targetWorkspace.setMasterNotePath(vaultRoot + "/" + subFolder + "/" + safeName + "__master.md");
        workspaceMapper.updateById(targetWorkspace);

        // 更新 embedding
        if (targetWorkspace.getAnythingllmSlug() != null) {
            try {
                if (targetWorkspace.getAnythingllmDocId() != null) {
                    knowledgeBasePort.deleteDocument(targetWorkspace.getAnythingllmSlug(),
                        targetWorkspace.getAnythingllmDocId());
                }
                String docId = knowledgeBasePort.uploadDocument(
                    targetWorkspace.getAnythingllmSlug(), mergedContent, targetName + "_master.md");
                targetWorkspace.setAnythingllmDocId(docId);
                workspaceMapper.updateById(targetWorkspace);
            } catch (Exception e) {
                log.warn("合并后 embedding 更新失败：{}", e.getMessage());
            }
        }

        // 7. 迁移其他 Workspace 的文档记录到目标
        for (String name : workspaceNames) {
            if (!name.equals(targetName)) {
                MindBankWorkspace source = findWorkspaceByName(name);
                if (source != null) {
                    documentMapper.update(null,
                        new LambdaUpdateWrapper<MindBankDocument>()
                            .eq(MindBankDocument::getWorkspaceId, source.getId())
                            .set(MindBankDocument::getWorkspaceId, targetWorkspace.getId()));
                }
            }
        }
    }

    return String.format("已将 %s 合并至「%s」。源 Workspace 保留，请确认无误后手动删除其他 Workspace。",
        String.join("、", workspaceNames), targetName);
}
```

## 第四步：fix_index — 修正知识索引

```java
/**
 * 修正 _index.md：移除指向不存在文件的条目，补充未被索引的 Master Note。
 */
private String executeFixIndex(MindBankAgentSuggestion suggestion) {
    String subFolder = systemConfigService.get("notes.obsidian.sub_folder", "Mindbank");

    // 1. 读取现有索引
    String currentIndex = notePort.readIndex(subFolder);

    // 2. 获取实际存在的 Master Note 文件列表
    List<NoteMeta> allNotes = notePort.listNotes();
    Set<String> existingMasterPaths = allNotes.stream()
        .filter(n -> n.name().endsWith("__master.md"))
        .map(NoteMeta::path)
        .collect(Collectors.toSet());

    // 3. 解析索引中的条目，移除无效的
    String[] lines = currentIndex.split("\n");
    List<String> validLines = new ArrayList<>();
    int removedCount = 0;

    for (String line : lines) {
        if (line.startsWith("- [") && line.contains("](")) {
            // 提取路径
            int start = line.indexOf("](") + 2;
            int end = line.indexOf(")", start);
            if (end > start) {
                String path = line.substring(start, end);
                if (!existingMasterPaths.stream().anyMatch(p -> p.contains(path))) {
                    removedCount++;
                    continue; // 跳过无效条目
                }
            }
        }
        validLines.add(line);
    }

    // 4. 补充未索引的 Master Note
    int addedCount = 0;
    Set<String> indexedPaths = new HashSet<>();
    for (String line : validLines) {
        if (line.contains("](")) {
            int start = line.indexOf("](") + 2;
            int end = line.indexOf(")", start);
            if (end > start) indexedPaths.add(line.substring(start, end));
        }
    }

    for (String masterPath : existingMasterPaths) {
        boolean isIndexed = indexedPaths.stream().anyMatch(masterPath::contains);
        if (!isIndexed) {
            String fileName = Path.of(masterPath).getFileName().toString();
            String workspaceName = fileName.replace("__master.md", "").replace("_", " ");
            validLines.add(String.format("- [%s](%s) — 自动补充", workspaceName, masterPath));
            addedCount++;
        }
    }

    // 5. 覆盖写入修正后的索引
    // 使用 NotePort 写入完整索引（需要新增 writeIndex 方法或用 appendIndex 重建）
    String newIndex = String.join("\n", validLines);
    // 此处需要一个 writeIndex 方法覆盖写入；若 NotePort 只有 appendIndex，
    // 则先清空再 append，或在 NotePort 中新增 writeIndex 方法
    writeFullIndex(subFolder, newIndex);

    return String.format("索引修正完成：移除 %d 个无效条目，补充 %d 个新条目", removedCount, addedCount);
}

/** 覆盖写入完整索引（若 NotePort 无 writeIndex 方法，直接通过文件操作） */
private void writeFullIndex(String subFolder, String content) {
    // 优先使用 NotePort 方法；若不支持覆盖写入，通过 SystemConfigService 获取 vault 路径后直接写
    String vaultRoot = systemConfigService.get("notes.obsidian.vault_path");
    Path indexPath = Path.of(vaultRoot, subFolder, "_index.md");
    try {
        Files.writeString(indexPath, content, StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
    } catch (IOException e) {
        throw new RuntimeException("写入索引失败：" + e.getMessage(), e);
    }
}
```

## 第五步：orphan_note — 处理孤立笔记

```java
/**
 * 处理孤立笔记：根据建议归档到 _archive 目录。
 * 不自动删除，只移动到归档目录。
 */
private String executeOrphanNote(MindBankAgentSuggestion suggestion) {
    List<String> notePaths = parseAffectedNotes(suggestion);
    String vaultRoot = systemConfigService.get("notes.obsidian.vault_path");
    Path archiveDir = Path.of(vaultRoot, "_archive");

    int archivedCount = 0;
    for (String notePath : notePaths) {
        try {
            Path source = Path.of(vaultRoot, notePath);
            if (!Files.exists(source)) {
                log.warn("孤立笔记不存在，跳过：{}", notePath);
                continue;
            }
            Files.createDirectories(archiveDir);
            Path target = archiveDir.resolve(source.getFileName());
            // 处理文件名冲突
            int suffix = 2;
            while (Files.exists(target)) {
                String name = source.getFileName().toString();
                int dot = name.lastIndexOf('.');
                target = archiveDir.resolve(
                    name.substring(0, dot) + "-" + suffix + name.substring(dot));
                suffix++;
            }
            Files.move(source, target);
            archivedCount++;
        } catch (IOException e) {
            log.error("归档笔记失败 {}：{}", notePath, e.getMessage());
        }
    }

    return String.format("已归档 %d 篇孤立笔记至 _archive 目录", archivedCount);
}
```

## 第六步：resplit_workspace — 重新切分

```java
/**
 * 重新切分内容过杂的 Workspace，逻辑与 split_note 基本一致。
 */
private String executeResplitWorkspace(MindBankAgentSuggestion suggestion) {
    // 复用 executeSplitNote 的逻辑
    return executeSplitNote(suggestion);
}
```

## 第七步：辅助方法

```java
@SuppressWarnings("unchecked")
private Map<String, Object> parseProposedAction(MindBankAgentSuggestion suggestion) {
    try {
        return objectMapper.readValue(suggestion.getProposedAction(), Map.class);
    } catch (Exception e) {
        return Map.of();
    }
}

@SuppressWarnings("unchecked")
private List<String> parseAffectedNotes(MindBankAgentSuggestion suggestion) {
    try {
        return objectMapper.readValue(suggestion.getAffectedNotes(), List.class);
    } catch (Exception e) {
        return List.of();
    }
}

private String getAffectedWorkspaceName(MindBankAgentSuggestion suggestion, int index) {
    List<String> affected = parseAffectedNotes(suggestion);
    return index < affected.size() ? affected.get(index) : "";
}

private String getSourceDomainTag(String workspaceName) {
    MindBankWorkspace ws = findWorkspaceByName(workspaceName);
    return ws != null ? ws.getDomainTag() : null;
}

private MindBankWorkspace findWorkspaceByName(String name) {
    return workspaceMapper.selectOne(
        new LambdaQueryWrapper<MindBankWorkspace>().eq(MindBankWorkspace::getName, name));
}

@SuppressWarnings("unchecked")
private List<Map<String, String>> parseSplitResult(String llmOutput) {
    try {
        String json = llmOutput;
        int start = llmOutput.indexOf('[');
        int end = llmOutput.lastIndexOf(']');
        if (start >= 0 && end > start) json = llmOutput.substring(start, end + 1);
        return objectMapper.readValue(json, new TypeReference<>() {});
    } catch (Exception e) {
        log.warn("解析拆分结果失败：{}", e.getMessage());
        return List.of();
    }
}
```

## 第八步：Controller 升级

修改 `MindBankAgentController.approveSuggestion`：

```java
@PostMapping("/suggestions/{id}/approve")
public ApiResponse<SuggestionExecuteResult> approveSuggestion(@PathVariable Long id) {
    MindBankAgentSuggestion suggestion = suggestionMapper.selectById(id);
    if (suggestion == null) return ApiResponse.error("建议不存在");
    if (!"pending".equals(suggestion.getStatus())) {
        return ApiResponse.error("该建议已被处理");
    }

    try {
        String result = suggestionExecutor.execute(suggestion);
        suggestion.setStatus("accepted");
        suggestionMapper.updateById(suggestion);
        return ApiResponse.ok(new SuggestionExecuteResult(true, result));
    } catch (Exception e) {
        log.error("执行建议失败 suggestionId={}: {}", id, e.getMessage(), e);
        // 执行失败不改 status，用户可以重试
        return ApiResponse.error("执行失败：" + e.getMessage());
    }
}
```

`SuggestionExecuteResult`：`record SuggestionExecuteResult(boolean success, String message) {}`

## 第九步：NotePort 扩展（若需要）

如果 `NotePort` 缺少覆盖写入索引的能力，新增方法：

```java
// NotePort 接口新增
void writeIndex(String subFolder, String content);

// ObsidianNoteAdapter 实现
@Override
public void writeIndex(String subFolder, String content) {
    Path indexPath = resolveSafePath(subFolder + "/_index.md");
    try {
        Files.createDirectories(indexPath.getParent());
        Files.writeString(indexPath, content, StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
    } catch (IOException e) {
        throw new RuntimeException("写入索引失败：" + e.getMessage(), e);
    }
}
```

## 第十步：前端 SuggestionCard 升级

修改 `SuggestionCard.tsx`：

```typescript
// 新增状态
const [executing, setExecuting] = useState(false)
const [executeResult, setExecuteResult] = useState<string | null>(null)
const [executeError, setExecuteError] = useState<string | null>(null)

// 采纳按钮处理
const handleApprove = async () => {
  // split_note 和 merge_workspace 需要二次确认
  if (['split_note', 'merge_workspace', 'resplit_workspace'].includes(suggestion.suggestionType)) {
    const confirmed = window.confirm(
      '确认执行此操作？这将创建新 Workspace 并迁移内容。源 Workspace 将保留，需手动确认删除。')
    if (!confirmed) return
  }

  setExecuting(true)
  setExecuteError(null)
  try {
    const res = await approveSuggestion(suggestion.id)
    setExecuteResult(res.message)
    onRefresh() // 刷新任务详情
  } catch (err: any) {
    setExecuteError(err.response?.data?.message || '执行失败')
  } finally {
    setExecuting(false)
  }
}

// 渲染
{suggestion.status === 'pending' && (
  <div className="flex items-center gap-2 mt-2">
    <Button onClick={handleApprove} disabled={executing} size="sm">
      {executing ? <><Loader2 className="mr-1 h-3 w-3 animate-spin" />执行中...</> : '采纳'}
    </Button>
    <Button variant="ghost" onClick={handleIgnore} disabled={executing} size="sm">
      忽略
    </Button>
  </div>
)}

{suggestion.status === 'accepted' && (
  <div className="mt-2 flex items-center gap-1 text-xs text-green-600">
    <CheckCircle className="h-3 w-3" />
    <span>已采纳</span>
    {executeResult && <span className="text-muted-foreground">— {executeResult}</span>}
  </div>
)}

{executeError && (
  <p className="mt-1 text-xs text-red-500">{executeError}（可重试）</p>
)}
```

## 第十一步：验证

```bash
pnpm build
mise exec java@21 -- mvn -q test

# 手动测试（建议准备一些测试数据）：
#
# 1. split_note 测试：
#    - 创建一个 Workspace，导入多个不同主题的材料使 Master Note > 5000 字
#    - 运行 Agent B 巡检 → 应产出 split_note 建议
#    - 点击 [采纳] → 确认框 → 等待执行
#    - 验证：新 Workspace 已创建 + Master Note 已拆分 + embedding 已建立
#    - 验证：源 Workspace 保留未删除
#
# 2. fix_index 测试：
#    - 手动删除一个 __master.md 文件（或在 _index.md 中加一条假条目）
#    - 运行 Agent B 巡检 → 应产出 fix_index 建议
#    - 点击 [采纳] → 验证 _index.md 已修正
#
# 3. orphan_note 测试：
#    - 在 vault 中手动创建一个不属于任何 Workspace 的 .md 文件
#    - 运行 Agent B 巡检 → 应产出 orphan_note 建议
#    - 点击 [采纳] → 验证文件已移至 _archive/
#
# 4. 失败回滚测试：
#    - 临时断开 LLM 配置 → 点击 split_note 的 [采纳]
#    - 应展示错误信息，状态保持 pending（可重试）
#    - 恢复 LLM 配置 → 重试应成功
```

**注意事项：**
- `split_note` 和 `merge_workspace` 操作**不删除源 Workspace**，前端结果描述中明确提示"请确认无误后手动删除"
- LLM 输出 JSON 解析需容错（可能被 markdown 代码块包裹）
- `fix_index` 中的路径匹配需宽松（索引可能是相对路径，实际文件是完整路径）
- `orphan_note` 归档目录为 `vault/_archive/`，文件名冲突时追加数字后缀
- 前端 `window.confirm` 用于危险操作的快速确认，后续可升级为 Radix AlertDialog
