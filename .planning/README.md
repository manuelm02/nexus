# Nexus 项目规划文件索引

所有 Nexus 相关的开发计划统一存放在此目录，按阶段命名区分。

## 命名规范

```
.planning/
└── {YYYY-MM-DD}-{phase-slug}/
    ├── task_plan.md   # 阶段任务清单 + 进度跟踪
    ├── findings.md    # 调研发现 / 技术决策记录
    └── progress.md    # 会话日志 / 测试结果
```

## 计划列表

| 计划目录 | 阶段 | 状态 | 说明 |
|---------|------|------|------|
| [2026-05-29-phase2-mindbank](./2026-05-29-phase2-mindbank/task_plan.md) | 阶段2 | 🔧 进行中 | Mindbank Core：文件知识库 + Radar 爬取 |
| [2026-05-29-phase3-forge-async](./2026-05-29-phase3-forge-async/task_plan.md) | 阶段3 | ⏳ 待开始 | Forge 算法辅导 + Redis 异步优化 |

## 已完成阶段

| 阶段 | 说明 | 完成时间 |
|------|------|---------|
| 阶段1：基础 MVP | JWT 认证 + Focus/Fleeting/Prism/Ledger + 基础前端 | 2026-05-27 |

## 快速导航

- **当前任务**：阶段2 → [task_plan.md](./2026-05-29-phase2-mindbank/task_plan.md)
- **技术发现**：[findings.md](./2026-05-29-phase2-mindbank/findings.md)
- **进度日志**：[progress.md](./2026-05-29-phase2-mindbank/progress.md)
