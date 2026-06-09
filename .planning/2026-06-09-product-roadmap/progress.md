# Nexus Product Roadmap Progress

## 2026-06-09

- 删除旧 v1 实施文档、旧结构重构文档、旧 superpowers 计划和旧 `.planning` 阶段计划。
- 更新 `docs/nexus-final-implementation-guide.md` 为当前精简工作流版。
- 创建当前唯一阶段计划 `.planning/2026-06-09-product-roadmap/`。
- 更新 `README.md`，同步当前产品主线和命名收束。
- 验证 Markdown 文件集合只剩 `README.md`、`docs/nexus-final-implementation-guide.md` 与当前计划文件；主文档中旧 Forge / 旧阶段标题已清理。
- 补充 ToDo 已过期分组需求：过了今天且未 done 的任务集中展示，并允许调整状态、计划日期、截止日期。
- 完成 Phase 1 ToDo 减法工作流：后端创建默认 `pending`，新增选入今日接口和已过期查询，删除旧自动 rollover；前端改为待分配池、今日、已过期、历史四段视图。
- 待分配池支持取消，历史列表支持按状态筛选并恢复到 `pending`；已过期分组支持直接修改状态、计划日期和截止日期。
- 新增用户信息页 `/profile`，桌面侧边栏增加用户入口和退出登录按钮。
- 新增后端单元测试 `TodoServiceTest` 覆盖 pending 创建、选入今日 dueDate 兜底、取消恢复和过期查询边界。
- 验证通过：`mise exec java@21 -- mvn -q -Dtest=TodoServiceTest test`、`mise exec java@21 -- mvn -q test`、`pnpm build`。
