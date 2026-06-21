# Phase 6：Mindbank & Crawl & Notes — 执行计划

> 创建日期：2026-06-17  
> 设计文档：`docs/superpowers/specs/2026-06-17-mindbank-crawl-phase6-design.md`  
> 分支：`mindbank`  
> 前置依赖：Phase 5 Chat 已合并（V1_15 已存在）

---

## 0. 基础信息与约定

### 服务地址
| 服务 | 地址 |
|------|------|
| MinIO API | `http://192.168.110.105:7001` |
| MinIO Console | `http://192.168.110.105:7002` |
| Crawl4AI | `http://192.168.110.10:3003` |
| MarkItDown Service | `http://192.168.110.10:3004` |
| AnythingLLM | `http://192.168.110.10:3001` |

### WorkflowType 常量（新增，在 Settings 模型配置中使用）
- `mindbank_classify` — Step 1 内容类型识别（最快最省模型）
- `mindbank_organize` — Step 2 Master Note 整理/融合（最强模型）
- `mindbank_condense` — Step 3 Session Note 速记（中等模型）

### Flyway 起始版本：V1_16

### system_configs 新增 key 列表
```
mindbank.anythingllm.url
mindbank.anythingllm.api_key          ← 加密存储
mindbank.minio.url
mindbank.minio.access_key             ← 加密存储
mindbank.minio.secret_key             ← 加密存储
mindbank.minio.bucket
mindbank.markitdown.url
mindbank.crawl4ai.url
mindbank.obsidian.vault_path
mindbank.obsidian.sub_folder
mindbank.pipeline.auto_session_note   ← boolean，默认 true
```

---

## Phase 6.0：MarkItDown 服务部署（192.168.110.10，前置步骤）

### 目标
在 192.168.110.10 上部署 MarkItDown FastAPI 服务，供 Nexus 后端调用做文件格式转换。

### 服务文件位置
`services/markitdown/`（已包含 `main.py`、`Dockerfile`、`docker-compose.yml`、`requirements.txt`）

### 部署步骤

```bash
# 1. 将 services/markitdown/ 传送到目标机器
scp -r services/markitdown/ user@192.168.110.10:~/nexus-markitdown/

# 2. SSH 登录并启动
ssh user@192.168.110.10
cd ~/nexus-markitdown
docker compose up -d

# 3. 验证
curl http://localhost:3004/health          # → {"status":"ok"}
curl -X POST http://localhost:3004/convert \
  -F "file=@test.pdf" | python3 -m json.tool   # → {markdown, title, length}
```

### 镜像拉取失败（国内限速）处理

Dockerfile 已使用阿里云镜像源（`registry.cn-hangzhou.aliyuncs.com/library/python:3.11-slim`）。若仍报错，配置 Docker daemon 镜像源：

```bash
sudo tee /etc/docker/daemon.json <<'EOF'
{
  "registry-mirrors": [
    "https://docker.mirrors.ustc.edu.cn",
    "https://hub-mirror.c.163.com"
  ]
}
EOF
sudo systemctl daemon-reload && sudo systemctl restart docker
docker compose up -d
```

### 服务信息
- 监听端口：`3004`
- 接口：`POST /convert`（multipart 文件上传 → `{ markdown, title, length }`）
- 健康检查：`GET /health`
- Nexus 后端调用地址：`http://192.168.110.10:3004`（通过 Settings 配置）

---

## Phase 6.1：基础设施层（后端）

### 目标
搭建整个 Phase 6 依赖的后端基础：DB、MinIO SDK、外部服务 Client、KnowledgeBase Port 抽象。

### Maven 依赖（pom.xml）
```xml
<!-- MinIO Java SDK -->
<dependency>
  <groupId>io.minio</groupId>
  <artifactId>minio</artifactId>
  <version>8.5.7</version>
</dependency>
<!-- OkHttp（MinIO SDK 依赖，若未引入需显式声明） -->
<dependency>
  <groupId>com.squareup.okhttp3</groupId>
  <artifactId>okhttp</artifactId>
  <version>4.12.0</version>
</dependency>
```

### Flyway 迁移：V1_16__mindbank_init.sql

```sql
-- Workspace 表（对应 AnythingLLM workspace）
CREATE TABLE mindbank_workspaces (
    id                  BIGSERIAL PRIMARY KEY,
    name                VARCHAR(100) NOT NULL,
    domain_tag          VARCHAR(50),
    anythingllm_slug    VARCHAR(100),
    description         TEXT,
    master_note_path    VARCHAR(500),
    anythingllm_doc_id  VARCHAR(200),
    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 文档记录表（每次通过 Crawl 或 Mindbank 导入的文件）
CREATE TABLE mindbank_documents (
    id                  BIGSERIAL PRIMARY KEY,
    workspace_id        BIGINT REFERENCES mindbank_workspaces(id) ON DELETE SET NULL,
    file_name           VARCHAR(255) NOT NULL,
    source_type         VARCHAR(20) NOT NULL,   -- 'crawl_web' | 'crawl_file'
    original_minio_key  VARCHAR(500) NOT NULL,  -- MinIO key（originals/...）
    processed_minio_key VARCHAR(500),           -- MinIO key（processed/...）
    content_type_tag    VARCHAR(10),            -- Step1: A/B/C/D/E/F
    pipeline_status     VARCHAR(20) NOT NULL DEFAULT 'pending',
    step1_status        VARCHAR(20) NOT NULL DEFAULT 'pending',
    step2_status        VARCHAR(20) NOT NULL DEFAULT 'pending',
    step3_status        VARCHAR(20) NOT NULL DEFAULT 'pending',
    step4_status        VARCHAR(20) NOT NULL DEFAULT 'pending',
    step5_status        VARCHAR(20) NOT NULL DEFAULT 'pending',
    step_error_msg      TEXT,
    session_note_path   VARCHAR(500),
    prompt_template_id  BIGINT,
    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Prompt 模板表
CREATE TABLE mindbank_prompt_templates (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    prompt_type VARCHAR(30) NOT NULL,   -- 'organize_init' | 'organize_merge' | 'session_note' | 'classify_folder'
    content     TEXT NOT NULL,
    is_default  BOOLEAN NOT NULL DEFAULT FALSE,
    is_builtin  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 内置 Prompt 模板初始数据
INSERT INTO mindbank_prompt_templates (name, prompt_type, is_default, is_builtin, content) VALUES
('通用知识整理（初始）', 'organize_init', true, true, '你是专业的知识整理助手。将以下材料整理为结构清晰的知识笔记。\n\n【原则】按知识点逻辑重组，保留所有细节，每个知识点说清楚是什么/为什么重要/怎么用。专业术语保留英文并附中文解释。\n\n【格式】\n# {title}\n\n## 核心主旨\n\n## 知识地图\n\n## {知识点}\n### 定义与概念\n### 核心要点\n### 示例/应用\n\n## 关键结论\n\n## 延伸思考\n\n---\n📎 来源：{source_url}\n🕐 创建：{timestamp}\n🏷 Workspace：{workspace_name}\n📝 v1 — 初始创建'),
('通用知识融合（更新）', 'organize_merge', true, true, '你是专业知识整合助手。将新材料知识融合进已有主笔记。\n\n【已有主笔记】\n{master_note}\n\n【新材料】\n{new_content}\n\n【融合原则】新概念新增章节；补充已有内容；与已有内容矛盾时标注[更新]；不删减已有内容；更新知识地图索引。输出完整更新后笔记。\n\n文尾追加：\n> 📝 本次更新：融合了 {document_name}（{timestamp}），新增/扩展了...'),
('导入速记', 'session_note', true, true, '基于以下材料，生成本次导入速记（300字内）。\n\n【格式】\n## {title} — 导入速记\n**来源：** {document_name}\n**日期：** {date}\n**Workspace：** {workspace_name}\n\n### 核心贡献\n-\n-\n\n### 关键结论\n\n---\n📎 原始：{source_url}\n📖 主笔记：{master_note_path}'),
('文件夹分类', 'classify_folder', true, true, '根据笔记信息选择 Obsidian 子文件夹。\n\n现有文件夹：{existing_folders}\n\nWorkspace：{workspace_name}\n领域：{domain_tag}\n主旨：{summary}\n\n优先匹配现有文件夹，无匹配则建议新名称（中文4字内）。只返回文件夹名。');
```

### 新增文件清单

**Port 接口**
- `backend/src/main/java/com/nexus/port/KnowledgeBasePort.java`
  ```java
  public interface KnowledgeBasePort {
      String createWorkspace(String name, String description);
      String uploadDocument(String workspaceSlug, String content, String filename);
      void deleteDocument(String workspaceSlug, String docId);
      KnowledgeBaseAnswer query(String workspaceSlug, String question);
  }
  // KnowledgeBaseAnswer record { String answer, List<String> sourceUrls }
  ```

**Integration 层**
- `backend/src/main/java/com/nexus/integration/minio/MinioService.java`
  - `uploadFile(String bucket, String key, InputStream data, long size, String contentType)`
  - `downloadAsString(String bucket, String key)`
  - `deleteFile(String bucket, String key)`
  - `listFiles(String bucket, String prefix)` → `List<MinioFileInfo>`
  - 地址/key 从 `SystemConfigService` 读取；AccessKey/SecretKey 通过 `LlmConfigService.decrypt()` 解密

- `backend/src/main/java/com/nexus/integration/anythingllm/AnythingLlmClient.java`
  - 实现 `KnowledgeBasePort`
  - `POST /api/v1/workspaces` 创建 workspace
  - `POST /api/v1/workspace/{slug}/upload-text` 上传文本文档
  - `DELETE /api/v1/workspace/{slug}/remove-embedded` 删除文档
  - `POST /api/v1/workspace/{slug}/chat` 问答
  - 使用 Spring `RestClient`，Bearer Token 从 `SystemConfigService` 读取并 `LlmConfigService.decrypt()` 解密

- `backend/src/main/java/com/nexus/integration/crawl4ai/Crawl4AiClient.java`
  - `POST /crawl` 提交 URL 爬取任务（异步，返回 taskId）
  - `GET /task/{taskId}` 轮询任务状态和结果
  - 地址从 `SystemConfigService` 读取

- `backend/src/main/java/com/nexus/integration/markitdown/MarkItDownClient.java`
  - `POST /convert` 上传 MultipartFile，返回 `{ markdown: String }`
  - 地址从 `SystemConfigService` 读取

**Entity / Mapper**
- `MindBankWorkspace.java`（@TableName("mindbank_workspaces")）
- `MindBankDocument.java`（@TableName("mindbank_documents")）
- `MindBankPromptTemplate.java`（@TableName("mindbank_prompt_templates")）
- `MindBankWorkspaceMapper.java`、`MindBankDocumentMapper.java`、`MindBankPromptTemplateMapper.java`

### 验证
```bash
mise exec java@21 -- mvn -q -pl backend compile
mise exec java@21 -- mvn spring-boot:run -Dspring-boot.run.profiles=local
# 确认 V1_16 migration applied，无启动错误
```

---

## Phase 6.2：Settings Mindbank Tab

### 目标
在 Settings 页面新增 Mindbank Tab，用于配置所有外部服务地址和 AI 模型。

### 后端
- `GET /api/settings/mindbank` — 返回所有 mindbank.* 配置（API Key 脱敏）
- `PUT /api/settings/mindbank` — 批量保存配置（Key 类字段加密存储）
- 在现有 `SettingsController` 或新建 `MindBankSettingsController`

### 前端
- `frontend/src/pages/Settings/` 新增 `MindBankSettingsPanel.tsx`
- 在 `SettingsTab` 联合类型中增加 `'mindbank'`
- 配置分组：
  - **服务地址**：AnythingLLM URL、MinIO URL + Bucket、Crawl4AI URL、MarkItDown URL、Obsidian vault 路径、知识库子文件夹名
  - **认证**：AnythingLLM API Key（密码框）、MinIO Access Key、MinIO Secret Key
  - **AI 模型**：mindbank_classify / mindbank_organize / mindbank_condense（复用现有 WorkflowModelSelect 组件）
  - **流水线行为**：Session Note 触发方式（自动/手动 Toggle）

### 验证
```bash
pnpm build
mise exec java@21 -- mvn -q test
```

---

## Phase 6.3：Crawl 页面

### 目标
完整的内容摄入工作台：网页爬取 + 文件上传转换 + MinIO 文件管理 + 一键导入 Mindbank。

### 后端新增

**CrawlController** (`/api/crawl`)
```
POST /api/crawl/web
  Body: { url: String }
  → 调用 Crawl4AiClient 提交任务（返回 taskId）
  → 轮询直到 done（最长 60s，每 3s 一次）
  → markdown 内容上传 MinIO processed/
  → 原始 HTML 上传 MinIO originals/
  → 返回: { docId, processedMinioKey, markdownPreview }

POST /api/crawl/file
  Body: MultipartFile
  → 原始文件上传 MinIO originals/
  → 调用 MarkItDownClient 转换为 Markdown
  → 上传 MinIO processed/
  → 入库 mindbank_documents（workspace_id=null, pipeline_status='pending'）
  → 返回: { docId, processedMinioKey, markdownPreview }

GET /api/crawl/files
  → 从 mindbank_documents 查 workspace_id IS NULL 的记录
  → 返回列表（含 MinIO key、处理状态、文件名）

DELETE /api/crawl/files/{docId}
  → 删除 MinIO originals + processed 文件
  → 删除 mindbank_documents 记录

POST /api/crawl/import
  Body: { docId: Long, workspaceId: Long }
  → 将 mindbank_documents.workspace_id 设为 workspaceId
  → 触发 MindBankPipelineService.triggerAsync(docId)（@Async）
  → 返回 { success: true }
```

**CrawlService** — 编排 Crawl4AiClient + MarkItDownClient + MinioService

### 前端

**页面结构**
```
frontend/src/pages/Crawl/
├── index.tsx（路由入口，加载状态管理）
├── crawl.api.ts（API 调用）
├── crawl.types.ts（类型定义）
├── CrawlDesktopView.tsx
├── CrawlMobileView.tsx
└── components/
    ├── WebCrawlTab.tsx     （URL 输入框 + 爬取按钮 + Markdown 预览）
    ├── FileUploadTab.tsx   （拖拽上传 + Markdown 预览）
    ├── MinioFileList.tsx   （文件列表：文件名/状态/日期/删除/导入）
    └── ImportToMindbank.tsx（Workspace 选择弹窗）
```

**关键交互**
- Tab 切换：网页爬取 / 文件上传
- 爬取/上传后展示 Markdown 预览（收起/展开）
- 文件列表分为"未导入"和"已导入"两组
- 导入弹窗：下拉选择已有 Workspace，或新建 Workspace（跳转 Mindbank）
- 导入后状态变为"处理中"，可跳转到 Mindbank 查看进度

### 验证
```bash
pnpm build
mise exec java@21 -- mvn -q test
# 手动测试：输入一个公开 URL → 预览 Markdown → 存入 MinIO
# 手动测试：上传一个 PDF → 预览转换结果
```

---

## Phase 6.4：Notes 页面

### 目标
Obsidian vault 的浏览器端轻量编辑器，支持文件树、Markdown 编辑/预览、文件操作。

### NPM 依赖
```bash
pnpm add @uiw/react-md-editor
pnpm approve-builds  # 若有 postinstall 脚本
```

### 后端新增

**NotesController** (`/api/notes`)
```
GET  /api/notes/tree
  → 递归读取 vault 目录（深度最大 10 层）
  → 只返回 .md 文件和目录
  → 返回树结构: { name, path, type: 'file'|'folder', children? }

GET  /api/notes/file?path={relativePath}
  → 读取文件内容，返回 { content: String }

PUT  /api/notes/file
  Body: { path: String, content: String }
  → 写入文件

POST /api/notes/file
  Body: { path: String }
  → 创建空文件（若父目录不存在则创建）

POST /api/notes/folder
  Body: { path: String }
  → 创建目录

PUT  /api/notes/rename
  Body: { oldPath: String, newPath: String }
  → Files.move

DELETE /api/notes/file?path={relativePath}
  → 删除文件

DELETE /api/notes/folder?path={relativePath}
  → 递归删除目录（需前端先二次确认）
```

**安全约束（NotesService）**
```java
// 所有路径操作前强制校验
private Path resolveSafePath(String relativePath) {
    Path vaultRoot = Path.of(getVaultPath());
    Path resolved = vaultRoot.resolve(relativePath).normalize();
    if (!resolved.startsWith(vaultRoot)) {
        throw new IllegalArgumentException("路径越界");
    }
    return resolved;
}
```

**NotesService** — 封装文件系统操作，vault 路径从 `SystemConfigService.get("mindbank.obsidian.vault_path")` 读取

### 前端

**页面结构**
```
frontend/src/pages/Notes/
├── index.tsx（加载 vault 树，管理选中文件状态）
├── notes.api.ts
├── notes.types.ts（FileTreeNode 类型）
├── NotesDesktopView.tsx（左侧树 + 右侧编辑器，两列布局）
├── NotesMobileView.tsx（编辑器全屏，文件树为底部 Sheet）
└── components/
    ├── NotesFileTree.tsx（递归文件树，支持展开/折叠/搜索）
    ├── FileTreeNode.tsx（单节点，右键菜单：重命名/删除）
    ├── NotesEditor.tsx（@uiw/react-md-editor + 工具栏）
    └── FileNameDialog.tsx（新建/重命名文件/文件夹弹窗）
```

**关键交互**
- 文件树：点击 `.md` 文件加载到编辑器
- 编辑器工具栏：文件路径面包屑 + 保存状态（"已保存" / "有未保存改动"）+ 模式切换（编辑/预览/分栏）
- Ctrl+S 触发保存
- 新建文件：输入文件名，在当前选中目录下创建
- 删除目录时展示二次确认气泡（含"此操作将删除所有子文件"警告）
- 文件树搜索实时过滤（按文件名前缀匹配）

### 验证
```bash
pnpm build
mise exec java@21 -- mvn -q test
# 手动测试：打开已有 Obsidian vault 路径，浏览文件树，编辑保存
```

---

## 架构升级说明（Phase 6.5+ 适用）

> 参考文档：`docs/nexus-mindbank-pipeline-agent-design.md`（Pipeline + Agent 双层架构设计）

Phase 6.5 起，Mindbank 采用**双层架构**：

1. **Layer 0 — 共享能力层（Port 接口）**：将外部依赖（AnythingLLM、Obsidian vault、MinIO）抽象为 Port 接口，Pipeline 和 Agent 共用，不重复造轮子。
2. **Layer 1 — 入库 Pipeline（确定性）**：高频、稳定、无人值守的 5 步流水线。Step 2 初期用单次 Prompt，后续可选接入 Agent A。
3. **Layer 2 — Agent 知识运维层（非确定性）**：低频、需判断、有人审批的知识库巡检与维护。用 LangChain4j 自建 Agent loop。

**核心原则**：确定的事走 Pipeline，需要判断的事走 Agent。先 Pipeline 跑稳，再接 Agent。

**Mindbank 页面 Tab 结构调整**（原"文档库/问答/笔记"→ 新"文件/入库 · Q&A · Agent 知识管家"）：
- 笔记浏览复用 Nexus 已有的全局 Notes 页面，不在 Mindbank 内重复
- Agent 子 Tab 为巡检建议、审批、执行轨迹的入口

---

## Phase 6.5：Port 抽象层 + Mindbank 核心页面

### 目标
搭建 Layer 0 Port 抽象 + Mindbank 页面核心 UI（Workspace CRUD、文档管理、文件导入），为后续 Pipeline 和 Agent 提供地基。

### 后端 — Port 抽象层

**新增 Port 接口**

`backend/src/main/java/com/nexus/port/NotePort.java`
```java
/**
 * Obsidian vault 笔记读写端口，供 Pipeline（Step4 写笔记）和 Agent（巡检读笔记）共用。
 * 与 NotesService（前端 Notes 页面的文件 CRUD）职责不同：NotePort 专注 Mindbank 的 Master/Session Note 操作。
 */
public interface NotePort {
    String readMaster(String workspaceName);
    void writeMaster(String workspaceName, String subFolder, String content);
    void appendSession(String workspaceName, String subFolder, String content, String date);
    List<NoteMeta> listNotes();
    String readIndex(String subFolder);
    void appendIndex(String subFolder, String entry);
}
// NoteMeta record: { name, path, sizeBytes, lastModified }
```

`backend/src/main/java/com/nexus/port/StoragePort.java`
```java
/**
 * 文件存储端口，隔离 MinIO 实现细节。Pipeline 和 Agent 通过此接口读写文件。
 */
public interface StoragePort {
    String readProcessed(String key);
    void putProcessed(String key, String markdown);
    void putOriginal(String key, byte[] data, String contentType);
    void delete(String key);
    List<FileMeta> list(String prefix);
}
// FileMeta record: { key, size, lastModified }
```

**新增 Adapter 实现**

`backend/src/main/java/com/nexus/adapter/note/ObsidianNoteAdapter.java`
- 实现 `NotePort`
- vault 路径从 `SystemConfigService.get("notes.obsidian.vault_path")` 读取
- readMaster：读取 `{vault}/{subFolder}/{workspaceSafeName}__master.md`
- writeMaster：覆盖写入 Master Note，自动创建目录
- appendSession：新建 `{workspaceSafeName}__session__{date}.md`
- listNotes：递归扫描 vault 目录，返回 `.md` 文件的元信息列表
- readIndex / appendIndex：读写 `{subFolder}/_index.md`
- 路径安全校验复用 NotesService 的 `resolveSafePath` 模式

`backend/src/main/java/com/nexus/adapter/storage/MinioStorageAdapter.java`
- 实现 `StoragePort`
- 委托已有 `MinioService` 完成实际操作
- bucket 从 `SystemConfigService` 读取

**扩展已有 Port**

`KnowledgeBasePort` 新增方法（供 Agent C 未来使用）：
```java
KnowledgeBaseAnswer queryMultiple(List<String> workspaceSlugs, String question);
```

### 后端 — Workspace CRUD

扩展已有只读 `MindBankWorkspaceController`（`/api/v1/mindbank/workspaces`），新增 `MindBankWorkspaceService`：
- `list()` — 查询所有 workspace，按 domain_tag 分组
- `create(req)` — 创建 DB + 调用 `KnowledgeBasePort.createWorkspace()`，slug 保存；调用失败不回滚，slug 留空后续可重试
- `update(id, req)` — 更新 name/domainTag/description
- `delete(id)` — 删除 DB 记录（不删除 AnythingLLM workspace，避免意外丢失向量数据）

Controller 新增：POST / PUT /{id} / DELETE /{id}

`WorkspaceResponse`（DTO）：id, name, domainTag, description, anythingllmSlug, masterNotePath, documentCount, createdAt

### 后端 — Document 接口

新增 `MindBankDocumentService`：
- `listByWorkspace(workspaceId)` — 查询指定 workspace 下所有文档
- `getStatus(docId)` — 返回文档 5 步流水线状态
- `retryStep(docId, step)` — 重置该步骤及后续为 pending（Pipeline 实际执行在 Phase 6.6 接入）

新增 `MindBankDocumentController`（`/api/v1/mindbank/documents`）：
- GET `?workspaceId={id}` / GET `/{id}/status` / POST `/{id}/retry-step`

### 前端 — Mindbank 页面

**文件结构**
```
frontend/src/pages/Mindbank/
  index.tsx（替换现有占位页）
  mindbank.api.ts
  mindbank.types.ts
  MindBankDesktopView.tsx
  MindBankMobileView.tsx
  components/
    WorkspaceList.tsx         ← 左侧 Workspace 列表（domainTag 分组）
    WorkspaceCard.tsx
    WorkspaceDialog.tsx       ← 新建/编辑弹窗
    DocumentList.tsx          ← 文档列表
    DocumentCard.tsx          ← 含 PipelineStatus
    PipelineStatus.tsx        ← 5 步状态可视化
    MinioFilePicker.tsx       ← 选择 Crawl 文件弹窗
```

**Tab 结构（新架构）**
```typescript
type MindBankTab = 'documents' | 'qa' | 'agent'
// Tab 标签：文件/入库 · Q&A · Agent 知识管家
// Q&A 和 Agent Tab 本阶段占位："即将推出"
```

**关键组件**
- WorkspaceList：按 domainTag 分组，选中高亮，底部新建按钮
- DocumentCard + PipelineStatus：5 步状态（pending 灰点 / processing spinner / done 绿勾 / failed 红叉+tooltip），processing 时 3s 轮询
- MinioFilePicker：展示 Crawl 未分配文件，选定后调用 `POST /api/crawl/import`

### 验证
```bash
pnpm build
mise exec java@21 -- mvn -q test
# 手动测试：新建 Workspace → 选文件 → 触发导入（pipeline 未实现，文档停在 pending）
```

---

## Phase 6.6：5 步确定性 Pipeline + Q&A 基础 + Prompt 模板

### 目标
实现 Layer 1 完整闭环——5 步异步 Pipeline、基础 Q&A 问答、Prompt 模板管理。Step 2 使用单次 Prompt（不接 Agent A），Pipeline 通过 Port 接口操作外部系统。

### 后端 — @Async 配置

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

### 后端 — MindBankPipelineService

**依赖注入 Port 接口**（不直接依赖 MinioService / NotesService）：
```java
@Service
public class MindBankPipelineService {
    private final StoragePort storagePort;
    private final NotePort notePort;
    private final KnowledgeBasePort knowledgeBasePort;
    private final LlmConfigService llmConfigService;
    private final MindBankDocumentMapper documentMapper;
    private final MindBankWorkspaceMapper workspaceMapper;
    private final MindBankPromptTemplateMapper promptTemplateMapper;
    private final SystemConfigService systemConfigService;

    @Async("mindBankPipelineExecutor")
    public void triggerAsync(Long documentId) { ... }
    public void retryStep(Long documentId, int step) { ... }
}
```

**Step 1 — 内容类型识别**
- `StoragePort.readProcessed()` 读取 Markdown 前 500 字
- workflowType=mindbank_classify 调用 LLM，返回 A~F 分类
- 保存 content_type_tag

**Step 2 — AI 整理 → Master Note**（单次 Prompt，不接 Agent A）
- 判断 Workspace 是否已有 Master Note：`NotePort.readMaster()` 是否返回内容
- 无 Master Note：organize_init 模板；有：organize_merge 模板
- 长文档分块策略：>12000 字符时按段落分块，每块 ≤4000 字符
- workflowType=mindbank_organize
- 结果缓存供 Step 3/4 使用

**Step 3 — Session Note 生成**
- 读取 `mindbank.pipeline.auto_session_note`，false 则跳过
- session_note 模板 + workflowType=mindbank_condense
- 结果缓存供 Step 4 使用

**Step 4 — 写入 Obsidian vault**（通过 NotePort）
- classify_folder Prompt 获取 AI 建议子文件夹名
- `NotePort.writeMaster()` 覆盖写 Master Note
- `NotePort.appendSession()` 追加 Session Note
- `NotePort.appendIndex()` 更新索引
- 更新 DB 中 masterNotePath / sessionNotePath

**Step 5 — 更新 AnythingLLM Embedding**（通过 KnowledgeBasePort）
- 删除旧 embedding → 读取最新 Master Note → 上传新 embedding
- 保存新 docId

### 后端 — CrawlService 接线

取消 `CrawlService.importToWorkspace` 中的 pipeline 触发 TODO：
```java
mindBankPipelineService.triggerAsync(docId);
```

### 后端 — Q&A 接口

`MindBankQaController`（`/api/v1/mindbank/qa`）：
```
POST /api/v1/mindbank/qa/{workspaceId}/chat
  Body: { question: String }
  → 查询 workspace.anythingllm_slug
  → KnowledgeBasePort.query(slug, question)
  → 返回: { answer, sources }
```

### 后端 — 笔记查看接口

`MindBankWorkspaceController` 扩展：
```
GET /api/v1/mindbank/workspaces/{id}/master-note
  → NotePort.readMaster(workspace.name) → { content, path, lastModified }

GET /api/v1/mindbank/workspaces/{id}/session-notes
  → 查询 mindbank_documents.session_note_path → 读取文件列表
```

### 后端 — Prompt 模板 CRUD

`MindBankPromptTemplateController`（`/api/v1/mindbank/prompt-templates`）：
- GET ?type={type} / POST / PUT /{id} / DELETE /{id}
- 内置模板（is_builtin=true）不可编辑删除

### 前端 — Q&A 视图

`MindBankQaView.tsx`：
- 复用 Chat 页面的 MessageBubble 组件（react-markdown 渲染）
- AI 回答下方展示来源引用卡片（chunk 前 100 字 + MinIO 链接）
- 本地 useState 管理消息列表（不持久化到 DB）
- 非流式（AnythingLLM 同步返回），等待期间 loading spinner

### 前端 — Prompt 模板管理

MindBankSettingsPanel 扩展：
- 按 promptType 分组展示（organize_init / organize_merge / session_note / classify_folder）
- 内置模板可查看不可改，展示"内置"badge
- 自定义模板支持 CRUD + 设为默认
- 编辑弹窗含变量占位符提示

### 前端 — Tab 完整接线

```typescript
type MindBankTab = 'documents' | 'qa' | 'agent'
{activeTab === 'documents' && <DocumentList ... />}
{activeTab === 'qa' && <MindBankQaView workspace={workspace} />}
{activeTab === 'agent' && <AgentPlaceholder />}  // Phase 6.7 实现
```

### 验证
```bash
pnpm build
mise exec java@21 -- mvn -q test
# 端到端：Crawl 上传 → Mindbank 导入 → 5 步状态流转 → Obsidian 笔记生成 → Q&A 问答
```

---

## Phase 6.7：Agent 基础设施 + Agent B 知识库巡检

### 目标
实现 Layer 2 第一个 Agent——知识库巡检（只读 + 建议），同时搭建完整的 Agent 基础设施（loop、工具、状态落库、轨迹可视化）。

### 架构依据
> Agent B 是只读 Agent，出错不破坏知识库数据。用它练手搭建整套 Agent 基础设施是最安全的路径。
> 详见 `docs/nexus-mindbank-pipeline-agent-design.md` 第 6.3 + 第 9 节。

### Flyway 迁移：V1_20__mindbank_agent.sql

```sql
-- Agent 任务表（巡检/融合任务的执行记录）
CREATE TABLE mindbank_agent_tasks (
    id              BIGSERIAL PRIMARY KEY,
    agent_type      VARCHAR(30) NOT NULL,    -- 'inspect' | 'merge_check' | 'qa'
    trigger_type    VARCHAR(20) NOT NULL,    -- 'manual' | 'auto'
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending/running/awaiting_approval/done/failed
    workspace_id    BIGINT REFERENCES mindbank_workspaces(id) ON DELETE SET NULL,
    summary         TEXT,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Agent 执行步骤表（agent loop 每一步，用于轨迹可视化 + 中断恢复）
CREATE TABLE mindbank_agent_steps (
    id              BIGSERIAL PRIMARY KEY,
    task_id         BIGINT NOT NULL REFERENCES mindbank_agent_tasks(id) ON DELETE CASCADE,
    step_index      INT NOT NULL,
    thought         TEXT,
    tool_called     VARCHAR(100),
    tool_input      JSONB,
    tool_output     JSONB,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Agent 建议表（Agent B 巡检产出，等用户审批）
CREATE TABLE mindbank_agent_suggestions (
    id              BIGSERIAL PRIMARY KEY,
    task_id         BIGINT NOT NULL REFERENCES mindbank_agent_tasks(id) ON DELETE CASCADE,
    suggestion_type VARCHAR(40) NOT NULL,    -- split_note/merge_workspace/resplit_workspace/fix_index/orphan_note
    description     TEXT NOT NULL,
    affected_notes  JSONB,
    proposed_action JSONB,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending/accepted/ignored
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### 后端 — Entity / Mapper

新增 `MindBankAgentTask`、`MindBankAgentStep`、`MindBankAgentSuggestion` + 对应 Mapper

### 后端 — Agent 工具（@Tool 注解，基于 Port 包装）

```java
/**
 * Agent 的"手脚"：将 Port 方法包装为 LangChain4j @Tool，供 Agent loop 调用。
 */
@Component
public class MindBankAgentTools {
    private final NotePort notePort;
    private final KnowledgeBasePort knowledgeBasePort;
    private final MindBankWorkspaceMapper workspaceMapper;

    @Tool("列出 Obsidian vault 中所有笔记的元信息（文件名、路径、大小、最后修改时间）")
    public List<NoteMeta> listAllNotes() { return notePort.listNotes(); }

    @Tool("读取指定 Workspace 的 Master Note 全文")
    public String readMasterNote(String workspaceName) { return notePort.readMaster(workspaceName); }

    @Tool("读取知识库全局索引")
    public String readIndex() { ... }

    @Tool("列出所有 Workspace 的基本信息（名称、领域标签、文档数、Master Note 路径）")
    public List<WorkspaceSummary> listWorkspaces() { ... }

    @Tool("在指定 Workspace 的知识库中搜索内容，用于判断内容重叠度")
    public String searchKnowledgeBase(String workspaceSlug, String query) {
        return knowledgeBasePort.query(workspaceSlug, query).answer();
    }
}
```

### 后端 — Agent B 巡检服务

```java
/**
 * 知识库巡检 Agent：扫描整个知识库，自主发现体系性问题，产出结构化建议等待用户审批。
 * 基于 LangChain4j AiServices 构建 agent loop，@Tool 方法由 MindBankAgentTools 提供。
 */
@Service
public class MindBankInspectAgent {

    interface InspectAssistant {
        String chat(String userMessage);
    }

    @Async("mindBankPipelineExecutor")
    public void runInspection(Long taskId) {
        // 1. 更新 task status → running
        // 2. 构建 AiServices（ChatLanguageModel + tools + memory）
        // 3. 调用 assistant.chat(SYSTEM_PROMPT + 巡检指令)
        // 4. 拦截每次 tool 调用 → 记录 mindbank_agent_steps
        // 5. 解析最终输出中的结构化建议 JSON → 写入 mindbank_agent_suggestions
        // 6. 更新 task status → awaiting_approval
    }
}
```

**Agent B 系统提示词核心**：
- 角色：Nexus Mindbank 知识库巡检助手
- 问题类型：split_note / merge_workspace / resplit_workspace / fix_index / orphan_note
- 可用工具：listAllNotes、readMasterNote、readIndex、listWorkspaces、searchKnowledgeBase
- 输出格式：JSON 数组 `[{ type, description, affected, action }]`
- 约束：只读不改，只提建议

### 后端 — Agent Controller

`MindBankAgentController`（`/api/v1/mindbank/agent`）：
```
POST /inspect                     → 触发巡检（创建 task → @Async 执行）
GET  /tasks                       → 查询巡检历史列表
GET  /tasks/{id}                  → 查询单次巡检详情（含 steps + suggestions）
POST /suggestions/{id}/approve    → 采纳建议
POST /suggestions/{id}/ignore     → 忽略建议
```

### 前端 — Agent 知识管家 Tab

**文件结构**
```
frontend/src/pages/Mindbank/components/
  AgentTab.tsx                ← Agent Tab 入口
  InspectionReport.tsx        ← 巡检报告（建议卡片列表）
  SuggestionCard.tsx          ← 单条建议（类型标签 + 描述 + [采纳] [忽略]）
  AgentTraceView.tsx          ← 执行轨迹（逐步：思考 → 工具调用 → 结果）
  InspectionHistory.tsx       ← 历史巡检时间线
```

**关键交互**
- "巡检知识库"按钮 → POST /inspect → 轮询 task 状态（3s）
- 巡检完成（status=awaiting_approval）→ 展示建议卡片列表
- 每条建议卡片：问题类型 chip + 描述 + 涉及笔记列表 + [采纳] [忽略]
- 执行轨迹：Collapsible 区域，逐步展示 thought / tool_called / tool_output
- "在 Notes 页查看"链接：navigate('/notes', { state: { filePath } })
- 历史巡检：按时间倒序展示

### 验证
```bash
pnpm build
mise exec java@21 -- mvn -q test
# 手动测试（需至少 2 个 Workspace 已完成 Pipeline）：
# Mindbank → Agent Tab → 巡检知识库 → 观察执行轨迹 → 审批建议
```

---

## Phase 6.8（可选/未来）：Agent A 融合自检 + Agent C 检索增强

> 基础设施已在 Phase 6.7 验证，此阶段按需推进。

**Agent A — 融合自检**
- 接入 Pipeline Step 2，当 Master Note 已存在且新材料 >1500 token 时调用
- 多轮自检：抽取知识点 → 判断与现有内容关系 → 生成新版 → 自检 → 修正（最多 3 轮）
- 每轮落 mindbank_agent_steps 表

**Agent C — Q&A agentic 检索**
- 替换 Phase 6.6 的固定单 Workspace 查询
- Agent 自主判断：查哪几个 Workspace、是否追溯原始文件、答不上来时建议补充材料
- 升级 MindBankQaView 展示 Agent 思考过程

---

## 导航更新（所有阶段完成后）

**桌面侧边栏**：Crawl / Notes / Mindbank 三项导航（Phase 6.1-6.3 已就位）。

**移动端底部 More Sheet**：已有 Crawl / Mindbank 入口，Notes 入口在 Phase 6.3 已添加。

---

## 整体验证（Phase 6.7 完成后）

```bash
# 1. 后端全量测试
mise exec java@21 -- mvn -q test

# 2. 前端构建
pnpm build

# 3. 端到端流程验证
# Crawl: URL → MinIO → 预览
# Crawl: PDF 上传 → MarkItDown 转换 → MinIO → 预览
# Crawl → Mindbank: 导入 → 5 步 Pipeline → Obsidian 笔记生成 → AnythingLLM embedding
# Mindbank Q&A: 提问 → 回答 + 引用
# Mindbank Agent: 巡检 → 执行轨迹 → 建议审批
# Notes: 文件树 → 编辑 → 保存 → 验证
```

---

## 文件改动总览（Phase 6.5-6.7）

### 后端新增文件
```
backend/src/main/resources/db/migration/
  V1_20__mindbank_agent.sql                              ← Phase 6.7

backend/src/main/java/com/nexus/
  port/NotePort.java                                     ← Phase 6.5
  port/StoragePort.java                                  ← Phase 6.5
  adapter/note/ObsidianNoteAdapter.java                  ← Phase 6.5
  adapter/storage/MinioStorageAdapter.java                ← Phase 6.5
  dto/response/WorkspaceResponse.java                    ← Phase 6.5
  dto/response/DocumentResponse.java                     ← Phase 6.5
  service/MindBankWorkspaceService.java                  ← Phase 6.5
  service/MindBankDocumentService.java                   ← Phase 6.5
  service/MindBankPipelineService.java                   ← Phase 6.6
  controller/MindBankDocumentController.java             ← Phase 6.5
  controller/MindBankQaController.java                   ← Phase 6.6
  controller/MindBankPromptTemplateController.java       ← Phase 6.6
  entity/MindBankAgentTask.java                          ← Phase 6.7
  entity/MindBankAgentStep.java                          ← Phase 6.7
  entity/MindBankAgentSuggestion.java                    ← Phase 6.7
  mapper/MindBankAgentTaskMapper.java                    ← Phase 6.7
  mapper/MindBankAgentStepMapper.java                    ← Phase 6.7
  mapper/MindBankAgentSuggestionMapper.java              ← Phase 6.7
  service/MindBankAgentTools.java                        ← Phase 6.7
  service/MindBankInspectAgent.java                      ← Phase 6.7
  controller/MindBankAgentController.java                ← Phase 6.7
```

### 前端新增文件
```
frontend/src/pages/
  Mindbank/mindbank.api.ts                               ← Phase 6.5
  Mindbank/mindbank.types.ts                             ← Phase 6.5
  Mindbank/MindBankDesktopView.tsx                       ← Phase 6.5
  Mindbank/MindBankMobileView.tsx                        ← Phase 6.5
  Mindbank/components/WorkspaceList.tsx                  ← Phase 6.5
  Mindbank/components/WorkspaceCard.tsx                  ← Phase 6.5
  Mindbank/components/WorkspaceDialog.tsx                ← Phase 6.5
  Mindbank/components/DocumentList.tsx                   ← Phase 6.5
  Mindbank/components/DocumentCard.tsx                   ← Phase 6.5
  Mindbank/components/PipelineStatus.tsx                 ← Phase 6.5
  Mindbank/components/MinioFilePicker.tsx                ← Phase 6.5
  Mindbank/components/MindBankQaView.tsx                 ← Phase 6.6
  Mindbank/components/AgentTab.tsx                       ← Phase 6.7
  Mindbank/components/InspectionReport.tsx               ← Phase 6.7
  Mindbank/components/SuggestionCard.tsx                 ← Phase 6.7
  Mindbank/components/AgentTraceView.tsx                 ← Phase 6.7
  Mindbank/components/InspectionHistory.tsx              ← Phase 6.7
```

### 前端修改文件
```
frontend/src/pages/Mindbank/index.tsx                    ← Phase 6.5 替换占位页
frontend/src/pages/Settings/components/MindBankSettingsPanel.tsx  ← Phase 6.6 扩展 Prompt 模板
```
GET    /api/mindbank/workspaces
POST   /api/mindbank/workspaces   Body: { name, domainTag, description }
          → 同时调用 AnythingLlmClient.createWorkspace()，保存 slug
PUT    /api/mindbank/workspaces/{id}
DELETE /api/mindbank/workspaces/{id}
          → 同时调用 AnythingLLM 删除 workspace（可选，提示用户）
```

**MindBankDocumentController** (`/api/mindbank/documents`)
```
GET  /api/mindbank/documents?workspaceId={id}  → 查询该 workspace 下所有文档
GET  /api/mindbank/documents/{id}/status       → 查询单文档流水线状态（前端轮询）
POST /api/mindbank/documents/{id}/retry-step   Body: { step: int }
          → 重跑指定步骤（step 1-5）
```

**MindBankPipelineService**（核心，详见 Phase 6.6）

### 前端

**页面结构**
```
frontend/src/pages/Mindbank/
├── index.tsx
├── mindbank.api.ts
├── mindbank.types.ts
├── MindBankDesktopView.tsx
├── MindBankMobileView.tsx
└── components/
    ├── WorkspaceList.tsx（左侧/顶部列表，领域标签分组，新建按钮）
    ├── WorkspaceCard.tsx（名称/描述/文档数/领域 Tag，支持删除）
    ├── WorkspaceDialog.tsx（新建/编辑 Workspace 弹窗）
    ├── DocumentList.tsx（当前 Workspace 下的文档列表）
    ├── DocumentCard.tsx（文件名/状态/流水线步骤进度条）
    ├── PipelineStatus.tsx（5 步状态可视化：Step1-5，每步 pending/processing/done/failed）
    └── MinioFilePicker.tsx（从 MinIO 选文件弹窗，选择后分配到当前 Workspace）
```

**关键交互**
- 左侧 Workspace 列表，点击进入 Workspace 详情
- Workspace 详情显示：文档列表 + 每个文档的流水线状态
- "选择文件"按钮打开 MinioFilePicker（展示 Crawl 页面上传的文件）
- 选定文件后可指定 Prompt 模板（默认使用 default 模板），点击"开始处理"
- 流水线状态每 3s 轮询一次 `/status` 接口，完成后停止轮询
- 每步状态：灰色圆点（pending）/ 旋转动画（processing）/ 绿勾（done）/ 红叉+错误文本（failed）
- failed 状态展示"重试此步骤"按钮

### 验证
```bash
pnpm build
mise exec java@21 -- mvn -q test
# 手动测试：新建 Workspace → 选择 MinIO 文件 → 查看流水线状态轮询
```

---

## Phase 6.6：AI 处理流水线

### 目标
实现 5 步异步 AI 处理流水线，每步独立状态，可单步重试。

### 核心服务：MindBankPipelineService

```java
@Service
public class MindBankPipelineService {

    // 入口：@Async 异步触发（不阻塞 HTTP 请求）
    @Async
    public void triggerAsync(Long documentId) {
        runStep(documentId, 1, this::step1Classify);
        runStep(documentId, 2, this::step2Organize);
        runStep(documentId, 3, this::step3SessionNote);
        runStep(documentId, 4, this::step4WriteObsidian);
        runStep(documentId, 5, this::step5Embed);
    }

    // 单步重试入口
    public void retryStep(Long documentId, int step) { ... }

    private void runStep(Long documentId, int step, Runnable task) {
        updateStepStatus(documentId, step, "processing");
        try {
            task.run();
            updateStepStatus(documentId, step, "done");
        } catch (Exception e) {
            updateStepStatus(documentId, step, "failed", e.getMessage());
            throw e; // 终止后续步骤
        }
    }
}
```

### Step 1：内容类型识别

```java
private void step1Classify(Long docId) {
    // 1. 从 MinIO 读取 processed Markdown 内容（前 500 字）
    // 2. 使用 workflowType=mindbank_classify 调用 LLM
    // 3. Prompt 从 mindbank_prompt_templates 读取 classify_folder 模板（此处复用分类逻辑）
    //    实际用系统内置简单判断 Prompt：返回 A/B/C/D/E/F
    // 4. 保存 content_type_tag 到 mindbank_documents
}
```

### Step 2：AI 整理 → 更新 Master Note

```java
private void step2Organize(Long docId) {
    // 1. 从 MinIO 读取 processed 文件完整内容
    //    → 若超过 3000 token：按段落分块，每块单独整理后合并（分块阈值可配置）
    // 2. 判断当前 Workspace 是否已有 Master Note（master_note_path 非空）
    //    → 无：使用 organize_init 模板
    //    → 有：读取现有 Master Note 内容，使用 organize_merge 模板
    // 3. 使用 workflowType=mindbank_organize 调用 LLM
    // 4. 用 classify_folder Prompt 获取 AI 建议的 Obsidian 子文件夹名（Step4 用）
    //    → 保存到临时字段或内存传递到 Step4
    // 注意：此步只生成内容，不写文件（写文件在 Step4）
    //       生成的 Master Note 内容存入内存/Redis 缓存供 Step3/4 使用
}
```

### Step 3：AI 生成 Session Note

```java
private void step3SessionNote(Long docId) {
    // 读取 settings：mindbank.pipeline.auto_session_note
    // 若为 false：跳过此步（直接标记 done）
    // 否则：
    // 1. 使用 processed 文件内容
    // 2. 使用 workflowType=mindbank_condense 调用 LLM（session_note 模板）
    // 3. 生成 Session Note 内容存缓存供 Step4 使用
}
```

### Step 4：写入 Obsidian Vault

```java
private void step4WriteObsidian(Long docId) {
    // 1. 读取 vault 根路径和子文件夹配置
    // 2. 创建/更新文件夹：vault/{sub_folder}/{AI建议子文件夹}/
    // 3. 写入 Master Note：{workspace_name}__master.md（覆盖）
    // 4. 写入 Session Note：{workspace_name}__session__{date}.md（追加，新建文件）
    // 5. 更新 _index.md（追加一条记录，若不存在则创建）
    // 6. 更新 mindbank_workspaces.master_note_path
    // 7. 更新 mindbank_documents.session_note_path
}
```

### Step 5：更新 AnythingLLM Embedding

```java
private void step5Embed(Long docId) {
    // 1. 若 mindbank_workspaces.anythingllm_doc_id 非空：
    //    → 调用 AnythingLlmClient.deleteDocument() 删除旧 embedding
    // 2. 读取最新 Master Note 文件内容
    // 3. 调用 AnythingLlmClient.uploadDocument() 上传新 Master Note
    // 4. 保存新 doc_id 到 mindbank_workspaces.anythingllm_doc_id
}
```

### @Async 配置
```java
// 在 NexusApplication 或独立 @Configuration 类上添加
@EnableAsync
// 配置线程池（可选，防止 pipeline 占满默认线程池）
@Bean
public Executor mindBankPipelineExecutor() {
    ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
    executor.setCorePoolSize(2);
    executor.setMaxPoolSize(5);
    executor.setThreadNamePrefix("mindbank-pipeline-");
    executor.initialize();
    return executor;
}
```

### 验证
```bash
mise exec java@21 -- mvn -q test
# 手动端到端测试：上传一个 PDF → Crawl 导入 MinIO → Mindbank 选文件 → 
# 点击处理 → 观察 5 步状态流转 → 验证 Obsidian 文件已生成 → 验证 AnythingLLM 已 embedding
```

---

## Phase 6.7：Q&A + Prompt 模板管理

### 目标
Workspace Q&A 问答界面（复用 Chat 组件）、笔记查看器、Settings Prompt 模板管理。

### 后端新增

**MindBankQaController** (`/api/mindbank/qa`)
```
POST /api/mindbank/qa/{workspaceId}/chat
  Body: { question: String }
  → 调用 AnythingLlmClient.query(workspace.anythingllm_slug, question)
  → 返回: { answer, sources: [{ chunkText, minioOriginalUrl }] }
```

**MindBankPromptTemplateController** (`/api/mindbank/prompt-templates`)
```
GET    /api/mindbank/prompt-templates?type={type}
POST   /api/mindbank/prompt-templates
PUT    /api/mindbank/prompt-templates/{id}
DELETE /api/mindbank/prompt-templates/{id}  （内置模板不可删除）
```

**NotesController 新增** — Master Note 查看接口
```
GET /api/mindbank/workspaces/{id}/master-note
  → 读取 mindbank_workspaces.master_note_path 对应文件
  → 返回 { content: String }（供 Mindbank 笔记查看器使用）
```

### 前端

**Q&A 页面（Mindbank 内嵌 Tab）**
```
MindBankQaView.tsx
├── 顶部：Workspace 名称 + "当前知识库"说明文字
├── 消息列表（复用 Chat 页的 MessageBubble 组件，含 Markdown 渲染）
├── 来源引用卡片（每条 AI 回答下方展示引用来源，含原始文件 MinIO 链接）
└── 输入框（复用 ChatInputBar 组件）
```

**笔记查看器（Mindbank 内嵌 Tab）**
```
MindBankNotesView.tsx
├── Master Note 内容（react-markdown 渲染，只读）
├── Session Notes 列表（按时间倒序，可展开内容）
└── "在 Notes 页编辑" 跳转按钮（带文件路径参数）
```

**Prompt 模板管理（Settings Mindbank Tab 内）**
- 按 prompt_type 分组展示内置模板（可查看但不可删除）
- 用户自定义模板：新建/编辑/删除
- 编辑器使用普通 `<textarea>`，提供变量占位符提示（`{content}` 等）

### Mindbank 页面最终 Tab 结构
```
Mindbank 页面
├── Tab: 文档库（DocumentList + PipelineStatus）
├── Tab: 问答（MindBankQaView）
└── Tab: 笔记（MindBankNotesView）
```

### 验证
```bash
pnpm build
mise exec java@21 -- mvn -q test
# 手动测试：在已 embedding 的 Workspace 里提问 → 收到回答 + 来源引用
# 手动测试：查看 Master Note 渲染效果
```

---

## 导航更新（所有阶段完成后）

**桌面侧边栏** 新增三项导航：
- Crawl（已存在，补完功能）
- Notes（新增）
- Mindbank（已存在，补完功能）

**移动端底部 More Sheet** 已有 Crawl / Mindbank 入口，补充 Notes 入口。

---

## 整体验证（Phase 6 完成后）

```bash
# 1. 后端全量测试
mise exec java@21 -- mvn -q test

# 2. 前端构建
pnpm build

# 3. 端到端流程验证
# Crawl: URL → MinIO → 预览
# Crawl: PDF 上传 → MarkItDown 转换 → MinIO → 预览
# Crawl → Mindbank: 一键导入 → 流水线 5 步 → Obsidian 笔记生成 → AnythingLLM embedding
# Mindbank Q&A: 提问 → 回答 + 引用
# Notes: 文件树 → 编辑 → 保存 → 验证文件已更新
```

---

## 文件改动总览

### 后端新增文件
```
backend/src/main/resources/db/migration/
  V1_16__mindbank_init.sql

backend/src/main/java/com/nexus/
  port/KnowledgeBasePort.java
  entity/MindBankWorkspace.java
  entity/MindBankDocument.java
  entity/MindBankPromptTemplate.java
  mapper/MindBankWorkspaceMapper.java
  mapper/MindBankDocumentMapper.java
  mapper/MindBankPromptTemplateMapper.java
  dto/response/WorkspaceResponse.java
  dto/response/DocumentResponse.java
  dto/response/FileTreeNodeResponse.java
  dto/response/CrawlResultResponse.java
  dto/response/KnowledgeBaseAnswer.java
  dto/request/CreateWorkspaceRequest.java
  dto/request/TriggerPipelineRequest.java
  dto/request/SaveNoteRequest.java
  integration/minio/MinioService.java
  integration/minio/MinioFileInfo.java
  integration/anythingllm/AnythingLlmClient.java
  integration/crawl4ai/Crawl4AiClient.java
  integration/markitdown/MarkItDownClient.java
  service/CrawlService.java
  service/MindBankWorkspaceService.java
  service/MindBankDocumentService.java
  service/MindBankPipelineService.java
  service/NotesService.java
  controller/CrawlController.java
  controller/MindBankWorkspaceController.java
  controller/MindBankDocumentController.java
  controller/MindBankQaController.java
  controller/MindBankPromptTemplateController.java
  controller/NotesController.java
```

### 前端新增文件
```
frontend/src/pages/
  Crawl/crawl.api.ts
  Crawl/crawl.types.ts
  Crawl/CrawlDesktopView.tsx
  Crawl/CrawlMobileView.tsx
  Crawl/components/WebCrawlTab.tsx
  Crawl/components/FileUploadTab.tsx
  Crawl/components/MinioFileList.tsx
  Crawl/components/ImportToMindbank.tsx

  Notes/index.tsx
  Notes/notes.api.ts
  Notes/notes.types.ts
  Notes/NotesDesktopView.tsx
  Notes/NotesMobileView.tsx
  Notes/components/NotesFileTree.tsx
  Notes/components/FileTreeNode.tsx
  Notes/components/NotesEditor.tsx
  Notes/components/FileNameDialog.tsx

  Mindbank/mindbank.api.ts
  Mindbank/mindbank.types.ts
  Mindbank/MindBankDesktopView.tsx
  Mindbank/MindBankMobileView.tsx
  Mindbank/components/WorkspaceList.tsx
  Mindbank/components/WorkspaceCard.tsx
  Mindbank/components/WorkspaceDialog.tsx
  Mindbank/components/DocumentList.tsx
  Mindbank/components/DocumentCard.tsx
  Mindbank/components/PipelineStatus.tsx
  Mindbank/components/MinioFilePicker.tsx
  Mindbank/components/MindBankQaView.tsx
  Mindbank/components/MindBankNotesView.tsx

  Settings/MindBankSettingsPanel.tsx
```

### 前端修改文件
```
frontend/src/pages/Settings/index.tsx   ← 新增 mindbank Tab
frontend/src/App.tsx 或路由文件          ← 新增 /notes 路由
frontend/src/components/layout/Sidebar.tsx ← Notes 导航项
frontend/src/components/layout/MobileNav.tsx ← Notes 导航项
```
