# 阶段2：Mindbank Core 任务计划

> 目标：实现文件知识库（Mindbank）完整工作流 + Radar 网页爬取 + 相关前端页面
> 开始日期：2026-05-29
> 依赖：阶段1 MVP 已完成（JWT 认证、Focus/Fleeting/Prism/Ledger 可用）

---

## 阶段1 遗留项（需在阶段2开始前补齐）

> 这些是阶段1清单中列出但**尚未实现**的后端骨架，是阶段2的前置依赖。

| # | 任务 | 状态 | 说明 |
|---|------|------|------|
| 1.1 | `MindbankDoc` Entity + `MindbankDocMapper` | ⬜ 待开始 | 实体类和 Mapper 接口 |
| 1.2 | `integration/AnythingLlmClient.java` | ⬜ 待开始 | AnythingLLM REST API 封装（目前完全缺失） |
| 1.3 | `integration/NotionClient.java` | ⬜ 待开始 | Notion API 基础封装（Write Page） |
| 1.4 | `integration/MinioClient.java` | ⬜ 待开始 | MinIO 文件上传 + presigned URL |
| 1.5 | `integration/llm/LangChain4jConfig.java` | ⬜ 待开始 | LangChain4j Bean 配置（integration/llm/ 目录已存在但为空） |
| 1.6 | `AnythingLlmMindBank` 从 stub → 完整实现 | ⬜ 待开始 | 当前所有方法均为 warn + 返回空值 |

---

## Phase 2A：后端基础层（集成客户端）

> 优先级最高，所有 Workflow 都依赖这些客户端。

| # | 任务 | 状态 | 文件路径 |
|---|------|------|---------|
| 2A-1 | AnythingLlmClient：workspace CRUD + 文档 ingest + chat SSE | ⬜ 待开始 | `integration/AnythingLlmClient.java` |
| 2A-2 | AnythingLlmMindBank 完整实现 | ⬜ 待开始 | `adapter/mindbank/AnythingLlmMindBank.java` |
| 2A-3 | MinioClient：upload + presignedUrl | ⬜ 待开始 | `integration/MinioClient.java` |
| 2A-4 | NotionClient：创建 Page + 查询 DB | ⬜ 待开始 | `integration/NotionClient.java` |
| 2A-5 | LangChain4jConfig：ChatLanguageModel / EmbeddingModel Bean | ⬜ 待开始 | `integration/llm/LangChain4jConfig.java` |

## Phase 2B：后端 Step 层

> 可复用的原子操作，Workflow 的组成单元。

| # | 任务 | 状态 | 文件路径 |
|---|------|------|---------|
| 2B-1 | `LlmExtractMetadataStep`：提取 title/domain/tags/summary | ⬜ 待开始 | `step/LlmExtractMetadataStep.java` |
| 2B-2 | `LlmSummarizeStep`：生成长文摘要 | ⬜ 待开始 | `step/LlmSummarizeStep.java` |
| 2B-3 | `LlmCheckRelatedStep`：RAG 关联检查 | ⬜ 待开始 | `step/LlmCheckRelatedStep.java` |
| 2B-4 | `CrawlUrlStep`：调用 WebCrawlerDispatcher | ⬜ 待开始 | `step/CrawlUrlStep.java` |
| 2B-5 | `WriteNotionStep`：写入 Notion（幂等，检查 notion_synced） | ⬜ 待开始 | `step/WriteNotionStep.java` |
| 2B-6 | `MindbankIngestStep`：调用 MindBankPort.ingest | ⬜ 待开始 | `step/MindbankIngestStep.java` |
| 2B-7 | `SaveTaskResultStep`：更新 Task 状态 + 结果字段 | ⬜ 待开始 | `step/SaveTaskResultStep.java` |
| 2B-8 | `SendNotificationStep`：调用 NotificationService | ⬜ 待开始 | `step/SendNotificationStep.java` |

## Phase 2C：后端 Workflow 层（Mindbank）

> 核心业务流程编排。

| # | 任务 | 状态 | 说明 |
|---|------|------|------|
| 2C-1 | `MindbankInboxWorkflow`：文件上传 → MinIO → 文本提取 → LLM 元数据 → mindbank_docs(pending) | ⬜ 待开始 | 参见实施文档 §13 |
| 2C-2 | `MindbankIngestWorkflow`：审核通过 → ensureWorkspace → ingest → 关联检查 → 合并/新建 Notion | ⬜ 待开始 | 参见实施文档 §13 |
| 2C-3 | `MindbankService`：业务逻辑层，串联 Workflow | ⬜ 待开始 | `service/MindbankService.java` |
| 2C-4 | `MindbankController`：7个端点（inbox/docs/chat/workspaces/approve/reject/from-radar） | ⬜ 待开始 | `controller/MindbankController.java` |

## Phase 2D：后端 Workflow 层（Radar）

| # | 任务 | 状态 | 说明 |
|---|------|------|------|
| 2D-1 | `RadarWorkflow`：URL → 爬虫 → LLM 提取摘要/标签 → Task 结果 | ⬜ 待开始 | `workflow/RadarWorkflow.java` |
| 2D-2 | `RadarService` + `RadarController`：异步提交 + 历史查询 | ⬜ 待开始 | `service/RadarService.java` / `controller/RadarController.java` |

## Phase 2E：前端实现

| # | 任务 | 状态 | 文件路径 |
|---|------|------|---------|
| 2E-1 | `mindbank.api.ts`：所有 Mindbank 接口 | ⬜ 待开始 | `src/api/mindbank.api.ts` |
| 2E-2 | `radar.api.ts`：提交 + 历史 | ⬜ 待开始 | `src/api/radar.api.ts` |
| 2E-3 | `MarkdownRenderer` 组件 | ⬜ 待开始 | `src/components/MarkdownRenderer.tsx` |
| 2E-4 | `TaskStatusBadge` 组件 | ⬜ 待开始 | `src/components/TaskStatusBadge.tsx` |
| 2E-5 | `TaskResultView` 组件 | ⬜ 待开始 | `src/components/TaskResultView.tsx` |
| 2E-6 | `useTaskPoller` hook | ⬜ 待开始 | `src/hooks/useTaskPoller.ts` |
| 2E-7 | `Mindbank/index.tsx`：知识库文档列表（按 domain 分组） | ⬜ 待开始 | `src/pages/Mindbank/index.tsx` |
| 2E-8 | `Mindbank/Inbox.tsx`：文件拖拽上传 | ⬜ 待开始 | `src/pages/Mindbank/Inbox.tsx` |
| 2E-9 | `Mindbank/Review.tsx`：元数据审核（可编辑 domain/tags） | ⬜ 待开始 | `src/pages/Mindbank/Review.tsx` |
| 2E-10 | `Mindbank/Chat.tsx`：SSE 流式问答 | ⬜ 待开始 | `src/pages/Mindbank/Chat.tsx` |
| 2E-11 | `Radar/index.tsx`：URL 提交 + 任务结果展示 | ⬜ 待开始 | `src/pages/Radar/index.tsx` |

---

## 关键约束与注意事项

- **AnythingLLM API**：通过 Tailscale 内网访问，base-url 从环境变量读取
- **MinIO**：文件 URL 格式 `https://files.{domain}/nexus-files/mindbank/{docId}/{filename}`
- **Notion 幂等**：写入前检查 `notion_synced` 字段，避免重复写入
- **LLM 调用**：必须通过 `LlmConfigService.resolveModel("mindbank_extract")` 获取模型
- **SSE 超时**：Mindbank chat 的 SseEmitter 超时设置 5 分钟
- **文件提取**：PDF 用 Apache PDFBox，Markdown/txt 直接读取

---

## 错误记录

| 错误 | 尝试 | 解决方案 |
|------|------|---------|
| （暂无） | - | - |

---

## 完成标准

- [ ] `POST /api/v1/mindbank/inbox` 可上传文件，返回 taskId
- [ ] 上传后文件存入 MinIO，元数据存入 mindbank_docs (status=pending)
- [ ] `GET /api/v1/mindbank/inbox` 返回待审核列表
- [ ] 审核通过后文档进入 AnythingLLM workspace
- [ ] `POST /api/v1/mindbank/chat` SSE 正常流式返回
- [ ] `POST /api/v1/radar` 异步爬取 URL 并提取摘要
- [ ] Radar 结果可通过 `from-radar` 接口录入 Mindbank
- [ ] 前端 Mindbank 三个子页面（Inbox/Review/Chat）正常工作
- [ ] 前端 Radar 页面可提交 URL 并轮询结果
