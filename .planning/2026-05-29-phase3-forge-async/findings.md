# 阶段3 技术发现与决策记录

> 阶段3开始前更新此文件。

---

## 前置依赖确认（来自阶段2）

阶段3依赖以下阶段2交付物：

| 依赖项 | 用途 |
|--------|------|
| `MindbankIngestStep` | Forge 完成时存入知识库 |
| `WriteNotionStep` | Forge 完成时写入 Notion |
| `AnythingLlmMindBank` 完整实现 | Forge 笔记 ingest |
| `LangChain4jConfig` Bean | Forge/Muse ChatLanguageModel + StreamingChatLanguageModel |

---

## LangChain4j ChatMemory 设计决策

**Forge（题目辅导）：**
- 使用 `MessageWindowChatMemory`，窗口 20 条消息
- key = `"forge:" + forgeNoteId`
- 需要持久化（用户可跨 session 继续）→ 实现自定义 `ChatMemoryStore`（存入 PostgreSQL 或 Redis）
- 或者简化：每次请求从 DB 的 `forge_note_contents` 重建历史消息（无需独立 ChatMemoryStore）

**Muse（日常助手）：**
- 无持久化需求，`InMemoryChatMemoryStore`
- key = `sessionId`（前端每次 session 自行生成，传入请求头）

---

## Redis / Redisson 引入计划

- 版本：`redisson-spring-boot-starter 3.x`（兼容 Spring Boot 3.x）
- 队列类型：`RBlockingQueue` + `RDelayedQueue`（按需）
- 替换策略：先保留 `@Async` 作为 fallback，新增 `@ConditionalOnProperty` 切换

---

## forge_notes + forge_note_contents 双表设计原因

- 列表查询（`GET /api/v1/forge/notes`）只需 title/difficulty/status 等元数据
- `my_solution` 和 `note_content` 可能数十 KB，不应在列表查询时加载
- 大字段拆分到 `forge_note_contents`，按需 JOIN 或单独查询

---

## PWA 配置要点

- 使用 `vite-plugin-pwa`（已在 CLAUDE.md 技术栈中列出）
- manifest：name="Nexus", display="standalone", theme_color 与 Tailwind 主色一致
- service worker：`NetworkFirst` 策略（API 请求），`CacheFirst` 策略（静态资源）
- iOS PWA：需要 `apple-touch-icon` + `apple-mobile-web-app-status-bar-style` meta 标签
