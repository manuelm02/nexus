# Phase 6-5 — 5 步确定性 Pipeline + Q&A 基础 + Prompt 模板管理提示词

执行计划：`docs/superpowers/plans/2026-06-17-mindbank-crawl-phase6.md`（Phase 6.6 节）  
架构设计：`docs/nexus-mindbank-pipeline-agent-design.md`（Layer 1 入库 Pipeline）  
前置：Phase 6-1~6-4 均已完成。Port 接口（NotePort / StoragePort / KnowledgeBasePort）和 Adapter 已就绪，Workspace CRUD 可用，Mindbank 页面骨架已搭建

---

你正在开发 Nexus 项目（路径：`/Users/manuelm/Workspace/Projects/Nexus/nexus`），Spring Boot 3.x 后端 + React 18 + TypeScript 前端。请先阅读 `CLAUDE.md`，再阅读计划文档 Phase 6.6 节和架构设计文档第 5 节（Layer 1 入库 Pipeline）。

本阶段目标：实现 Layer 1 完整闭环——5 步异步 Pipeline、基础 Q&A 问答、Prompt 模板管理。

**核心架构约束**：Pipeline 通过 **Port 接口**（StoragePort / NotePort / KnowledgeBasePort）操作外部系统，**不直接依赖** MinioService / NotesService 等具体实现。这样 Pipeline 和 Agent 共享同一组抽象，未来替换实现（如 MinIO → S3、AnythingLLM → PGVector）只换 Adapter 即可。

---

## 第一步：@Async 配置

在 `NexusApplication.java`（或独立 `@Configuration` 类）上添加：

```java
@EnableAsync

@Bean("mindBankPipelineExecutor")
public Executor mindBankPipelineExecutor() {
    ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
    executor.setCorePoolSize(2);
    executor.setMaxPoolSize(5);
    executor.setQueueCapacity(20);
    executor.setThreadNamePrefix("mindbank-pipeline-");
    executor.initialize();
    return executor;
}
```

若 `@EnableAsync` 已存在（Chat 的 @Async 命名已用过），只需新增线程池 Bean。

## 第二步：MindBankPipelineService 骨架

创建 `backend/src/main/java/com/nexus/service/MindBankPipelineService.java`：

```java
/**
 * Mindbank 5 步确定性入库 Pipeline。
 * 高频、无人值守地把材料变成知识。通过 Port 接口操作外部系统。
 *
 * Step 1：内容类型识别（最快模型）
 * Step 2：AI 融合整理 → 更新 Master Note（最强模型，单次 Prompt，不接 Agent A）
 * Step 3：AI 生成 Session Note（中等模型）
 * Step 4：写入 Obsidian vault（通过 NotePort）
 * Step 5：更新 AnythingLLM embedding（通过 KnowledgeBasePort）
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MindBankPipelineService {

    private final StoragePort storagePort;
    private final NotePort notePort;
    private final KnowledgeBasePort knowledgeBasePort;
    private final LlmConfigService llmConfigService;
    private final MindBankDocumentMapper documentMapper;
    private final MindBankWorkspaceMapper workspaceMapper;
    private final MindBankPromptTemplateMapper promptTemplateMapper;
    private final SystemConfigService systemConfigService;

    // 步骤间缓存（ConcurrentHashMap，pipeline 结束后清除）
    private final ConcurrentHashMap<Long, Map<String, String>> stepCache = new ConcurrentHashMap<>();

    @Async("mindBankPipelineExecutor")
    public void triggerAsync(Long documentId) {
        updatePipelineStatus(documentId, "processing");
        try {
            runStep(documentId, 1);
            runStep(documentId, 2);
            runStep(documentId, 3);
            runStep(documentId, 4);
            runStep(documentId, 5);
            updatePipelineStatus(documentId, "done");
        } catch (Exception e) {
            log.error("Pipeline failed for document {}: {}", documentId, e.getMessage(), e);
            updatePipelineStatus(documentId, "failed");
        } finally {
            stepCache.remove(documentId);
        }
    }

    /**
     * 从指定步骤开始重新执行（重置该步及后续状态为 pending）。
     * 注意：此方法在调用线程同步执行，适合前端触发后异步调用。
     */
    public void retryStep(Long documentId, int step) {
        resetStepsFrom(documentId, step);
        updatePipelineStatus(documentId, "processing");
        try {
            for (int s = step; s <= 5; s++) runStep(documentId, s);
            updatePipelineStatus(documentId, "done");
        } catch (Exception e) {
            log.error("Pipeline retry failed for document {} from step {}: {}", documentId, step, e.getMessage(), e);
            updatePipelineStatus(documentId, "failed");
        } finally {
            stepCache.remove(documentId);
        }
    }

    private void runStep(Long documentId, int step) {
        updateStepStatus(documentId, step, "processing");
        try {
            switch (step) {
                case 1 -> step1Classify(documentId);
                case 2 -> step2Organize(documentId);
                case 3 -> step3SessionNote(documentId);
                case 4 -> step4WriteObsidian(documentId);
                case 5 -> step5Embed(documentId);
            }
            updateStepStatus(documentId, step, "done");
        } catch (Exception e) {
            updateStepStatus(documentId, step, "failed", e.getMessage());
            throw new RuntimeException("Step " + step + " failed: " + e.getMessage(), e);
        }
    }
}
```

## 第三步：Step 1 — 内容类型识别

```java
private void step1Classify(Long docId) {
    MindBankDocument doc = getDoc(docId);

    // 1. 通过 StoragePort 读取 processed Markdown 前 500 字
    String content = storagePort.readProcessed(doc.getProcessedMinioKey());
    String preview = content.substring(0, Math.min(500, content.length()));

    // 2. 构造分类 Prompt
    String prompt = """
        分析以下内容的前500字，判断它最接近哪种类型：
        A. 学术论文/研究报告  B. 技术教程/官方文档
        C. 新闻/博客文章     D. 书籍章节/读书笔记
        E. 会议记录/工作文档 F. 其他

        内容：
        """ + preview + "\n\n只返回字母，不需要解释。";

    // 3. 调用 LLM（workflowType=mindbank_classify）
    ChatLanguageModel model = llmConfigService.resolveModel("mindbank_classify");
    if (model == null) throw new IllegalStateException("请先在 Settings → Mindbank 中配置 mindbank_classify 模型");
    String result = model.generate(prompt).trim().toUpperCase();
    String typeTag = result.isEmpty() ? "F" : result.substring(0, 1);

    // 4. 保存 content_type_tag
    documentMapper.updateById(MindBankDocument.builder().id(docId).contentTypeTag(typeTag).build());
}
```

## 第四步：Step 2 — AI 整理 → 更新 Master Note

```java
/**
 * Step 2：AI 融合整理。当前使用单次 Prompt，Phase 6.8 可选升级为 Agent A 多轮自检。
 * 判断逻辑：Workspace 已有 Master Note → organize_merge 模板；首次 → organize_init 模板。
 */
private void step2Organize(Long docId) {
    MindBankDocument doc = getDoc(docId);
    MindBankWorkspace workspace = getWorkspace(doc.getWorkspaceId());

    // 1. 通过 StoragePort 读取 processed 完整内容
    String newContent = storagePort.readProcessed(doc.getProcessedMinioKey());

    // 2. 判断是否已有 Master Note（通过 NotePort 读取）
    String existingMaster = notePort.readMaster(workspace.getName());
    boolean hasMasterNote = existingMaster != null && !existingMaster.isBlank();

    // 3. 获取 Prompt 模板
    String promptType = hasMasterNote ? "organize_merge" : "organize_init";
    String promptTemplate = getDefaultPromptTemplate(promptType);

    // 4. 构造 Prompt（替换变量）
    String prompt;
    if (hasMasterNote) {
        prompt = promptTemplate
            .replace("{master_note}", existingMaster)
            .replace("{new_content}", newContent)
            .replace("{document_name}", doc.getFileName())
            .replace("{timestamp}", LocalDateTime.now().toString())
            .replace("{workspace_name}", workspace.getName());
    } else {
        prompt = promptTemplate
            .replace("{content}", newContent)
            .replace("{source_url}", buildMinioUrl(doc.getOriginalMinioKey()))
            .replace("{timestamp}", LocalDateTime.now().toString())
            .replace("{workspace_name}", workspace.getName());
    }

    // 5. 调用 LLM（workflowType=mindbank_organize）
    ChatLanguageModel model = llmConfigService.resolveModel("mindbank_organize");
    if (model == null) throw new IllegalStateException("请先在 Settings → Mindbank 中配置 mindbank_organize 模型");
    String masterNoteContent = generateWithChunking(model, prompt, newContent);

    // 6. 缓存供 Step 3/4 使用
    putCache(docId, "masterNoteContent", masterNoteContent);
    putCache(docId, "hasMasterNote", String.valueOf(hasMasterNote));
}
```

**长文档分块方法（generateWithChunking）：**
```java
/**
 * 长文档分块处理策略。
 * < 12000 字符：直接单次 LLM 调用
 * ≥ 12000 字符：按 \n\n 段落分块（每块 ≤ 4000 字符），逐块整理后合并
 */
private String generateWithChunking(ChatLanguageModel model, String prompt, String content) {
    if (content.length() < 12000) {
        return model.generate(prompt);
    }

    // 按段落分割
    String[] paragraphs = content.split("\n\n");
    List<String> chunks = new ArrayList<>();
    StringBuilder current = new StringBuilder();
    for (String p : paragraphs) {
        if (current.length() + p.length() > 4000 && !current.isEmpty()) {
            chunks.add(current.toString());
            current = new StringBuilder();
        }
        current.append(p).append("\n\n");
    }
    if (!current.isEmpty()) chunks.add(current.toString());

    // 逐块整理
    List<String> chunkResults = new ArrayList<>();
    for (String chunk : chunks) {
        String chunkPrompt = prompt.replace("{content}", chunk).replace("{new_content}", chunk);
        chunkResults.add(model.generate(chunkPrompt));
    }

    // 合并
    String mergePrompt = "将以下多份笔记合并为一份完整的知识笔记，消除重复，保留所有知识点：\n\n"
        + String.join("\n\n---\n\n", chunkResults);
    return model.generate(mergePrompt);
}
```

## 第五步：Step 3 — 生成 Session Note

```java
private void step3SessionNote(Long docId) {
    boolean autoSessionNote = Boolean.parseBoolean(
        systemConfigService.get("mindbank.pipeline.auto_session_note", "true"));
    if (!autoSessionNote) return; // 跳过，直接标记 done

    MindBankDocument doc = getDoc(docId);
    MindBankWorkspace workspace = getWorkspace(doc.getWorkspaceId());
    String newContent = storagePort.readProcessed(doc.getProcessedMinioKey());
    String promptTemplate = getDefaultPromptTemplate("session_note");

    String prompt = promptTemplate
        .replace("{content}", newContent.substring(0, Math.min(3000, newContent.length())))
        .replace("{document_name}", doc.getFileName())
        .replace("{date}", LocalDate.now().toString())
        .replace("{workspace_name}", workspace.getName())
        .replace("{source_url}", buildMinioUrl(doc.getOriginalMinioKey()))
        .replace("{master_note_path}", workspace.getMasterNotePath() != null ? workspace.getMasterNotePath() : "待生成");

    ChatLanguageModel model = llmConfigService.resolveModel("mindbank_condense");
    if (model == null) throw new IllegalStateException("请先在 Settings → Mindbank 中配置 mindbank_condense 模型");
    String sessionNoteContent = model.generate(prompt);

    putCache(docId, "sessionNoteContent", sessionNoteContent);
}
```

## 第六步：Step 4 — 写入 Obsidian vault（通过 NotePort）

```java
/**
 * Step 4：写入 Obsidian vault。
 * 通过 NotePort 操作，不直接操作文件系统——这是 Port 抽象层的价值所在。
 */
private void step4WriteObsidian(Long docId) {
    MindBankDocument doc = getDoc(docId);
    MindBankWorkspace workspace = getWorkspace(doc.getWorkspaceId());
    String subFolder = systemConfigService.get("notes.obsidian.sub_folder", "Mindbank");

    // 1. 用快速模型获取 AI 建议的子文件夹名
    String folderClassifyPrompt = getDefaultPromptTemplate("classify_folder")
        .replace("{existing_folders}", getExistingFolders(subFolder))
        .replace("{workspace_name}", workspace.getName())
        .replace("{domain_tag}", workspace.getDomainTag() != null ? workspace.getDomainTag() : "")
        .replace("{summary}", getCacheOrEmpty(docId, "masterNoteContent")
            .substring(0, Math.min(200, getCacheOrEmpty(docId, "masterNoteContent").length())));
    ChatLanguageModel fastModel = llmConfigService.resolveModel("mindbank_classify");
    String suggestedFolder = fastModel.generate(folderClassifyPrompt).trim();

    // 完整子路径 = subFolder/suggestedFolder
    String fullSubFolder = subFolder + "/" + suggestedFolder;

    // 2. 写 Master Note（通过 NotePort）
    String masterContent = getCache(docId, "masterNoteContent");
    notePort.writeMaster(workspace.getName(), fullSubFolder, masterContent);

    // 3. 写 Session Note（通过 NotePort）
    String sessionContent = getCacheOrEmpty(docId, "sessionNoteContent");
    String today = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd"));
    if (!sessionContent.isBlank()) {
        notePort.appendSession(workspace.getName(), fullSubFolder, sessionContent, today);
    }

    // 4. 更新索引（通过 NotePort）
    String indexEntry = String.format("- [%s](%s__master.md) — %s · %s",
        workspace.getName(),
        workspace.getName().replaceAll("[/\\\\:*?\"<>|]", "_"),
        doc.getFileName(), today);
    notePort.appendIndex(fullSubFolder, indexEntry);

    // 5. 更新 DB
    String vaultRoot = systemConfigService.get("notes.obsidian.vault_path");
    String safeName = workspace.getName().replaceAll("[/\\\\:*?\"<>|]", "_");
    String masterPath = vaultRoot + "/" + fullSubFolder + "/" + safeName + "__master.md";
    workspaceMapper.updateById(MindBankWorkspace.builder()
        .id(workspace.getId()).masterNotePath(masterPath).build());

    if (!sessionContent.isBlank()) {
        String sessionPath = vaultRoot + "/" + fullSubFolder + "/" + safeName + "__session__" + today + ".md";
        documentMapper.updateById(MindBankDocument.builder()
            .id(docId).sessionNotePath(sessionPath).build());
    }
}
```

## 第七步：Step 5 — 更新 AnythingLLM Embedding（通过 KnowledgeBasePort）

```java
private void step5Embed(Long docId) {
    MindBankDocument doc = getDoc(docId);
    MindBankWorkspace workspace = getWorkspace(doc.getWorkspaceId());

    if (workspace.getAnythingllmSlug() == null) {
        log.warn("Workspace {} 未配置 AnythingLLM slug，跳过 embedding", workspace.getId());
        return;
    }

    // 1. 删除旧 embedding（通过 KnowledgeBasePort）
    if (workspace.getAnythingllmDocId() != null) {
        try {
            knowledgeBasePort.deleteDocument(workspace.getAnythingllmSlug(), workspace.getAnythingllmDocId());
        } catch (Exception e) {
            log.warn("删除旧 embedding 失败，继续上传新版本：{}", e.getMessage());
        }
    }

    // 2. 读取最新 Master Note 内容（通过 NotePort）
    String masterContent = notePort.readMaster(workspace.getName());
    if (masterContent == null || masterContent.isBlank()) {
        log.warn("Master Note 内容为空，跳过 embedding");
        return;
    }

    // 3. 上传到 AnythingLLM（通过 KnowledgeBasePort）
    String newDocId = knowledgeBasePort.uploadDocument(
        workspace.getAnythingllmSlug(), masterContent, workspace.getName() + "_master.md");

    // 4. 保存新 doc_id
    workspaceMapper.updateById(MindBankWorkspace.builder()
        .id(workspace.getId()).anythingllmDocId(newDocId).build());
}
```

## 第八步：接线 CrawlService + MindBankDocumentService

1. `CrawlService.importToWorkspace`：取消注释，接入 `mindBankPipelineService.triggerAsync(docId)`
2. `MindBankDocumentService.retryStep`：接入 `mindBankPipelineService.retryStep(docId, step)`

## 第九步：Q&A 接口

创建 `backend/src/main/java/com/nexus/controller/MindBankQaController.java`（`/api/v1/mindbank/qa`）：

```java
/**
 * Mindbank Q&A 问答接口。
 * 当前为简单的单 Workspace RAG 查询，Phase 6.8 可升级为 Agent C agentic 检索。
 */
@RestController
@RequestMapping("/api/v1/mindbank/qa")
@RequiredArgsConstructor
public class MindBankQaController {

    private final KnowledgeBasePort knowledgeBasePort;
    private final MindBankWorkspaceMapper workspaceMapper;

    @PostMapping("/{workspaceId}/chat")
    public ApiResponse<QaResponse> chat(@PathVariable Long workspaceId, @RequestBody QaRequest req) {
        MindBankWorkspace workspace = workspaceMapper.selectById(workspaceId);
        if (workspace == null) return ApiResponse.error("Workspace 不存在");
        if (workspace.getAnythingllmSlug() == null) {
            return ApiResponse.error("该 Workspace 尚未完成知识库初始化");
        }

        KnowledgeBaseAnswer answer = knowledgeBasePort.query(workspace.getAnythingllmSlug(), req.question());
        return ApiResponse.ok(new QaResponse(answer.answer(), answer.sourceUrls()));
    }
}
```

`QaRequest`：`record QaRequest(String question) {}`  
`QaResponse`：`record QaResponse(String answer, List<String> sources) {}`

## 第十步：笔记查看接口

在 `MindBankWorkspaceController` 中新增：

```java
/** 读取 Workspace 的 Master Note 内容，供前端笔记查看器使用 */
@GetMapping("/{id}/master-note")
public ApiResponse<MasterNoteResponse> getMasterNote(@PathVariable Long id) {
    MindBankWorkspace workspace = workspaceMapper.selectById(id);
    if (workspace == null) return ApiResponse.error("Workspace 不存在");

    String content = notePort.readMaster(workspace.getName());
    if (content == null) return ApiResponse.ok(new MasterNoteResponse(null, null, "尚未生成笔记"));
    return ApiResponse.ok(new MasterNoteResponse(content, workspace.getMasterNotePath(), null));
}

/** 读取 Workspace 下所有 Session Note */
@GetMapping("/{id}/session-notes")
public ApiResponse<List<SessionNoteResponse>> getSessionNotes(@PathVariable Long id) {
    // 查询 mindbank_documents 中 workspace_id={id} AND session_note_path IS NOT NULL
    // 逐个读取文件内容，文件不存在则跳过
    // 按 created_at 倒序返回
}
```

## 第十一步：Prompt 模板 CRUD

创建 `MindBankPromptTemplateController`（`/api/v1/mindbank/prompt-templates`）：

```java
@GetMapping
public ApiResponse<List<PromptTemplateResponse>> list(@RequestParam(required = false) String type) {
    // type 非空时按 prompt_type 过滤，否则返回全部
}

@PostMapping
public ApiResponse<PromptTemplateResponse> create(@RequestBody CreatePromptTemplateRequest req) {
    // is_builtin 强制 false，is_default 可设置
}

@PutMapping("/{id}")
public ApiResponse<Void> update(@PathVariable Long id, @RequestBody UpdatePromptTemplateRequest req) {
    // 校验：is_builtin=true 的模板不可编辑
}

@DeleteMapping("/{id}")
public ApiResponse<Void> delete(@PathVariable Long id) {
    // 校验：is_builtin=true 的模板不可删除，返回友好错误
}
```

## 第十二步：前端 Q&A 视图

创建 `frontend/src/pages/Mindbank/components/MindBankQaView.tsx`：

```
flex flex-col h-full
├── 顶部说明栏（border-b）："基于《{workspace.name}》知识库问答" + 文档数量 chip
├── 消息列表（flex-1 overflow-y-auto）：
│   复用 Chat 页面的 MessageBubble 组件（react-markdown 渲染）
│   AI 回答下方展示来源引用卡片：灰色小卡，chunk 前 100 字 + MinIO 链接按钮
└── 输入区（border-t）：
    输入框 + 发送按钮，发送后追加 user message，loading 时展示 spinner
    收到回答后渲染 AI message + 来源引用卡片
```

**状态管理**：本地 useState 管理 `Message[]`（role/content/sources），不持久化到 DB。
**请求方式**：非流式（AnythingLLM 同步返回），useMutation 发送。

## 第十三步：前端 Prompt 模板管理

在 `MindBankSettingsPanel.tsx` 末尾新增 Prompt 模板区域：

- 按 promptType 分组展示（organize_init / organize_merge / session_note / classify_folder）
- 分组中文名：初始整理 / 融合更新 / 导入速记 / 文件夹分类
- 内置模板：Collapsible 展开查看内容，"内置"badge，不可编辑删除
- 自定义模板：可编辑（textarea 弹窗）/ 删除（二次确认）/ 设为默认
- "新建自定义模板"按钮 → 弹窗，字段：名称 + 类型下拉 + 内容 textarea
- textarea 下方展示可用变量提示（按类型不同展示不同变量）：
  - organize_init：`{content}` `{source_url}` `{timestamp}` `{workspace_name}`
  - organize_merge：上述 + `{master_note}` `{new_content}` `{document_name}`
  - session_note：`{content}` `{document_name}` `{date}` `{workspace_name}` `{source_url}` `{master_note_path}`
  - classify_folder：`{existing_folders}` `{workspace_name}` `{domain_tag}` `{summary}`

## 第十四步：前端 Tab 完整接线

更新 Mindbank 页面 Tab 渲染：

```typescript
type MindBankTab = 'documents' | 'qa' | 'agent'

{activeTab === 'documents' && <DocumentList workspaceId={workspace.id} />}
{activeTab === 'qa' && <MindBankQaView workspace={workspace} />}
{activeTab === 'agent' && (
  <div className="p-6 text-center text-muted-foreground">
    <p className="text-sm font-medium">Agent 知识管家</p>
    <p className="mt-1 text-xs">即将在下一阶段推出——AI 自动巡检知识库体系性、发现问题并提出建议</p>
  </div>
)}
```

## 第十五步：验证

```bash
pnpm build
mise exec java@21 -- mvn -q test

# 端到端手动测试（需后端运行 + Settings 中所有服务已配置）：
# 1. Crawl 页面上传一个 PDF / 爬取一个 URL
# 2. Mindbank → 选择 Workspace → 选文件 → 开始处理
# 3. 观察 DocumentCard 流水线状态（Step1→2→3→4→5 逐步变绿）
# 4. 检查 Obsidian vault：{sub_folder}/{AI分类文件夹}/{workspace_name}__master.md 已生成
# 5. 检查 AnythingLLM UI：对应 workspace 下有 embedding 文档
# 6. Notes 页面：能看到新生成的笔记文件
# 7. Mindbank → Q&A Tab → 输入问题 → 收到 AI 回答 + 来源引用
# 8. Settings → Mindbank → Prompt 模板：查看内置模板、新建自定义模板、设为默认
```

**注意事项：**
- 步骤间缓存使用 `ConcurrentHashMap<Long, Map<String, String>>`，pipeline 结束后（finally）清除
- `buildMinioUrl` 方法：返回 `{minio.url}/{bucket}/{key}` 格式的完整 URL
- 若 `llmConfigService.resolveModel(...)` 返回 null，抛出友好异常（中文提示检查 Settings 配置）
- `getExistingFolders` 方法：列举 vault subFolder 下第一层目录名，join 为逗号分隔
- Q&A 不做流式输出（AnythingLLM 同步返回），等待期间展示 loading spinner
- Session Notes 文件被手动删除时跳过（不报错）
