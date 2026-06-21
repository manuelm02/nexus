# Phase 6.2 — Settings Mindbank Tab + Crawl 页面提示词

执行计划：`docs/superpowers/plans/2026-06-17-mindbank-crawl-phase6.md`（Phase 6.2 + 6.3 节）  
设计文档：`docs/superpowers/specs/2026-06-17-mindbank-crawl-phase6-design.md`  
前置：Phase 6.1 已完成（V1_16 迁移、所有 Integration Client、Entity/Mapper 均已到位）

---

你正在开发 Nexus 项目（路径：`/Users/manuelm/Workspace/Projects/Nexus/nexus`），Spring Boot 3.x 后端 + React 18 + TypeScript 前端，使用 TanStack Query + Zustand，遵循 AGENTS.md 的桌面/移动双视图拆分规范。请先阅读 `CLAUDE.md` 和 `AGENTS.md`，再阅读计划文档的 Phase 6.2 和 Phase 6.3 节。

本阶段目标：Settings 新增 Mindbank 配置 Tab + 完整的 Crawl 页面（网页爬取 + 文件上传 + MinIO 管理）。

---

## 第一部分：Settings Mindbank Tab

请按以下顺序执行：

1. **后端 Settings API**：在现有 `SettingsController`（或新建 `MindBankSettingsController`）中添加：
   - `GET /api/settings/mindbank`：返回所有 `mindbank.*` 配置，API Key 类字段返回 `"***"` 脱敏
   - `PUT /api/settings/mindbank`：批量保存，Key 类字段（`mindbank.minio.access_key`、`mindbank.minio.secret_key`、`mindbank.anythingllm.api_key`）调用 `LlmConfigService.encrypt()` 后再存入 `system_configs`

2. **前端 Settings Tab 扩展**：
   - 在 `SettingsTab` 联合类型中新增 `'mindbank'`
   - 新建 `frontend/src/pages/Settings/MindBankSettingsPanel.tsx`，分 4 个配置分组展示（服务地址 / 认证 / AI 模型 / 流水线行为），参照现有 `ChatModelPanel.tsx` 的写法
   - AI 模型选择复用项目现有的 WorkflowModel 选择组件，workflowType 分别为 `mindbank_classify`、`mindbank_organize`、`mindbank_condense`
   - Session Note 自动触发用 Toggle 组件

3. **验证**：`pnpm build && mise exec java@21 -- mvn -q test`

---

## 第二部分：Crawl 页面

请按以下顺序执行：

4. **后端 CrawlService**：创建 `backend/src/main/java/com/nexus/service/CrawlService.java`，编排以下逻辑：
   - `crawlWeb(String url)` → 调用 `Crawl4AiClient.submitCrawl(url)` 获取 taskId → 轮询 `getResult(taskId)`（最长 60s，每 3s 一次，超时抛异常）→ 原始 HTML 上传 MinIO `originals/{yyyy-MM}/{uuid}.html` → Markdown 上传 MinIO `processed/{yyyy-MM}/{uuid}.md` → 创建 `MindBankDocument` 记录（workspace_id=null, source_type='crawl_web'）→ 返回 docId + markdownPreview（前 500 字）
   - `uploadFile(MultipartFile file)` → 原始文件上传 MinIO `originals/{yyyy-MM}/{原始文件名}` → 调用 `MarkItDownClient.convert(file)` → Markdown 上传 MinIO `processed/{yyyy-MM}/{文件名}.md` → 创建 `MindBankDocument` 记录（source_type='crawl_file'）→ 返回 docId + markdownPreview
   - `listUnassignedFiles()` → 查询 workspace_id IS NULL 的 MindBankDocument 列表
   - `deleteFile(Long docId)` → 删除 MinIO 两个 key + 删除 DB 记录
   - `importToWorkspace(Long docId, Long workspaceId)` → 更新 workspace_id → 触发 `MindBankPipelineService.triggerAsync(docId)`（@Async，Phase 6.6 实现后自动生效；本阶段可先注释掉触发调用，预留方法签名）

5. **后端 CrawlController**：在 `controller/CrawlController.java` 中实现计划文档 Phase 6.3 节列出的 5 个接口，调用 CrawlService，统一返回 `ApiResponse<T>` 格式。

6. **前端 Crawl 页面**：
   - 创建 `frontend/src/pages/Crawl/crawl.api.ts`（所有 API 调用）和 `crawl.types.ts`（类型定义）
   - `frontend/src/pages/Crawl/index.tsx`：使用 TanStack Query，加载未导入文件列表，管理选中 Tab 状态（网页爬取/文件上传）
   - 拆分 `CrawlDesktopView.tsx` 和 `CrawlMobileView.tsx`（参照 AGENTS.md）
   - 组件：
     - `WebCrawlTab.tsx`：URL 输入框 + "爬取"按钮（loading 状态）+ Markdown 预览区（可折叠，默认展示前 300 字）
     - `FileUploadTab.tsx`：拖拽上传区（支持 PDF/DOCX/TXT/MD/图片）+ 上传进度 + Markdown 预览区
     - `MinioFileList.tsx`：文件列表（文件名/来源类型/日期/处理状态），每行有"查看 Markdown"和"导入 Mindbank"和"删除"操作
     - `ImportToMindbank.tsx`：Workspace 选择弹窗（调用 `/api/mindbank/workspaces` 获取列表，下拉选择后提交导入）
   - 移动端：拖拽上传区改为点击选择文件；文件列表操作折叠为图标按钮

7. **路由注册**：确认 `/crawl` 路由已在 App.tsx 中注册，若未注册则添加。

8. **验证**：
```bash
pnpm build
mise exec java@21 -- mvn -q test
# 手动测试（需后端运行）：
# 1. Settings → Mindbank Tab：填写服务地址 → 保存 → 刷新页面确认数据持久化
# 2. Crawl 页面：输入公开 URL → 爬取 → 查看 Markdown 预览
# 3. Crawl 页面：上传一个 PDF → 查看转换结果
# 4. 文件列表：确认已爬取/上传的文件显示在列表中
```

**注意事项：**
- `Crawl4AiClient` 轮询时使用 `Thread.sleep(3000)`，在 `@Service` 方法中是同步阻塞（不是 @Async），因为 HTTP 请求需要等待爬取结果返回给前端
- 文件上传接口 `POST /api/crawl/file` 使用 `@RequestParam("file") MultipartFile`，确认 Spring Boot 配置允许大文件上传（`spring.servlet.multipart.max-file-size=100MB`）
- MinIO key 路径中的日期格式用 `yyyy-MM`（按月分目录），uuid 使用 `UUID.randomUUID().toString()`
- 前端文件上传使用 `FormData`，不要用 JSON body
