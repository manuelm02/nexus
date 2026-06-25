# Nexus 项目文档索引

## 目录结构

```
docs/
├── architecture/     # 架构设计与实现指南
├── career/           # 面试准备与职业发展
├── design-specs/     # 功能 UI/UX 设计规范
├── plans/            # 各阶段执行计划
├── prompts/          # AI 辅助开发 Prompt 模板库
└── roadmap/          # 产品路线图与进度追踪
```

## 项目根目录标准文档

| 文件 | 用途 |
|------|------|
| `README.md` | 项目总览、技术栈、快速启动 |
| `CLAUDE.md` | 代码规范、架构约束、开发准则 |
| `DESIGN.md` | UI/UX 设计系统（配色、字体、组件、响应式）— **2026-06-25 Warm Studio 基调** |
| `AGENTS.md` | 前端 Desktop/Mobile 双视图架构规范 |

## 各目录说明

### architecture/
- `nexus-final-implementation-guide.md` — 项目定位、模块、部署架构
- `nexus-mindbank-pipeline-agent-design.md` — Mindbank Pipeline + Agent 双层架构设计

### design-specs/
按日期命名的功能设计规范，覆盖 Translate / Inbox / Subscriptions / Mindbank 等模块。
- `2026-06-12-nexus-compact-ui-standards.md` — 紧凑度规范（密度部分仍有效，视觉基调已被 Warm Studio 取代）

### plans/
按日期命名的执行计划，从 Phase 2 Translate 到 Phase 7 Panel Hub。
- `2026-06-25-warm-studio-ui-redesign.md` — **前台全站 UI 重构方案（Warm Studio）**，配套 prompt 见 `prompts/2026-06-25-warm-studio-ui-redesign-deepseek.md`

### prompts/
AI 辅助开发的 Prompt 模板，用于 DeepSeek 等模型驱动的代码生成。

### roadmap/
- `task_plan.md` — Phase 0-6 主计划
- `progress.md` — 实现进度记录
- `findings.md` — 需求分析与发现
