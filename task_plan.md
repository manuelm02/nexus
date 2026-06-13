# Inbox Phase 3.1: AI Capture Workspace - 任务规划

## 目标
将 /inbox 从简单三 tab CRUD 重构为 AI 辅助收纳工作台：书签 AI 分析/批量导入/智能分组、paperless 网关、笔记 AI 辅助/合并。

## 阶段状态

| 阶段 | 状态 | 说明 |
|------|------|------|
| Phase 1: UI Shell 重构 | pending | 重构桌面/移动端 shell，保证现有功能不回归 |
| Phase 2: Bookmark URL 归一化 | pending | 实现 BookmarkUrlNormalizer + 测试 |
| Phase 3: Bookmark AI Analyze + Smart Groups | in_progress | 持久化智能分组 + /bookmarks/analyze + 前端 AI review panel |
| Phase 3.1: Smart Groups 实体/Service | complete | BookmarkSmartGroup 实体/Mapper/Service |
| Phase 4: Bookmark 批量导入 | pending | /import/preview + /commit + 冲突 review UI |
| Phase 5: 标签/智能分组工作台 | pending | 标签管理 + 分组 CRUD + preview/apply |
| Phase 6: Settings Inbox 配置 | pending | paperless/obsidian/bookmark 设置 + 连接测试 |
| Phase 7: Paperless 网关 | pending | status + entry grid + 从 Settings 读配置 |
| Phase 8: Note AI Analyze | pending | /notes/analyze + AI suggestion UI |
| Phase 9: Note Consolidation | pending | consolidation preview/write |
| Phase 10: 验证 | pending | 前后端 build/test |

## 强制约束
- 不接入 Linkding API
- 不 hardcode DeepSeek/OpenAI key
- LLM 走 LlmConfigService.resolveModel()
- AI endpoint 都是 advisory，preview/analyze 不写数据
- paperless 不创建本地 documents 表
- paperless token 加密保存，不回显
- UI 遵守 DESIGN.md
- 同一路由 /inbox，业务逻辑 index.tsx 共享

## 遇到的错误
| 错误 | 尝试次数 | 解决方案 |
|------|---------|---------|
| | | |
