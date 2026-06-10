# Nexus 项目开发准则

## 项目概述
Nexus 是个人 AI 工作台（Knowledge OS），后端为 Spring Boot 3.x + MyBatis-Plus + LangChain4j，前端为 React 18 + Vite + TypeScript + Tailwind CSS v3。

## 技术栈
- **后端**：Java 21 / Spring Boot 3.3.5 / MyBatis-Plus 3.5.7 / LangChain4j 0.35.0 / jjwt 0.12.6 / Flyway / PostgreSQL 16
- **前端**：React 18 / Vite 5 / TypeScript / Tailwind CSS v3 / shadcn/ui / TanStack Query / Zustand / React Router v6 / pnpm 11

## 代码注释规范（强制遵守）

所有代码必须在以下位置加上注释：

### Java 后端
1. **类级别**：每个 `@Service` / `@RestController` / `@Component` 类顶部用一句话说明职责
2. **公共方法**：非平凡的 public 方法必须有 Javadoc，说明参数含义和返回值语义
3. **非显而易见的逻辑**：如加密算法选择、MyBatis-Plus lambda 写法的限制、字段映射的 workaround、定时任务的触发条件
4. **架构决策**：凡是有"为什么这样做"而非显而易见的地方，必须注释原因

### TypeScript/React 前端
1. **组件**：每个导出的 React 组件顶部用一行注释说明用途
2. **Hook / 副作用**：`useEffect` / `useQuery` / `useMutation` 若逻辑复杂，说明触发条件和副作用
3. **API 调用**：说明接口含义和关键字段
4. **非显而易见的状态逻辑**：如乐观更新、合并本地 overrides 等

### 注释风格原则
- 注释说明 **WHY**（为什么这样做），而不是 **WHAT**（代码本身已经说明）
- 不写废话注释（如 `// 获取用户列表` 接着 `getUsers()`）
- 对外部约束（API 限制、框架 bug、历史原因）必须注释
- 中文注释优先，技术术语保持英文原文

## 架构关键点（已知约束，编码时需注意）

### 后端
- **LLM 解析**：通过 `LlmConfigService.resolveModel(workflowType)` 统一获取模型，不要直接 new 模型对象
- **API Key 加密**：存储前必须调用 `llmConfigService.encrypt()`，读取时框架自动解密，`@JsonIgnore` 防止序列化到前端
- **MyBatis-Plus boolean 字段**：`boolean isXxx` 命名会导致 lambda cache 解析错误，一律改用语义化命名（如 `defaultProvider`）并加 `@TableField("is_xxx")` 显式指定列名
- **Flyway 命名**：迁移脚本用 `V{major}_{minor}__{desc}.sql` 格式（如 `V1_4__init_settings.sql`），一旦应用不可修改
- **JWT**：access token 15分钟，refresh token 30天，无 cookie，全部走 `Authorization: Bearer`

### 前端
- **API 响应结构**：后端统一返回 `{ success, data, message, errorCode }`，取数据用 `res.data.data`
- **Token 刷新**：`client.ts` 的 401 拦截器自动 refresh，`_retry` 标志防止死循环
- **Tailwind v3**：必须有 `postcss.config.js`，否则样式不生效
- **pnpm 11**：新依赖若有 postinstall 脚本需执行 `pnpm approve-builds`

## 前端响应式架构规范（强制遵守）

Nexus 后续所有页面都必须按“同一路由、业务共享、视图按复杂度拆分”的方式适配桌面端和移动端。

### 基本原则
1. **同一路由，不拆 URL**：例如 `/todo` 同时承载桌面端和移动端，不新增 `/m/todo` 这类移动端路由。
2. **业务逻辑只写一套**：API 调用、TanStack Query、mutation、权限、校验、数据转换和状态流转放在 page 或 hook 中共享，禁止复制两套业务逻辑。
3. **视图层按复杂度拆分**：简单页面只用 Tailwind responsive class；复杂页面必须拆出 `DesktopView` / `MobileView` 或桌面/移动专用交互组件。
4. **交互模式允许设备差异**：桌面端优先 modal、table、sidebar、hover/dropdown；移动端优先 sheet、bottom action bar、compact list、tap-first interaction。
5. **移动端不是桌面缩放版**：当布局顺序、信息密度、操作方式发生变化时，必须单独设计移动端组件，不能继续堆响应式 class 硬撑。

### 推荐目录结构
复杂功能页按以下结构组织：

```text
src/pages/<Feature>/
  index.tsx                 # 数据编排、query/mutation、共享状态
  <Feature>DesktopView.tsx  # 桌面视图
  <Feature>MobileView.tsx   # 移动视图
  components/
    SharedControl.tsx       # 共享小组件
    DetailDialog.tsx        # 桌面 modal/dialog
    DetailSheet.tsx         # 移动 bottom sheet
```

### 拆分判断标准
- 仅字号、间距、列数变化：使用 Tailwind responsive class。
- 布局顺序变化：拆 `MobileView`。
- table 变 card list、modal 变 sheet、sidebar 变 bottom nav、hover 操作变点击操作：拆移动端专用组件。
- 同一个表单字段和校验规则在两端一致：抽共享 hook 或共享字段组件，不复制逻辑。
- 调整移动端 UI 时，不允许无意改变桌面端行为；桌面端和移动端修改范围要清晰隔离。

## 开发环境
- 后端启动：`cd backend && mvn spring-boot:run -Dspring-boot.run.profiles=local`（fish shell 不支持 `export $(cat .env)`）
- 前端启动：`cd frontend && pnpm dev`
- 统一入口：根目录执行 `make backend-dev` / `make frontend-dev` / `make up`
- 基础设施：dev/prod 默认使用外部服务，真实地址只写入不入库的 `.env.dev` / `.env.prod`；PostgreSQL 用 `nexus_dev` / `nexus_prod` 分库，Redis 用 database 或 key prefix 隔离，Crawl4AI 通过 `CRAWL4AI_BASE_URL` 配置。完整 Compose 仅用于临时启动内部 PostgreSQL/Redis/Crawl4AI。

## 分支 / 提交规范
- 功能分支命名：`feat/xxx`，修复：`fix/xxx`
- Commit message 格式：`feat: 添加 LLM Provider 管理` / `fix: 修复 MyBatis lambda cache 错误`
