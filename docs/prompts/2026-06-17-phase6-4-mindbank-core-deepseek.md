# Phase 6-4 — Port 抽象层 + Mindbank 核心页面（Workspace + 文档管理）提示词

执行计划：`docs/superpowers/plans/2026-06-17-mindbank-crawl-phase6.md`（Phase 6.5 节）  
架构设计：`docs/nexus-mindbank-pipeline-agent-design.md`（Layer 0 共享能力层）  
前置：Phase 6-1（基础设施）+ Phase 6-2（Settings + Crawl）+ Phase 6-3（Notes）均已完成

---

你正在开发 Nexus 项目（路径：`/Users/manuelm/Workspace/Projects/Nexus/nexus`），Spring Boot 3.x 后端 + React 18 + TypeScript 前端。请先阅读 `CLAUDE.md` 和 `AGENTS.md`，再阅读计划文档 Phase 6.5 节和架构设计文档第 4 节（Layer 0 共享能力层）。

本阶段有两个目标：
1. **Layer 0 Port 抽象层**：创建 NotePort / StoragePort 接口和对应 Adapter，为后续 Pipeline 和 Agent 提供共享地基
2. **Mindbank 核心页面**：Workspace CRUD、文档管理、文件导入 UI

**架构关键理解**：Pipeline（Layer 1）和 Agent（Layer 2）**共用** Layer 0 的 Port 接口操作外部系统。本阶段把地基打好，后续 Pipeline 和 Agent 只通过 Port 调用，不直接依赖 MinioService / NotesService 等具体实现。

---

## 第一步：NotePort 接口 + ObsidianNoteAdapter

创建 `backend/src/main/java/com/nexus/port/NotePort.java`：

```java
/**
 * Obsidian vault 笔记读写端口，供 Pipeline（Step4 写笔记）和 Agent（巡检读笔记）共用。
 * 与 NotesService（前端 Notes 页面的文件 CRUD）职责不同：
 * NotePort 专注 Mindbank 的 Master Note / Session Note 操作，不处理任意文件的浏览编辑。
 */
public interface NotePort {

    /**
     * 读取指定 workspace 的 Master Note 全文。
     * @return Master Note 内容；文件不存在时返回 null
     */
    String readMaster(String workspaceName);

    /**
     * 覆盖写入 Master Note。自动创建 {vault}/{subFolder}/{AI建议子文件夹}/ 目录。
     * 文件命名：{workspaceSafeName}__master.md
     */
    void writeMaster(String workspaceName, String subFolder, String content);

    /**
     * 追加 Session Note（每次导入一个新文件）。
     * 文件命名：{workspaceSafeName}__session__{date}.md
     */
    void appendSession(String workspaceName, String subFolder, String content, String date);

    /**
     * 列出 vault 中所有 .md 文件的元信息，供 Agent B 巡检使用。
     * 递归扫描，过滤 .obsidian 等隐藏目录。
     */
    List<NoteMeta> listNotes();

    /** 读取 {subFolder}/_index.md 全文 */
    String readIndex(String subFolder);

    /** 向 {subFolder}/_index.md 追加一行条目 */
    void appendIndex(String subFolder, String entry);
}
```

创建 `backend/src/main/java/com/nexus/port/NoteMeta.java`：
```java
/** Obsidian 笔记元信息，用于 Agent 巡检判断 */
public record NoteMeta(String name, String path, long sizeBytes, LocalDateTime lastModified) {}
```

创建 `backend/src/main/java/com/nexus/adapter/note/ObsidianNoteAdapter.java`：

```java
/**
 * NotePort 的 Obsidian vault 实现。
 * vault 根路径从 SystemConfigService 读取，与 NotesService 共享同一 vault。
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ObsidianNoteAdapter implements NotePort {

    private final SystemConfigService systemConfigService;

    // vault 路径：notes.obsidian.vault_path（Phase 6-2 Settings 中配置）
    private Path getVaultRoot() {
        String path = systemConfigService.get("notes.obsidian.vault_path");
        if (path == null || path.isBlank()) throw new IllegalStateException("请先在 Settings → Mindbank 中配置 Obsidian vault 路径");
        return Path.of(path);
    }

    // 安全路径解析，防止路径穿越
    private Path resolveSafePath(String relativePath) {
        Path vaultRoot = getVaultRoot();
        Path resolved = vaultRoot.resolve(relativePath).normalize();
        if (!resolved.startsWith(vaultRoot)) {
            throw new IllegalArgumentException("路径越界：" + relativePath);
        }
        return resolved;
    }

    // workspace 名称转安全文件名
    private String safeFileName(String workspaceName) {
        return workspaceName.replaceAll("[/\\\\:*?\"<>|]", "_");
    }

    @Override
    public String readMaster(String workspaceName) {
        // 遍历 vault 查找 {safeName}__master.md（可能在不同子文件夹中）
        // 找到 → 返回文件内容；未找到 → 返回 null
        // 用 Files.walk 查找，深度限制 5 层
    }

    @Override
    public void writeMaster(String workspaceName, String subFolder, String content) {
        // 目标路径：{vault}/{subFolder}/{safeName}__master.md
        // 自动创建目录 Files.createDirectories
        // 覆盖写入 Files.writeString(..., CREATE, TRUNCATE_EXISTING)
    }

    @Override
    public void appendSession(String workspaceName, String subFolder, String content, String date) {
        // 目标路径：{vault}/{subFolder}/{safeName}__session__{date}.md
        // 新建文件写入（若同日重复导入，文件名追加序号）
    }

    @Override
    public List<NoteMeta> listNotes() {
        // Files.walk(vaultRoot, 10) 递归扫描
        // 过滤：只保留 .md 文件，排除 .obsidian 目录
        // 返回 NoteMeta 列表（path 为相对于 vault 的路径）
    }

    @Override
    public String readIndex(String subFolder) {
        Path indexPath = resolveSafePath(subFolder + "/_index.md");
        return Files.exists(indexPath) ? Files.readString(indexPath) : "";
    }

    @Override
    public void appendIndex(String subFolder, String entry) {
        Path indexPath = resolveSafePath(subFolder + "/_index.md");
        Files.createDirectories(indexPath.getParent());
        // 追加一行，若文件不存在则创建并写入标题 "# Mindbank 知识索引\n\n"
        Files.writeString(indexPath, entry + "\n", CREATE, APPEND);
    }
}
```

## 第二步：StoragePort 接口 + MinioStorageAdapter

创建 `backend/src/main/java/com/nexus/port/StoragePort.java`：

```java
/**
 * 文件存储端口，隔离 MinIO 实现细节。Pipeline 和 Agent 通过此接口读写文件，不直接依赖 MinioService。
 */
public interface StoragePort {
    /** 读取 processed/ 目录下的 Markdown 文件内容 */
    String readProcessed(String key);

    /** 写入 processed/ 目录下的 Markdown 文件 */
    void putProcessed(String key, String markdown);

    /** 写入 originals/ 目录下的原始文件 */
    void putOriginal(String key, byte[] data, String contentType);

    /** 删除文件 */
    void delete(String key);

    /** 列出指定前缀下的文件 */
    List<FileMeta> list(String prefix);
}
```

创建 `backend/src/main/java/com/nexus/port/FileMeta.java`：
```java
public record FileMeta(String key, long size, LocalDateTime lastModified) {}
```

创建 `backend/src/main/java/com/nexus/adapter/storage/MinioStorageAdapter.java`：

```java
/**
 * StoragePort 的 MinIO 实现，委托已有 MinioService 完成实际操作。
 * bucket 从 SystemConfigService 读取 mindbank.minio.bucket。
 */
@Service
@RequiredArgsConstructor
public class MinioStorageAdapter implements StoragePort {

    private final MinioService minioService;
    private final SystemConfigService systemConfigService;

    private String getBucket() {
        return systemConfigService.get("mindbank.minio.bucket", "nexus");
    }

    @Override
    public String readProcessed(String key) {
        return minioService.downloadAsString(getBucket(), key);
    }

    @Override
    public void putProcessed(String key, String markdown) {
        minioService.uploadText(getBucket(), key, markdown);
    }

    @Override
    public void putOriginal(String key, byte[] data, String contentType) {
        minioService.uploadStream(getBucket(), key,
            new ByteArrayInputStream(data), data.length, contentType);
    }

    @Override
    public void delete(String key) {
        minioService.deleteFile(getBucket(), key);
    }

    @Override
    public List<FileMeta> list(String prefix) {
        return minioService.listFiles(getBucket(), prefix).stream()
            .map(f -> new FileMeta(f.key(), f.size(), f.lastModified()))
            .toList();
    }
}
```

## 第三步：扩展 KnowledgeBasePort

在 `KnowledgeBasePort` 接口中新增（供未来 Agent C 跨 Workspace 搜索使用）：
```java
/**
 * 跨多个 Workspace 检索，合并结果返回。
 * 供 Agent C（agentic Q&A）使用。当前阶段 AnythingLlmClient 可逐个查询后合并。
 */
default KnowledgeBaseAnswer queryMultiple(List<String> workspaceSlugs, String question) {
    // 默认实现：逐个查询，合并 answer 和 sourceUrls
    StringBuilder combinedAnswer = new StringBuilder();
    List<String> allSources = new ArrayList<>();
    for (String slug : workspaceSlugs) {
        KnowledgeBaseAnswer result = query(slug, question);
        if (result.answer() != null && !result.answer().isBlank()) {
            combinedAnswer.append(result.answer()).append("\n\n");
            allSources.addAll(result.sourceUrls());
        }
    }
    return new KnowledgeBaseAnswer(combinedAnswer.toString().trim(), allSources);
}
```

## 第四步：后端 Workspace CRUD

扩展现有只读 `MindBankWorkspaceController`（当前只有 GET list）。

创建 `backend/src/main/java/com/nexus/service/MindBankWorkspaceService.java`：

```java
/**
 * Mindbank Workspace 管理服务。
 * create 时联动创建 AnythingLLM workspace（失败不回滚，slug 留空后续可重试）。
 * delete 时不删除 AnythingLLM workspace（避免意外丢失向量数据）。
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MindBankWorkspaceService {

    private final MindBankWorkspaceMapper workspaceMapper;
    private final MindBankDocumentMapper documentMapper;
    private final KnowledgeBasePort knowledgeBasePort;

    public List<MindBankWorkspace> list() {
        return workspaceMapper.selectList(
            new LambdaQueryWrapper<MindBankWorkspace>().orderByDesc(MindBankWorkspace::getCreatedAt));
    }

    public MindBankWorkspace create(CreateWorkspaceRequest req) {
        MindBankWorkspace workspace = new MindBankWorkspace();
        workspace.setName(req.getName());
        workspace.setDomainTag(req.getDomainTag());
        workspace.setDescription(req.getDescription());

        // 联动 AnythingLLM 创建 workspace
        try {
            String slug = knowledgeBasePort.createWorkspace(req.getName(), req.getDescription());
            workspace.setAnythingllmSlug(slug);
        } catch (Exception e) {
            log.warn("AnythingLLM workspace 创建失败，slug 留空：{}", e.getMessage());
        }

        workspaceMapper.insert(workspace);
        return workspace;
    }

    public void update(Long id, UpdateWorkspaceRequest req) {
        MindBankWorkspace workspace = workspaceMapper.selectById(id);
        if (workspace == null) throw new IllegalArgumentException("Workspace 不存在");
        workspace.setName(req.getName());
        workspace.setDomainTag(req.getDomainTag());
        workspace.setDescription(req.getDescription());
        workspaceMapper.updateById(workspace);
    }

    public void delete(Long id) {
        // 检查是否有文档关联（可选：提醒用户）
        workspaceMapper.deleteById(id);
    }
}
```

创建 `CreateWorkspaceRequest` / `UpdateWorkspaceRequest` DTO（name 必填，domainTag/description 选填）。

更新 `MindBankWorkspaceController`（删除旧的直接 mapper 调用，改为委托 Service）：
```java
@GetMapping
public ApiResponse<List<WorkspaceResponse>> list() { ... }

@PostMapping
public ApiResponse<WorkspaceResponse> create(@RequestBody CreateWorkspaceRequest req) { ... }

@PutMapping("/{id}")
public ApiResponse<Void> update(@PathVariable Long id, @RequestBody UpdateWorkspaceRequest req) { ... }

@DeleteMapping("/{id}")
public ApiResponse<Void> delete(@PathVariable Long id) { ... }
```

创建 `WorkspaceResponse` DTO：`id, name, domainTag, description, anythingllmSlug, masterNotePath, documentCount, createdAt`
- `documentCount` 通过 COUNT 查询 mindbank_documents 获得

## 第五步：后端 Document 接口

创建 `backend/src/main/java/com/nexus/service/MindBankDocumentService.java`：

```java
/**
 * Mindbank 文档管理服务。
 * 文档通过 Crawl 页面导入后挂载到 Workspace，Pipeline（Phase 6-5）负责后续 AI 处理。
 */
@Service
@RequiredArgsConstructor
public class MindBankDocumentService {

    private final MindBankDocumentMapper documentMapper;

    /** 查询指定 workspace 下所有文档，按创建时间倒序 */
    public List<MindBankDocument> listByWorkspace(Long workspaceId) {
        return documentMapper.selectList(
            new LambdaQueryWrapper<MindBankDocument>()
                .eq(MindBankDocument::getWorkspaceId, workspaceId)
                .orderByDesc(MindBankDocument::getCreatedAt));
    }

    /** 查询单个文档的流水线状态 */
    public MindBankDocument getStatus(Long docId) {
        return documentMapper.selectById(docId);
    }

    /**
     * 重置指定步骤及后续步骤状态为 pending。
     * Pipeline 实际执行逻辑在 Phase 6-5 接入。
     */
    public void retryStep(Long docId, int step) {
        MindBankDocument doc = documentMapper.selectById(docId);
        if (doc == null) throw new IllegalArgumentException("文档不存在");

        // 重置 step 及后续为 pending
        for (int s = step; s <= 5; s++) {
            setStepStatus(doc, s, "pending");
        }
        doc.setPipelineStatus("processing");
        doc.setStepErrorMsg(null);
        documentMapper.updateById(doc);

        // Phase 6-5 实现后：此处调用 MindBankPipelineService.retryStep(docId, step)
    }
}
```

创建 `MindBankDocumentController`（`/api/v1/mindbank/documents`）：
```java
@GetMapping
public ApiResponse<List<DocumentResponse>> listByWorkspace(@RequestParam Long workspaceId) { ... }

@GetMapping("/{id}/status")
public ApiResponse<DocumentResponse> getStatus(@PathVariable Long id) { ... }

@PostMapping("/{id}/retry-step")
public ApiResponse<Void> retryStep(@PathVariable Long id, @RequestBody RetryStepRequest req) { ... }
```

创建 `DocumentResponse` DTO：`id, fileName, sourceType, originalMinioKey, processedMinioKey, pipelineStatus, step1Status~step5Status, stepErrorMsg, sessionNotePath, createdAt`

## 第六步：前端 Mindbank 页面

替换现有占位 `Mindbank/index.tsx`，搭建完整页面。

### mindbank.api.ts
```typescript
/** Mindbank API 调用层 */

// Workspace
export const listWorkspaces = () => apiClient.get('/mindbank/workspaces').then(r => r.data.data)
export const createWorkspace = (data: CreateWorkspaceReq) => apiClient.post('/mindbank/workspaces', data).then(r => r.data.data)
export const updateWorkspace = (id: number, data: UpdateWorkspaceReq) => apiClient.put(`/mindbank/workspaces/${id}`, data)
export const deleteWorkspace = (id: number) => apiClient.delete(`/mindbank/workspaces/${id}`)

// Document
export const listDocuments = (workspaceId: number) => apiClient.get('/mindbank/documents', { params: { workspaceId } }).then(r => r.data.data)
export const getDocumentStatus = (id: number) => apiClient.get(`/mindbank/documents/${id}/status`).then(r => r.data.data)
export const retryStep = (id: number, step: number) => apiClient.post(`/mindbank/documents/${id}/retry-step`, { step })
```

### mindbank.types.ts
```typescript
export interface Workspace {
  id: number; name: string; domainTag: string | null; description: string | null;
  anythingllmSlug: string | null; masterNotePath: string | null; documentCount: number; createdAt: string;
}
export interface MindBankDocument {
  id: number; fileName: string; sourceType: string; pipelineStatus: string;
  step1Status: string; step2Status: string; step3Status: string; step4Status: string; step5Status: string;
  stepErrorMsg: string | null; createdAt: string;
}
export type MindBankTab = 'documents' | 'qa' | 'agent'
```

### index.tsx
- `useQuery` 查询 workspace 列表
- `useState` 管理选中 workspace、当前 tab
- workspace CRUD mutation
- 根据 `useIsMobile()` 渲染 Desktop/Mobile View

### MindBankDesktopView.tsx
```
flex h-full
├── 左侧 WorkspaceList（w-72 border-r）
└── 右侧主区域（flex-1）
    ├── 顶部：Workspace 名称 + 领域 Tag + "添加文件"按钮
    ├── Tab 导航：文件/入库 · Q&A · Agent 知识管家
    │   （Q&A 和 Agent Tab 本阶段占位："即将推出"）
    └── DocumentList（Tab=文件/入库 时展示）
```

### MindBankMobileView.tsx
- WorkspaceList 改为顶部横向 chip 滚动条
- 内容全屏展示
- 参照 AGENTS.md 移动端规范

### WorkspaceList.tsx
- 按 `domainTag` 分组展示（同 tag 归一个分组标题下）
- 选中 workspace 高亮
- 每个 WorkspaceCard 有删除按钮（hover 显示，二次确认气泡）
- 底部"+ 新建 Workspace"按钮 → 打开 WorkspaceDialog

### WorkspaceDialog.tsx
- Radix Dialog，字段：Workspace 名称（必填）、领域标签（input + datalist 展示已有 tag）、描述（textarea 选填）
- 提交 loading → 成功关闭并刷新列表

### DocumentCard.tsx + PipelineStatus.tsx
- 展示：文件名、来源类型 icon（网页/文件）、创建时间
- PipelineStatus：5 步标签（识别/整理/速记/写入/嵌入）
  - `pending`：灰色圆点
  - `processing`：旋转 spinner（`animate-spin`）
  - `done`：绿色勾（`CheckCircle` from lucide）
  - `failed`：红色叉（`XCircle`），hover 展示错误信息 tooltip
- `failed` 展示"重试此步骤"按钮
- `pipelineStatus === 'processing'` 时每 3s 轮询 `/{id}/status`，done/failed 停止轮询

### MinioFilePicker.tsx
- 弹窗，调用 `GET /api/crawl/files` 获取未分配文件列表（workspace_id IS NULL）
- 列表：文件名、来源、日期
- 底部 Prompt 模板选择（下拉，调 `/api/mindbank/prompt-templates?type=organize_init`，默认选 is_default）
- "开始处理"按钮 → 调 `POST /api/crawl/import`，关闭弹窗，DocumentList 刷新

## 第七步：验证

```bash
pnpm build
mise exec java@21 -- mvn -q test
# 手动测试（需后端运行 + Settings 中 AnythingLLM / MinIO 已配置）：
# 1. 新建 Workspace → 确认 DB 和 AnythingLLM 都创建成功
# 2. 从 MinioFilePicker 选择 Crawl 上传的文件 → 开始处理
# 3. DocumentCard 流水线状态：5 步均为 pending（Pipeline Service 未实现，符合预期）
# 4. 删除 Workspace 正常（含二次确认）
# 5. Port 接口验证：ObsidianNoteAdapter.listNotes() 能列出 vault 文件
```

**注意事项：**
- 流水线状态轮询只在 `pipelineStatus === 'processing'` 时启动
- DocumentCard 删除功能本阶段不做（级联删除放入 Phase 6-5）
- 移动端 WorkspaceList 横向 chip：`flex overflow-x-auto gap-2 pb-2`，隐藏滚动条
- Port 接口中所有路径操作必须经过安全校验（resolveSafePath / normalize + startsWith）
