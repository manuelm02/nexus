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
- 修复 `V1_5__rename_module_keys.sql` 中 `system_configs.key` 列名错误，改为 V1_4 实际创建的 `config_key`，解决 Flyway 启动失败。
- 新增 `SystemConfigMigrationTest` 防止配置迁移脚本再次误用 `key` 列名。
- 验证通过：`mise exec java@21 -- mvn -q -Dtest=SystemConfigMigrationTest test`、`mise exec java@21 -- mvn -q test`、`mise exec java@21 -- mvn spring-boot:run -Dspring-boot.run.profiles=local`；启动日志显示 V1.5 migration successfully applied，随后已停止临时进程。
- 根据用户反馈优化 ToDo 交互：页面默认展示今日 tab，历史 ToDo 移入独立 tab；今日 tab 内顺序为今日、待分配、已过期。
- 新建 ToDo 改为混合式交互：默认快速录入，展开后可设置优先级、是否加入今日和截止日期；优先级由原生 select 改为触控友好的 swatch 按钮。
- 列表行将状态展示和状态操作合并为统一状态 chip/dropdown，5 种状态均可自由切换；完成后因今日列表过滤 `done` 会自动进入历史。
- 待分配加入今日改为弹窗选择截止日期；删除按钮移入详情弹窗，并使用“确认删除这个 ToDo？此操作无法撤销。”二次确认。
- 每条 ToDo 可打开详情弹窗查看/编辑标题、备注、优先级、状态、计划日期、截止日期。
- 验证通过：`pnpm build`、`mise exec java@21 -- mvn -q test`、`curl -I --max-time 5 http://localhost:5174/`。in-app browser 当前无可用 `iab` 实例，项目未安装 Playwright，因此未完成截图级浏览器 QA。
- 按 `.design/DESIGN.md` 先完成全局 UI 基座 + ToDo 重构：全局切换为暖纸色背景、白色 surface、Notion blue 主色、细边框和轻阴影；桌面/移动导航同步调整为文档型低噪声风格。
- ToDo 优先级移除“紧急”，前端仅保留低/中/高；后端新增兼容逻辑，将旧请求或旧数据中的 `urgent` 归并到 `high`，避免继续产生紧急值。
- ToDo 页面补充 API 错误提示，加载列表失败和操作失败时明确提示检查后端服务与登录状态，降低“未对接后台”的误判。
- 验证通过：`mise exec java@21 -- mvn -q test`、`pnpm build`；`rg -n "urgent|紧急" frontend/src backend/src/main/java backend/src/test` 确认前端无“紧急”展示，只保留后端兼容和测试。
- 优化 ToDo 单行展示：列表行改为移动端友好的一行必要信息，标题截断，桌面端额外展示优先级和截止日期，状态下拉移入详情弹窗。
- 左侧状态控件改为三段点击流转：`not_started` 空心圆，点击变 `in_progress` 实心圆并带执行动画，再点击变 `done` 对勾；`pending` 展示暂停图标，`cancelled` 展示叉号。
- 详情弹窗保存成功后自动关闭，并触发 ToDo 查询刷新，避免保存后界面无反馈。
- 验证通过：`pnpm build`、`mise exec java@21 -- mvn -q test`。
- 继续优化 ToDo 行展示：左侧状态按钮从 40px 收敛到 32px，内部圆点/对勾同步缩小；移动端保持一行必要信息，桌面端补充优先级和截止日期。
- 今日分组改为“进行中”在上、“未开始”在下；待分配和已过期支持折叠/展开。
- 排查并修复空闲后误报“检查后端服务”的根因：后端 refresh token rotation 会作废旧 refresh token，前端此前只更新 access token，未保存新 refresh token；并发 401 还会重复使用旧 refresh token。现在前端保存新的 access/refresh token，并用共享 refresh promise 合并并发刷新。
- 验证通过：`pnpm build`、`mise exec java@21 -- mvn -q test`。
- ToDo 空状态去掉大边框容器，今日/待分配/已过期/历史无任务时只展示轻量文本提示；有任务时仍保持一条 ToDo 一个独立框。
- 验证通过：`pnpm build`、`mise exec java@21 -- mvn -q test`。
- 重新设计 ToDo 新建栏：去掉重复优先级与展开设置按钮，改为标题输入、三段优先级、加入今日和添加按钮的 responsive 表单；移动端按自然顺序堆叠，减少首屏高度占用。
- 优先级颜色调整为低=绿色、中=黄色、高=暗红色，并同步用于列表和详情弹窗。
- 验证通过：`pnpm build`、`mise exec java@21 -- mvn -q test`；Browser 插件当前仍无可用 `iab` 实例，未完成截图级浏览器 QA。
- 修复 ToDo 空闲后仍报“后端服务未启动”的 403 根因：Spring Security 默认把未认证 API 请求落到 403，前端 refresh 拦截器只处理 401，导致 access token 过期后不会刷新。现在后端对未登录/失效 token 统一返回 401，保留已认证但无权限时的 403。
- 新增 `SecurityConfigTest` 覆盖受保护 API 无 token 时返回 401，防止该行为回退。
- 验证通过：`mise exec java@21 -- mvn -q -Dtest=SecurityConfigTest test`、`mise exec java@21 -- mvn -q test`、`pnpm build`。
- ToDo 新建栏取消默认优先级，用户未选择时点击添加会在表单内提示“请选择一个优先级后再添加”；ToDo 行改为按优先级使用浅色背景和左侧色条，而不是大面积强色填充。
- 验证通过：`pnpm build`。
- ToDo 行移除左侧优先级色条，仅保留优先级浅色背景和边框，避免状态圆圈旁出现突兀竖线。
- 待分配 ToDo 行补充“取消”按钮，点击后切换为 `cancelled`；左侧状态控件重做为更轻的 28px 圆形交互，使用细圆环、实心点、勾选来表达 Notion/Apple 风格状态。
- 验证通过：`pnpm build`。
- 历史状态筛选和详情状态选择从浏览器原生 `select` 改为 Radix Select 自绘菜单，统一为 Nexus 浅色弹层、圆角、轻阴影和自定义选中态。
- 验证通过：`pnpm build`。
- 移动端底部导航重构为固定 5 项：Chat、ToDo、Inbox、Translate、更多；Crawl、Mindbank、Coding Practice、Subscriptions、Jobs、Admin/Profile、Settings、退出登录统一收纳到“更多入口”底部弹层，避免移动端标签挤压和溢出。
- 验证通过：`pnpm build`。
- 待分配 ToDo 的“加入今日”交互从居中弹窗改为按钮附近的上浮日期气泡，标题为“选择截止日期”，保留日期选择器、取消和确认加入操作，减少对列表上下文的打断。
- 验证通过：`pnpm build`。
- ToDo 详情里的删除二次确认从嵌套模态改为删除按钮旁的上浮确认气泡，避免详情弹窗内再叠一层弹窗。
- 验证通过：`pnpm build`。
- ToDo 移动端专项适配：顶部标题/指标/Tab 收紧，新建 ToDo 表单降为 compact 尺寸；详情页在手机端改为底部抽屉式编辑面板，操作区调整为取消/保存在上、删除在下，避免照搬桌面弹窗造成比例失衡。
- 验证通过：`pnpm build`。
- 将前端响应式架构规范写入 `AGENTS.md`：后续页面统一采用同一路由、业务逻辑共享、复杂视图拆 `DesktopView` / `MobileView`、桌面 modal 与移动 sheet 分离的标准。
- 继续收敛 ToDo 移动端比例：顶部标题/说明/指标卡再降一档，新建 ToDo 表单、优先级按钮、列表行和分组标题进一步 compact；移动端详情 sheet 隐藏右上角关闭叉，改用顶部 handle 和遮罩/操作按钮关闭。
- 验证通过：`pnpm build`。
- 拆分 ToDo 前端文件边界：`index.tsx` 收敛为数据编排、状态分组和 mutation 事件，新增 `todo.shared.ts` 管理类型/状态流转/样式 token，新增 `todo.components.tsx` 承载快速创建、列表、状态选择、加入今日气泡和详情 sheet/dialog，为后续按 `DesktopView` / `MobileView` 继续拆分打基础。
- 验证通过：`pnpm build`。
- 进一步抽出 `TodoView.tsx` 作为 ToDo 视图入口；`index.tsx` 现在只保留 query/mutation、数据分组和事件回调，视图 props 边界已形成，后续拆桌面/移动专用视图不会再牵动接口编排。
- 验证通过：`pnpm build`。
- 按“Web 端和移动端风格隔离”继续重构 ToDo：新增 `TodoDesktopView.tsx` 保留桌面端布局，新增 `TodoMobileView.tsx` 提供移动端专用信息架构；移动端顶部、指标、快速创建、Tab、列表行和待分配操作重新按小屏密度设计，不再复用桌面大卡片。
- ToDo 详情 sheet 继续做移动端密度优化：手机端标题、字段高度、备注区、日期输入和底部操作区整体收紧；桌面端通过 `sm:` 保持原有 modal 尺寸。
- 验证通过：`pnpm build`。`pnpm lint` 当前受项目 ESLint 9 配置缺失阻塞；Browser 插件仍返回 `Browser is not available: iab`，项目未安装 Playwright，未完成截图级 QA。

## 2026-06-17

- Phase 5 Chat 完成，详细计划见 `docs/plans/2026-06-17-chat-phase-5.md`，合并于 PR #6（commit f2267f6）。
- 新增 V1_15 Flyway 迁移：`chat_conversations` / `chat_messages` 两张表 + `chat` workflow_type 初始化。
- 后端实现：`ChatConversation` / `ChatMessage` Entity、Mapper、`ChatService`（含 SSE 流式发送、@Async AI 命名、动态推荐）、`ChatController`（8 个路由）。
- 前端实现：`chat.api.ts`、`useConversations` / `useMessages` / `useStreamingMessage` / `useSuggestions` hooks、`ChatSidebar`、`WelcomeView`、`ChatView`、`MessageBubble`（react-markdown + remark-gfm + react-syntax-highlighter）、`ChatInputBar`、`ConversationRenameDialog`、`SuggestionChips`。
- Settings 新增 Chat Tab：`ChatModelPanel.tsx` + `SettingsTab` 联合类型扩展 + `useWorkflowConfig('chat')` 接入，桌面/移动端同步。
- 移动端 Sheet 抽屉侧边栏适配完成。
- 验证：`pnpm build` 通过，`mise exec java@21 -- mvn -q test` 通过。

## 2026-06-13

- ToDo 日期控件纳入 `DESIGN.md` 产品规范：所有 ToDo 日期入口统一使用 Nexus 风格 `TodoDatePicker`，禁止裸露浏览器原生日期控件；清空动作内聚在组件内部。
- 修复 ToDo 日期清空后未回到“任务”的根因：MyBatis-Plus `updateById` 默认忽略 null，`TodoService.update` 改为 `UpdateWrapper` 显式写入 `scheduled_date` / `due_date`，并规定 `pending` 不得携带日期。
- 新增 ToDo 回归测试，覆盖清空计划日期、状态改为 `pending` 时清空日期、board 分组互斥等规则。
- 验证通过：`JAVA_HOME=/Users/manuelm/.local/share/mise/installs/java/21.0.2 ... mvn test`，后端 27 tests / 0 failures；`pnpm build` 通过。
- Phase 2 Translate 已完成：后端提供结构化翻译结果字段、`TranslationProviderPort`、LLM provider 和快速翻译 provider 预留；前端已拆为桌面/移动工作台、输入、结果、历史、ProviderEmptyState 等组件。
- Phase 2 验证覆盖：`TranslateServiceTest`、`TranslateStreamingServiceTest`、`ConfiguredFastTranslationProviderTest` 已在全量后端测试中通过；前端 `pnpm build` 通过。
- Phase 3 Inbox 准备启动：当前 Inbox 仍是本地 `inbox_items` 简单 CRUD，下一阶段要改为 Nexus 原生书签（复刻 Linkding 核心体验但不依赖 Linkding）、paperless-ngx 文档接入层和 Obsidian Quick Note / Memo。
