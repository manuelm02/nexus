# 阶段3：Forge + 异步优化 任务计划

> 目标：实现 Forge 算法辅导（LangChain4j 多轮 SSE）+ Muse 问答 + Redis 异步队列优化
> 开始日期：阶段2完成后（预估 2026-06 中旬）
> 依赖：阶段2全部完成（AnythingLlmClient、MindbankIngestWorkflow、RadarWorkflow 可用）

---

## Phase 3A：后端实体与数据层

| # | 任务 | 状态 | 文件路径 |
|---|------|------|---------|
| 3A-1 | `ForgeNote` entity + `ForgeNoteContent` entity | ⬜ 待开始 | `entity/ForgeNote.java` / `entity/ForgeNoteContent.java` |
| 3A-2 | `ForgeNoteMapper` + `ForgeNoteContentMapper` | ⬜ 待开始 | `mapper/ForgeNoteMapper.java` 等 |
| 3A-3 | `UserDevice` entity + `UserDeviceMapper` | ⬜ 待开始 | `entity/UserDevice.java` / `mapper/UserDeviceMapper.java` |
| 3A-4 | `UserNotificationConfig` entity + Mapper | ⬜ 待开始 | `entity/UserNotificationConfig.java` 等 |
| 3A-5 | Flyway V4（settings 配置表：system_configs + user_notification_configs + user_devices） | ⬜ 待开始 | 确认 V1_4 是否已包含，如已有则跳过 |

## Phase 3B：Forge 后端实现

| # | 任务 | 状态 | 说明 |
|---|------|------|------|
| 3B-1 | `LangChain4jConfig`（如阶段2未实现）：`ChatMemory` Bean 配置 | ⬜ 待开始 | `integration/llm/LangChain4jConfig.java` |
| 3B-2 | `ForgeWorkflow`：多轮对话辅导（LangChain4j ChatMemory + StreamingChatLanguageModel） | ⬜ 待开始 | `workflow/ForgeWorkflow.java` |
| 3B-3 | `ForgeWorkflow` 完成流程：生成笔记模板 → WriteNotionStep → MindbankIngestStep | ⬜ 待开始 | 参见实施文档 §13 Forge 工作流 |
| 3B-4 | `ForgeService`：CRUD + 启动对话 + 完成提交 | ⬜ 待开始 | `service/ForgeService.java` |
| 3B-5 | `ForgeController`：5个端点（start/chat-SSE/complete/notes/notes/{id}） | ⬜ 待开始 | `controller/ForgeController.java` |

## Phase 3C：Muse 后端实现

| # | 任务 | 状态 | 说明 |
|---|------|------|------|
| 3C-1 | `MuseWorkflow`：多轮问答（LangChain4j ChatMemory，无持久化） | ⬜ 待开始 | `workflow/MuseWorkflow.java` |
| 3C-2 | `MuseService` + `MuseController`：SSE 流式 chat | ⬜ 待开始 | P3 优先级较低，可后做 |

## Phase 3D：Redis + 异步队列优化

| # | 任务 | 状态 | 说明 |
|---|------|------|------|
| 3D-1 | Docker Compose 引入 Redis（取消注释 redis 服务） | ⬜ 待开始 | `docker-compose.yml` |
| 3D-2 | 引入 Redisson 依赖（`pom.xml`） | ⬜ 待开始 | `redisson-spring-boot-starter` |
| 3D-3 | Mindbank Inbox/Ingest 任务改为 Redisson MQueue 异步处理 | ⬜ 待开始 | 替换 `@Async` |
| 3D-4 | Radar 任务改为 Redisson MQueue 异步处理 | ⬜ 待开始 | 替换 `@Async` |
| 3D-5 | `TaskCleanupScheduler` 逻辑完善（按 cleanup_days 清理，保留 keep_forever=true） | ⬜ 待开始 | `scheduler/TaskCleanupScheduler.java` |

## Phase 3E：前端实现

| # | 任务 | 状态 | 文件路径 |
|---|------|------|---------|
| 3E-1 | `forge.api.ts`：start / chat(SSE) / complete / notes | ⬜ 待开始 | `src/api/forge.api.ts` |
| 3E-2 | `muse.api.ts`：chat SSE | ⬜ 待开始 | `src/api/muse.api.ts` |
| 3E-3 | `Forge/index.tsx`：对话辅导界面 + 题目信息 + 完成提交 | ⬜ 待开始 | `src/pages/Forge/index.tsx` |
| 3E-4 | `Muse/index.tsx`：Daily Assistant 多轮对话 | ⬜ 待开始 | `src/pages/Muse/index.tsx` |
| 3E-5 | `Tasks/index.tsx` 完整版：轮询 + keep 标记 + 删除 | ⬜ 待开始 | `src/pages/Tasks/index.tsx` |
| 3E-6 | Settings 子页面完善：LlmConfig / SystemConfig / NotificationConfig | ⬜ 待开始 | `src/pages/Settings/` |
| 3E-7 | PWA 完整配置（`vite-plugin-pwa`，manifest + service worker） | ⬜ 待开始 | `vite.config.ts` + PWA 图标 |

---

## 关键约束与注意事项

- **ChatMemory**：Forge 每道题的对话记忆用 `MessageWindowChatMemory`（窗口大小建议 20 条），key 为 `forgeNoteId`
- **Muse ChatMemory**：无持久化需求，每次 session 新开，使用 `InMemoryChatMemoryStore`
- **Redis 引入时机**：等 Mindbank/Radar 功能稳定后再迁移，避免引入复杂度过早
- **forge_note_contents 表**：大字段（my_solution / note_content）拆分到独立表，列表查询只查 forge_notes 主表
- **SSE 多轮**：每次 `POST /api/v1/forge/{id}/chat` 都是新的 SSE 连接；ChatMemory 从 DB 恢复上下文

---

## 错误记录

| 错误 | 尝试 | 解决方案 |
|------|------|---------|
| （暂无） | - | - |

---

## 完成标准

- [ ] `POST /api/v1/forge/start` 创建题目，返回 noteId
- [ ] `POST /api/v1/forge/{id}/chat` SSE 流式辅导对话正常
- [ ] `POST /api/v1/forge/{id}/complete` 生成笔记，写入 Notion 和 Mindbank
- [ ] `GET /api/v1/forge/notes` 返回笔记列表
- [ ] `POST /api/v1/muse/chat` SSE 对话正常
- [ ] Mindbank/Radar 任务使用 Redis 队列处理（@Async 改造）
- [ ] Tasks 页面有实时轮询 + keep/delete 操作
- [ ] Forge 前端可完整走通一道题的辅导流程
