# Nexus Structural Refactor Assessment Plan

**Goal:** 读取 `.doc/structural-refactor.md`，结合 Nexus 当前结构，给出保持既有设计理念的改造方案。

## Phases

- [x] Phase 1: 读取结构化重构意图文档
- [x] Phase 2: 盘点当前后端、前端、部署和文档结构
- [x] Phase 3: 对比目标结构与当前结构差异
- [x] Phase 4: 形成分阶段、低风险的改造计划

## Decisions

- 本次只做方案评估，不直接改业务代码。
- 方案必须保留 Nexus 的 Knowledge OS / 个人 AI 工作台定位，以及当前后端 Spring Boot、前端 React 的职责划分。

## Errors Encountered

| Error | Attempt | Resolution |
|-------|---------|------------|
| zsh 启动时输出 `parse error near end` | 多个 shell 读取命令均出现 | 该错误来自 shell 初始化脚本，不影响命令主体输出；继续读取项目文件 |
| `find nexus-backend/src/test ...` 报 `No such file or directory` | 检查测试目录 | 当前后端没有 `src/test` 目录；方案中需要补测试骨架或至少用编译/构建做迁移验收 |
