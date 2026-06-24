# Settings System 拆分与 Jobs/Tasks 入口收敛实施计划

## 背景

Nexus 当前 Settings 页面里有一个 `System` tab，对应 `SystemConfigSection`。它同时承担两类职责：

1. 展示 `Jobs / Tasks` 入口，跳转到 `/tasks`。
2. 暴露 `/settings/system` 返回的所有 `system_configs` key-value，并允许直接编辑。

经过代码排查，目前 `/tasks` 页面、`taskApi`、`TaskController`、`TaskService` 和 `TaskCleanupScheduler` 都存在，但当前业务模块没有调用 `TaskService.create()`、`markRunning()`、`markCompleted()`、`markFailed()` 等生命周期方法。因此 Jobs/Tasks 前台入口目前基本是空入口。

同时，Settings 已经有按业务域拆分的专用 tab，例如 `Crawl`、`Notes`、`Mindbank`、`Panel Hub`。继续保留 `System` 通用 key-value 编辑器，会导致同一配置存在多个入口，并绕过专用表单的校验、脱敏和测试连接逻辑。

本次任务目标是：移除前台 `System` 入口，把仍有业务价值的配置迁移到对应子 tab，保留后端 Jobs/Tasks 基础设施，并修复 Mindbank Obsidian 子目录配置 key 不一致问题。

## 目标

1. Jobs / Tasks：
   - 去掉前台显性入口。
   - 保留 `/tasks` 路由、`TasksPage`、`taskApi`、后端 `TaskController`、`TaskService`、`TaskCleanupScheduler`。
   - 后端基础框架做好中文注释，说明这是预留长任务基础设施，当前不在前台显性暴露。

2. System 设置：
   - 移除 Settings 里的 `System` tab。
   - 删除前端对 `/settings/system` 的查询、props、状态和渲染。
   - 不再暴露通用 key-value 编辑器。
   - 将仍有业务价值的 system config 分别放进对应业务 tab。

3. Mindbank key 修复：
   - 排查并修复 `mindbank.obsidian.sub_folder` 与 `notes.obsidian.sub_folder` 不一致问题。
   - 统一使用 `mindbank.obsidian.sub_folder`。
   - 增加兼容迁移，避免历史数据丢失。

## 非目标

1. 不删除后端 `tasks` 表。
2. 不删除 `TaskService`、`TaskController`、`TaskMapper`、`TaskCleanupScheduler`。
3. 不把所有 `system_configs` 都重新塞进 UI。
4. 不修改已经应用过的 Flyway 迁移文件，只能新增迁移。
5. 不做无关 UI 重构。
6. 不接入新的异步任务执行逻辑；本次只隐藏入口并保留基础设施。

## 现状确认

### Jobs / Tasks

已有文件：

- `frontend/src/router.tsx`
  - 已注册 `{ path: 'tasks', element: <Wrap><TasksPage /></Wrap> }`
- `frontend/src/pages/Tasks/index.tsx`
  - 已实现任务列表、刷新、保留、删除。
- `frontend/src/api/task.api.ts`
  - 已实现 list/get/toggleKeep/delete API。
- `backend/src/main/java/com/nexus/controller/TaskController.java`
  - 已实现 list/get/toggleKeep/delete。
- `backend/src/main/java/com/nexus/service/TaskService.java`
  - 已实现 create/markRunning/markCompleted/markFailed/toggleKeep/delete。
- `backend/src/main/java/com/nexus/scheduler/TaskCleanupScheduler.java`
  - 已实现每日清理归档。

问题：

- 当前业务代码未调用 `TaskService.create()` 和状态流转方法。
- Mindbank Agent 使用的是自己的 `mindbank_agent_tasks` 表和 `/mindbank/agent/tasks` API，不会显示在通用 `/tasks` 页面。
- 因此前台入口暂时没有实际使用价值。

### SystemConfigSection

当前文件：

- `frontend/src/pages/Settings/components/SystemConfigSection.tsx`

当前职责：

- 显示 `Jobs / Tasks` 链接。
- 展示全部 system config key-value。
- 直接 PATCH `/settings/system` 保存。

问题：

- 配置没有业务分组。
- 密钥类/集成类配置可能绕过专用接口的脱敏和加密语义。
- Settings 信息架构已经有业务域 tab，`System` 变成杂项入口。

### Mindbank Obsidian 子目录 key 不一致

已确认：

- `MindBankSettingsService` 使用：
  - `mindbank.obsidian.sub_folder`
- 以下业务代码读取：
  - `notes.obsidian.sub_folder`

需要检查并替换的文件：

- `backend/src/main/java/com/nexus/service/MindBankAgentTools.java`
- `backend/src/main/java/com/nexus/service/MindBankPipelineService.java`
- `backend/src/main/java/com/nexus/service/MindBankSuggestionExecutor.java`

统一方向：

- 使用 `mindbank.obsidian.sub_folder`
- 这是 Mindbank 专属配置，语义比 `notes.obsidian.sub_folder` 更准确。

## 文件影响范围

### 前端

删除或弃用：

- `frontend/src/pages/Settings/components/SystemConfigSection.tsx`

修改：

- `frontend/src/pages/Settings/index.tsx`
- `frontend/src/pages/Settings/SettingsDesktopView.tsx`
- `frontend/src/pages/Settings/SettingsMobileView.tsx`
- `frontend/src/api/settings.api.ts`
- `frontend/src/types/domain.types.ts`
- `frontend/src/pages/Settings/components/CrawlSettingsPanel.tsx`
- `frontend/src/pages/Settings/components/NotesSettingsPanel.tsx`
- `frontend/src/pages/Settings/components/SubscriptionCategoriesPanel.tsx`

可选新增：

- `frontend/src/pages/Settings/components/SubscriptionNotificationSettingsPanel.tsx`

保留：

- `frontend/src/pages/Tasks/index.tsx`
- `frontend/src/api/task.api.ts`

### 后端

保留并补注释：

- `backend/src/main/java/com/nexus/service/TaskService.java`
- `backend/src/main/java/com/nexus/controller/TaskController.java`
- `backend/src/main/java/com/nexus/scheduler/TaskCleanupScheduler.java`

修改：

- `backend/src/main/java/com/nexus/controller/SettingsController.java`
- `backend/src/main/java/com/nexus/service/MindBankSettingsService.java`
- `backend/src/main/java/com/nexus/service/MindBankPipelineService.java`
- `backend/src/main/java/com/nexus/service/MindBankAgentTools.java`
- `backend/src/main/java/com/nexus/service/MindBankSuggestionExecutor.java`

可选新增：

- `backend/src/main/java/com/nexus/config/SystemConfigKeys.java`
- `backend/src/main/java/com/nexus/dto/response/SubscriptionSettingsResponse.java`
- `backend/src/main/java/com/nexus/dto/request/SubscriptionSettingsUpdateRequest.java`

新增迁移：

- `backend/src/main/resources/db/migration/V1_x__normalize_mindbank_obsidian_key.sql`

实际版本号按当前迁移最大版本顺延，不要覆盖已有迁移。

## 实施任务

### Task 1：移除 Settings 前台 System 入口

目标：Settings 不再显示 `System` tab，也不再查询 `/settings/system`。

步骤：

1. 修改 `frontend/src/pages/Settings/SettingsDesktopView.tsx`
   - 从 `SettingsTab` union 中删除 `'system'`。
   - 删除 `SystemConfigSection` import。
   - 删除 `SystemConfigSectionProps` import。
   - 从 `SettingsViewProps` 删除 `systemConfig`。
   - 从 tabs 数组删除 `{ key: 'system', label: 'System' }`。
   - 删除 `activeSettingsTab === 'system'` 渲染块。

2. 修改 `frontend/src/pages/Settings/SettingsMobileView.tsx`
   - 删除 `SystemConfigSection` import。
   - 删除 `SystemConfigSectionProps` import。
   - 从 props 删除 `systemConfig`。
   - 从 tabs 数组删除 `{ key: 'system', label: 'System' }`。
   - 删除 `activeSettingsTab === 'system'` 渲染块。

3. 修改 `frontend/src/pages/Settings/index.tsx`
   - 初始 tab 判断中删除 `tab === 'system'`。
   - 删除 `/settings/system` query：
     - `sysRes`
     - `sysLoading`
     - `sysError`
   - 删除系统配置变更状态：
     - `overrides`
     - `dirty`
     - `sysSaveMutation`
     - `handleOverrideChange`
     - `handleOverridesCancel`
   - 从 `sharedProps` 删除 `systemConfig`。

4. 删除 `frontend/src/pages/Settings/components/SystemConfigSection.tsx`
   - 删除前先全局确认没有引用：
     ```bash
     rg -n "SystemConfigSection|systemConfig|tab === 'system'|settings/system" frontend/src
     ```

5. 保留 `/tasks` 路由和 `TasksPage`
   - 不从 `router.tsx` 删除 `/tasks`。
   - 不从 `task.api.ts` 删除 API。
   - 只是去掉 Settings 中通往它的显性入口。

验证：

```bash
cd frontend
pnpm build
```

预期：

- TypeScript 不再报 `systemConfig`、`SystemConfigSection`、`system` tab 相关错误。
- Settings 页面不再显示 `System` tab。
- 浏览器直接访问 `/tasks` 仍能打开。

### Task 2：保留后端 Jobs/Tasks 基础框架并补注释

目标：后端 Task 基础设施保留，但注释清晰说明它目前是预留长任务基础设施。

修改 `backend/src/main/java/com/nexus/service/TaskService.java`：

- 类注释补充：
  - 这是未来 Crawl 导入、批量处理、订阅同步、AI 长任务共用的任务生命周期服务。
  - 当前前台暂不显性暴露入口。
  - 业务模块接入时应统一通过该服务创建和流转状态。

修改 `backend/src/main/java/com/nexus/controller/TaskController.java`：

- 类注释补充：
  - 这是通用任务查询接口。
  - 接口保留给未来任务中心和内部调试使用。
  - 当前不是所有业务长任务都已接入。

修改 `backend/src/main/java/com/nexus/scheduler/TaskCleanupScheduler.java`：

- 添加类级注释：
  - 每日归档过期任务。
  - 该清理任务属于后端基础设施，不依赖前台入口是否展示。

注意：

- 按 AGENTS.md 要求，中文注释优先。
- 注释解释 WHY，不写废话。
- 不改行为。

验证：

```bash
cd backend
mvn test
```

预期：无行为变更，测试通过。

### Task 3：将 system config 拆到对应子 tab

#### 3.1 已有专用设置，保留现状

这些配置已有对应专用面板，不需要再从 System 暴露：

- `crawl.crawl4ai.url`
  - `frontend/src/pages/Settings/components/CrawlSettingsPanel.tsx`
- `crawl.markitdown.url`
  - `frontend/src/pages/Settings/components/CrawlSettingsPanel.tsx`
- `notes.obsidian.vault_path`
  - `frontend/src/pages/Settings/components/NotesSettingsPanel.tsx`
- Mindbank 外部服务、认证、模型、流水线行为
  - `frontend/src/pages/Settings/components/MindBankSettingsPanel.tsx`

保持这些面板现有显式保存逻辑，不要改成自动保存。

#### 3.2 新增订阅提醒天数设置

当前 `subscription.notify_days_before` 被 `SubscriptionNotifyScheduler` 使用：

- `backend/src/main/java/com/nexus/scheduler/SubscriptionNotifyScheduler.java`

它应该归到 `Panel Hub` / `subscriptions` tab。

后端建议：

1. 新增 DTO：

`backend/src/main/java/com/nexus/dto/response/SubscriptionSettingsResponse.java`

```java
package com.nexus.dto.response;

import lombok.Data;

/** SubscriptionSettingsResponse 返回 Panel Hub 中订阅提醒相关设置。 */
@Data
public class SubscriptionSettingsResponse {
    private int notifyDaysBefore;
}
```

`backend/src/main/java/com/nexus/dto/request/SubscriptionSettingsUpdateRequest.java`

```java
package com.nexus.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.Data;

/** SubscriptionSettingsUpdateRequest 用于更新订阅提醒策略，避免暴露原始 system_config key。 */
@Data
public class SubscriptionSettingsUpdateRequest {
    @Min(1)
    @Max(90)
    private Integer notifyDaysBefore;
}
```

2. 在 `SettingsController` 增加接口：

- `GET /api/v1/settings/subscriptions`
- `PUT /api/v1/settings/subscriptions`

逻辑：

- 读取 `subscription.notify_days_before`
- 默认值 `7`
- 保存时写回 `SystemConfigService.upsert("subscription.notify_days_before", String.valueOf(value), null)`
- 范围建议 `1-90`

3. 可选：把 key 抽到 `SystemConfigKeys` 常量类，避免重复硬编码。

前端建议：

1. 修改 `frontend/src/types/domain.types.ts`

新增：

```ts
export interface SubscriptionSettings {
  notifyDaysBefore: number
}

export interface SubscriptionSettingsUpdateRequest {
  notifyDaysBefore?: number
}
```

2. 修改 `frontend/src/api/settings.api.ts`

新增：

```ts
getSubscriptionSettings: () =>
  apiClient.get<ApiResponse<SubscriptionSettings>>('/settings/subscriptions'),

saveSubscriptionSettings: (data: SubscriptionSettingsUpdateRequest) =>
  apiClient.put<ApiResponse<SubscriptionSettings>>('/settings/subscriptions', data),
```

3. 新增组件：

`frontend/src/pages/Settings/components/SubscriptionNotificationSettingsPanel.tsx`

职责：

- 查询订阅提醒设置。
- 展示 `到期前提醒天数` 数字输入。
- 范围：1-90。
- 显式保存。
- 保存后 invalidate `['settings', 'subscriptions']`。

4. 修改 subscriptions tab 渲染：

在 `SettingsDesktopView.tsx` 和 `SettingsMobileView.tsx` 的 `activeSettingsTab === 'subscriptions'` 分支里，把新组件放在：

- `SubscriptionModelPanel` 后
- `SubscriptionCategoriesPanel` 前或后均可

建议顺序：

1. AI 模型
2. 提醒策略
3. 分类管理

#### 3.3 暂不暴露的配置

这些配置本次不搬到 UI：

- `task.cleanup_days`
  - 因为 Tasks 前台入口隐藏，且当前无用户可操作场景。
- `todo.archive_days`
  - 如果当前 Todo 没有专用设置页和实际读取逻辑，不要硬塞。
- `todo.rollover_time`
  - 同上。
- `crawler.preferred`
  - 当前未发现实际读取，暂不暴露。
- `mindbank.default_domain`
  - 当前未发现实际读取，暂不暴露。

原则：只有“当前被业务读取、用户有明确设置意图、有对应业务 tab”的配置才搬到 UI。

### Task 4：修复 Mindbank Obsidian 子目录 key 不一致

推荐方案：统一使用 `mindbank.obsidian.sub_folder`。

理由：

- 这是 Mindbank 专属配置。
- `MindBankSettingsService` 和前端 `MindBankSettingsPanel` 已经使用该语义。
- `notes.obsidian.sub_folder` 容易和 Notes 全局 vault/path 概念混淆。

实施步骤：

1. 新增常量类：

`backend/src/main/java/com/nexus/config/SystemConfigKeys.java`

```java
package com.nexus.config;

/**
 * SystemConfigKeys 集中维护 system_configs 的业务 key，避免不同模块手写字符串导致读写不一致。
 */
public final class SystemConfigKeys {
    private SystemConfigKeys() {}

    public static final String NOTES_OBSIDIAN_VAULT_PATH = "notes.obsidian.vault_path";
    public static final String MINDBANK_OBSIDIAN_SUB_FOLDER = "mindbank.obsidian.sub_folder";
    public static final String SUBSCRIPTION_NOTIFY_DAYS_BEFORE = "subscription.notify_days_before";
}
```

2. 修改 `MindBankSettingsService`

把：

```java
private static final String K_OBSIDIAN_SUB_FOLDER = "mindbank.obsidian.sub_folder";
```

改为使用：

```java
SystemConfigKeys.MINDBANK_OBSIDIAN_SUB_FOLDER
```

3. 修改以下文件，把所有读取 `notes.obsidian.sub_folder` 的地方替换成 `mindbank.obsidian.sub_folder`：

- `backend/src/main/java/com/nexus/service/MindBankAgentTools.java`
- `backend/src/main/java/com/nexus/service/MindBankPipelineService.java`
- `backend/src/main/java/com/nexus/service/MindBankSuggestionExecutor.java`

替换前：

```java
systemConfigService.get("notes.obsidian.sub_folder", "Mindbank")
```

替换后：

```java
systemConfigService.get(SystemConfigKeys.MINDBANK_OBSIDIAN_SUB_FOLDER, "Mindbank")
```

4. 新增 Flyway 迁移：

文件名示例：

`backend/src/main/resources/db/migration/V1_x__normalize_mindbank_obsidian_key.sql`

实际 `V1_x` 按当前最新迁移版本顺延。

SQL：

```sql
-- 将历史误用的 notes.obsidian.sub_folder 兼容迁移到 Mindbank 专属 key。
-- 不删除旧 key，避免未知历史代码或手工数据依赖被破坏。
INSERT INTO system_configs (id, config_key, config_val, description)
SELECT gen_random_uuid()::text,
       'mindbank.obsidian.sub_folder',
       config_val,
       'Mindbank Obsidian 子文件夹'
FROM system_configs
WHERE config_key = 'notes.obsidian.sub_folder'
  AND NOT EXISTS (
    SELECT 1 FROM system_configs WHERE config_key = 'mindbank.obsidian.sub_folder'
  );
```

5. 不删除旧 key。

原因：

- 历史数据库里可能存在该 key。
- 本次目标是统一新代码读取方向，不做破坏性清理。

验证：

```bash
rg -n "notes\\.obsidian\\.sub_folder" backend/src/main/java
```

预期：业务 Java 代码中不再出现该 key。

允许出现在新增迁移 SQL 和说明注释中。

### Task 5：测试

#### 后端测试建议

1. 增加 Subscription settings API 测试：

覆盖：

- 未配置时返回默认 `7`
- 保存 `14` 后再次读取为 `14`
- 保存 `0` 或 `91` 返回校验错误

可放在：

- `backend/src/test/java/com/nexus/controller/SettingsControllerTest.java`

如果当前没有该测试结构，也可以加 service 层测试，但 Controller 层更能覆盖 validation。

2. 增加 Mindbank key 读取测试：

覆盖：

- 写入 `mindbank.obsidian.sub_folder = "Knowledge/Mindbank"`
- 调用涉及 Mindbank 输出路径的服务方法或可测试的路径构造方法
- 断言使用 `"Knowledge/Mindbank"`，不是默认 `"Mindbank"`，也不是 `notes.obsidian.sub_folder`

如果现有服务方法不好测，可以先把路径构造逻辑抽出为小方法，并只抽到当前类内，避免过度重构。

#### 前端测试/构建

至少运行：

```bash
cd frontend
pnpm build
```

#### 后端测试

```bash
cd backend
mvn test
```

#### 全局搜索验收

```bash
rg -n "notes\\.obsidian\\.sub_folder|SystemConfigSection|tab === 'system'|settings/system" frontend/src backend/src
```

预期：

- `SystemConfigSection` 无引用。
- `tab === 'system'` 无引用。
- 前端无 `/settings/system` 请求。
- `notes.obsidian.sub_folder` 不再被 Java 业务代码读取。
- 如果出现在 Flyway 迁移中，可以接受。

## 验收标准

1. Settings 页面：
   - 桌面端和移动端都不显示 `System` tab。
   - 不再请求 `/settings/system`。
   - Crawl、Notes、Mindbank、Panel Hub 设置可正常使用。

2. Jobs / Tasks：
   - Settings 中没有 Jobs / Tasks 入口。
   - `/tasks` 直接访问仍可打开。
   - 后端 Task 基础设施仍保留。
   - 相关类有清晰中文注释说明保留原因。

3. Subscription：
   - Panel Hub / subscriptions tab 可设置订阅到期前提醒天数。
   - 后端 scheduler 读取同一个 key。
   - 输入范围有校验。

4. Mindbank：
   - UI 保存的 `obsidianSubFolder` 能被 pipeline/agent/suggestion executor 实际读取。
   - 不再出现写一个 key、读另一个 key 的问题。

5. 构建测试：
   - `cd frontend && pnpm build` 通过。
   - `cd backend && mvn test` 通过。

## 建议提交拆分

1. `refactor: 移除 Settings System 前台入口`
2. `docs: 注释说明 Task 基础设施保留原因`
3. `feat: 添加 Panel Hub 订阅提醒设置`
4. `fix: 统一 Mindbank Obsidian 子目录配置 key`
5. `test: 补充 Settings 和 Mindbank 配置测试`

## 给 DeepSeek 的执行提示词

```text
你在 /Users/manuelm/Workspace/Projects/Nexus/nexus 工作。请严格遵守 AGENTS.md 里的 Nexus 项目开发准则，尤其是：
- Java 后端类级别和非平凡 public 方法必须有中文注释或 Javadoc。
- React 导出组件顶部必须有一行中文注释说明用途。
- Settings 页面必须遵守“同一路由、业务共享、视图按复杂度拆分”的响应式规范。
- 不要修改已经应用过的 Flyway 迁移文件，只能新增迁移。
- 不要做无关重构。

任务目标：

1. 移除 Settings 页面前台 System tab 和 SystemConfigSection。
   - 删除前端对 /settings/system 的 query、state、mutation、props 和渲染分支。
   - 从 SettingsDesktopView 和 SettingsMobileView 的 tabs 中删除 System。
   - 删除 SystemConfigSection 文件或确保它无引用。
   - 保留 /tasks 路由、TasksPage 和 taskApi，但不在 Settings 或导航中提供显性入口。

2. 保留后端 Jobs/Tasks 基础设施。
   - 保留 TaskController、TaskService、TaskMapper、TaskCleanupScheduler 和 tasks 表。
   - 只补充中文注释，说明这是未来 Crawl 导入、批量处理、订阅同步、AI 长任务共用的预留基础设施，当前前台暂不显性暴露。
   - 不要改变现有行为。

3. 将 system config 拆入对应子 tab。
   - Crawl URL 配置已有 CrawlSettingsPanel，保留。
   - Notes vault path 已有 NotesSettingsPanel，保留。
   - Mindbank 设置已有 MindBankSettingsPanel，保留。
   - 新增 subscription.notify_days_before 到 Panel Hub / subscriptions 设置中：
     - 后端新增 GET /api/v1/settings/subscriptions
     - 后端新增 PUT /api/v1/settings/subscriptions
     - 默认值 7
     - 校验范围 1-90
     - 前端新增 SubscriptionNotificationSettingsPanel 或等价组件，放在 subscriptions tab 中。
   - 不要把 task.cleanup_days、todo.archive_days、todo.rollover_time、crawler.preferred、mindbank.default_domain 暴露到 UI，除非发现它们当前有明确业务读取逻辑。

4. 修复 Mindbank Obsidian 子目录 key 不一致。
   - 统一使用 mindbank.obsidian.sub_folder。
   - 新增 SystemConfigKeys 常量类，集中维护至少：
     - notes.obsidian.vault_path
     - mindbank.obsidian.sub_folder
     - subscription.notify_days_before
   - 替换 MindBankPipelineService、MindBankAgentTools、MindBankSuggestionExecutor 中读取 notes.obsidian.sub_folder 的代码。
   - MindBankSettingsService 也改用同一个常量。
   - 新增 Flyway 迁移：如果历史数据库存在 notes.obsidian.sub_folder 且不存在 mindbank.obsidian.sub_folder，则复制旧值到新 key。不要删除旧 key。

5. 补充测试。
   - Subscription settings API：默认值、保存、范围校验。
   - Mindbank 子目录 key：确认业务读取 mindbank.obsidian.sub_folder。

验证命令：

cd frontend && pnpm build
cd backend && mvn test
rg -n "notes\\.obsidian\\.sub_folder|SystemConfigSection|tab === 'system'|settings/system" frontend/src backend/src

验收要求：
- Settings 桌面端和移动端都不再显示 System tab。
- 前端不再请求 /settings/system。
- /tasks 直接访问仍可打开，但没有显性入口。
- Panel Hub 可以配置订阅到期前提醒天数。
- Mindbank UI 保存的 Obsidian 子文件夹能被 pipeline/agent/suggestion executor 实际读取。
- 前后端构建测试通过。
```
