# ToDo 重构执行提示词

请你作为资深全栈工程师，在 Nexus 项目中完整重构 ToDo 模块的后端逻辑、前端交互和 UI。你必须先阅读项目根目录 `AGENTS.md`，并严格遵守其中的中文注释规范、前端响应式架构规范、技术栈约束和测试要求。

项目路径：

```text
/Users/manuelm/Workspace/Projects/Nexus/nexus
```

## 背景问题

当前 ToDo 交互存在以下问题：

1. 在“待分配”里打开 ToDo，手动设置计划日期后，无论是过去日期、今天还是未来日期，保存后仍然留在待分配分组。
2. 在“已过期”分组里把某条 ToDo 的计划日期改成今天后，这条 ToDo 会同时出现在“已过期”和“今日”两个分组里。
3. 当前“今日 / 历史”tab 已经承载不了新的信息架构，待分配、今日、未来、过期、历史的语义混在一起。
4. 快速添加里的“加入今日”按钮不符合新工作流，应该改为计划日期选择器。
5. 截止日期需要无感联动，但必须满足 `dueDate >= scheduledDate`。
6. 详情页字段顺序不合理，备注输入框太大，备注应该放到底部。
7. 移动端快速添加区域不能照搬桌面端控件堆叠；当前手机首屏里标题、优先级、日期、添加按钮全部展开，显得臃肿，必须改成移动端专用的轻量交互。
8. 日期选择器当前视觉风格和 Nexus 整体 UI 严重不一致，必须重构为全局统一的 Nexus 风格日期组件；后续所有 ToDo 日期入口都必须复用它。

第二个 bug 是本次重构必须彻底解决的核心验收点：同一条未完成 ToDo 任何时候只能属于 `today`、`future`、`overdue`、`tasks` 四个看板分组之一，不能同时出现在两个分组里。

## 总体设计方向

把 ToDo 的规则改成：

```text
状态 status 表示生命周期。
日期 scheduledDate / dueDate 决定业务分组。
后端统一计算分组。
前端只消费后端 board 结果，不再用多个 list 查询自行拼装分组。
```

顶部 tab 改为：

```text
ToDo List / 任务 / 历史
```

各 tab 含义：

```text
ToDo List:
  展示 今日、未来、已过期

任务:
  展示没有计划日期、没有截止日期的任务

历史:
  展示 done / cancelled，保留状态筛选
```

## 状态和日期语义

保留现有状态枚举，不要新增数据库状态：

```text
pending       未安排日期的任务池项目，UI 显示为“任务”
not_started   已安排日期，但未开始
in_progress   进行中
done          已完成，进入历史
cancelled     已取消，进入历史
```

日期字段：

```text
scheduledDate 计划日期，决定进入今日、未来、已过期或任务
dueDate       截止日期，只作为约束和展示，不单独决定“任务”页签
```

## 分组规则

后端必须提供统一接口：

```http
GET /api/v1/todo/board
```

返回：

```json
{
  "success": true,
  "data": {
    "today": [],
    "future": [],
    "overdue": [],
    "tasks": []
  }
}
```

分组必须以后端 `LocalDate.now()` 作为今天：

```text
history:
  status in ['done', 'cancelled']

tasks:
  status = 'pending'
  AND scheduledDate IS NULL
  AND dueDate IS NULL

overdue:
  status in ['not_started', 'in_progress']
  AND (
    scheduledDate < today
    OR dueDate < today
  )

today:
  status in ['not_started', 'in_progress']
  AND scheduledDate = today
  AND NOT overdue

future:
  status in ['not_started', 'in_progress']
  AND scheduledDate > today
  AND NOT overdue
```

注意：

```text
overdue 优先级高于 today/future。
today/future 必须显式排除 overdue，避免“过期改今日后重复出现”这类问题。
done/cancelled 不允许进入 board，只能进入历史。
```

如果一个 ToDo 的 `scheduledDate = today`，但 `dueDate < today`，它仍然属于 `overdue`，因为截止日期已经过期。

## 日期联动规则

创建 ToDo：

```text
不选计划日期:
  status = pending
  scheduledDate = null
  dueDate = null
  进入“任务”

选择过去日期:
  status = not_started
  scheduledDate = 过去日期
  dueDate = scheduledDate
  进入 ToDo List / 已过期

选择今天:
  status = not_started
  scheduledDate = 今天
  dueDate = scheduledDate
  进入 ToDo List / 今日

选择未来日期:
  status = not_started
  scheduledDate = 未来日期
  dueDate = scheduledDate
  进入 ToDo List / 未来
```

修改计划日期：

```text
如果 scheduledDate 被清空:
  scheduledDate = null
  dueDate = null
  status = pending
  回到“任务”

如果 scheduledDate 被设置:
  如果当前 status 是 pending，则 status = not_started
  如果 dueDate 为空，则 dueDate = scheduledDate
  如果 dueDate 不是用户本次手动改过，则 dueDate = scheduledDate
  如果 dueDate 是用户本次手动改过，则校验 dueDate >= scheduledDate
```

修改截止日期：

```text
dueDate 必须 >= scheduledDate
```

如果不满足，前端阻止保存并提示：

```text
截止日期不能早于计划日期
```

后端也必须校验同样规则，不能只依赖前端。

## 后端执行任务

### 1. DTO

修改：

```text
backend/src/main/java/com/nexus/dto/request/TodoCreateRequest.java
backend/src/main/java/com/nexus/dto/request/TodoUpdateRequest.java
```

`TodoCreateRequest` 新增：

```java
private LocalDate scheduledDate;
private LocalDate dueDate;
```

`TodoUpdateRequest` 新增：

```java
private Boolean clearScheduledDate;
private Boolean clearDueDate;
```

原因：当前 PATCH 里 `null` 表示“不修改”，无法表达“清空日期”，所以必须使用显式 clear flag。

新增：

```text
backend/src/main/java/com/nexus/dto/response/TodoBoardResponse.java
```

字段：

```java
private List<Todo> today;
private List<Todo> future;
private List<Todo> overdue;
private List<Todo> tasks;
```

### 2. Controller

修改：

```text
backend/src/main/java/com/nexus/controller/TodoController.java
```

新增接口：

```java
@GetMapping("/board")
public ApiResponse<TodoBoardResponse> board() {
    return ApiResponse.ok(todoService.board(LocalDate.now()));
}
```

现有 `/api/v1/todo`、`/api/v1/focus` 兼容路径保留。

### 3. Service

修改：

```text
backend/src/main/java/com/nexus/service/TodoService.java
```

新增：

```java
public TodoBoardResponse board(LocalDate today)
```

要求：

```text
一次查询非历史 ToDo，再在 Java 内按规则分组，或者使用 mapper 查询也可以。
必须保证一个 ToDo 只进入一个 board 分组。
分组顺序建议：overdue 判断先于 today/future。
```

创建逻辑：

```text
如果 req.scheduledDate 为空:
  status = pending
  dueDate = null

如果 req.scheduledDate 不为空:
  status = not_started
  scheduledDate = req.scheduledDate
  dueDate = req.dueDate != null ? req.dueDate : req.scheduledDate
  校验 dueDate >= scheduledDate
```

更新逻辑：

```text
支持 clearScheduledDate / clearDueDate。
如果 clearScheduledDate=true:
  scheduledDate = null
  dueDate = null
  status = pending

如果 scheduledDate 更新为非空:
  pending 转 not_started
  dueDate 为空时补成 scheduledDate

如果 dueDate 更新为非空:
  校验 dueDate >= scheduledDate

如果最终 scheduledDate 和 dueDate 都为空:
  status = pending
```

保留 `scheduleToday` 兼容旧接口，但前端不再调用。可以让它内部复用新日期归一化逻辑。

### 4. Mapper

检查：

```text
backend/src/main/java/com/nexus/mapper/TodoMapper.java
```

如果继续保留 `selectOverdue`，必须确保它排除 `done` 和 `cancelled`：

```sql
status NOT IN ('done', 'cancelled')
```

但更推荐 `board()` 统一分组后，前端不再使用 `overdue=true`。

### 5. 后端测试

修改：

```text
backend/src/test/java/com/nexus/service/TodoServiceTest.java
```

必须新增或调整测试覆盖：

```text
create without scheduledDate -> pending，scheduledDate/dueDate 为空，进入 tasks
create with past scheduledDate -> not_started，进入 overdue
create with today scheduledDate -> not_started，进入 today
create with future scheduledDate -> not_started，进入 future
pending update scheduledDate=today -> 不再属于 tasks，只属于 today
overdue update scheduledDate=today and dueDate=today -> 不再属于 overdue，只属于 today
scheduledDate=today but dueDate=yesterday -> 只属于 overdue，不属于 today
clearScheduledDate=true -> scheduledDate/dueDate 清空，status=pending，进入 tasks
dueDate before scheduledDate -> 抛 IllegalArgumentException，消息为“截止日期不能早于计划日期”
done/cancelled -> 不进入 board
```

## 前端执行任务

### 1. API 和类型

修改：

```text
frontend/src/types/domain.types.ts
frontend/src/api/todo.api.ts
```

新增类型：

```ts
export interface TodoBoardResponse {
  today: Todo[]
  future: Todo[]
  overdue: Todo[]
  tasks: Todo[]
}
```

`todoApi` 新增：

```ts
board: () => apiClient.get<ApiResponse<TodoBoardResponse>>('/todo/board')
```

修改 create：

```ts
create: (data: {
  title: string
  priority?: TodoPriority
  scheduledDate?: string | null
  dueDate?: string | null
})
```

修改 update：

```ts
update: (id: string, data: Partial<Todo> & {
  clearScheduledDate?: boolean
  clearDueDate?: boolean
})
```

### 2. 共享类型和工具

修改：

```text
frontend/src/pages/ToDo/todo.shared.ts
```

把：

```ts
export type TodoTab = 'today' | 'history'
```

改为：

```ts
export type TodoTab = 'list' | 'tasks' | 'history'
```

新增必要的日期辅助函数：

```ts
export const isBeforeDate = (a: string, b: string) => a < b
export const isDueDateInvalid = (scheduledDate?: string, dueDate?: string) =>
  Boolean(scheduledDate && dueDate && dueDate < scheduledDate)
```

### 3. 页面数据编排

修改：

```text
frontend/src/pages/ToDo/index.tsx
```

核心要求：

```text
只使用 todoApi.board() 获取 today/future/overdue/tasks。
移除 pendingQuery、todayQuery、overdueQuery、scheduleMutation。
所有 create/update/status/delete 成功后 invalidate ['todo']。
不要再让前端用多个 list 查询拼装 ToDo List。
```

创建 mutation：

```text
不再先 create 再 scheduleToday。
直接 todoApi.create({ title, priority, scheduledDate, dueDate })。
如果 scheduledDate 有值，dueDate 默认传 scheduledDate。
```

这样可以避免缓存时序导致同一条数据在“已过期”和“今日”同时显示。

### 4. Tab 和视图

修改：

```text
frontend/src/pages/ToDo/TodoDesktopView.tsx
frontend/src/pages/ToDo/TodoMobileView.tsx
frontend/src/pages/ToDo/TodoView.tsx
```

tab 改为：

```text
ToDo List / 任务 / 历史
```

`ToDo List` 内展示三个 section：

```text
今日
未来
已过期
```

`任务` 内展示：

```text
无日期任务
```

`历史` 保持状态筛选能力。

桌面和移动端都要遵守当前项目的响应式约束：同一路由、业务逻辑共享、复杂视图拆 Desktop/Mobile。

### 5. 快速添加

修改：

```text
frontend/src/pages/ToDo/todo.components.tsx
frontend/src/pages/ToDo/TodoMobileView.tsx
```

去掉“加入今日”按钮。

快速添加应包含：

```text
标题输入
优先级选择
计划日期选择器
添加按钮
```

桌面端可以使用单行横向布局，但日期清空交互必须内聚在日期选择器里：

```text
标题输入、优先级、日期选择器、添加按钮使用 grid/flex 明确分区。
日期选择器内部提供清空动作，不要在日期选择器和添加按钮之间放一个外置 X。
添加按钮宽度固定或设置 min-width，例如 112px。
日期选择器宽度固定或设置合理 min/max，例如 220px 到 280px。
```

移动端必须重新设计为“默认轻量、按需展开”，不要把桌面端完整表单直接纵向堆叠：

```text
默认只展示：
  标题输入框
  添加按钮

当输入框获得焦点、已有输入内容、或用户点击设置入口时，才展开第二层设置：
  优先级 segmented control
  日期快捷 chip

添加成功后：
  清空标题
  收起设置层
  优先级重置为 medium
  日期清空
```

移动端布局建议：

```text
第一行：
  [写下要处理的事                    ] [添加]

第二行，仅展开时显示：
  [低] [中] [高]
  [今天] [明天] [选日期]
```

移动端日期不要默认展示完整宽日期输入框。优先使用快捷 chip：

```text
今天
明天
选日期
```

点击“选日期”后再打开日期选择器。选中日期后 chip 显示短日期，例如 `06/13`。清空日期动作放在日期选择器弹层或选中日期 chip 内部，不要额外占一颗孤立按钮。这样手机首屏不会被快速添加区占满。

行为：

```text
不选日期 -> 创建到“任务”
选过去日期 -> 创建到“已过期”
选今天 -> 创建到“今日”
选未来 -> 创建到“未来”
清空日期 -> 创建到“任务”
```

### 6. 日期选择器

必须新增或抽取共享组件：

```text
frontend/src/pages/ToDo/components/TodoDatePicker.tsx
```

也可以放在 `todo.components.tsx`，但如果文件过大，优先单独拆分。

组件 API：

```ts
type TodoDatePickerProps = {
  value?: string
  onChange: (value: string) => void
  allowClear?: boolean
  compact?: boolean
  invalid?: boolean
  placeholder?: string
  quickOptions?: boolean
}
```

组件职责：

```text
统一 ToDo 内所有计划日期和截止日期输入。
统一日期展示格式、placeholder、选中态、清空动作和错误态。
清空动作必须是组件内部能力，不允许调用方在旁边额外摆一个 X。
支持“今天”快捷动作。
支持 allowClear=true 时在弹层底部或选中日期尾部展示清空动作。
```

视觉要求：

```text
触发器必须是 Nexus 风格：rounded-lg、border、bg-card 或 bg-background、text-muted-foreground、focus ring、hover bg-accent。
图标使用 lucide CalendarDays 和 X，但 X 必须在组件内部。
日期弹层使用项目现有 Radix Popover 风格：rounded-lg、border、bg-popover、shadow-lg、z-index 与现有菜单一致。
弹层底部动作使用文字按钮：“清除”“今天”，颜色和项目按钮体系一致。
不要暴露系统原生 date input 的默认视觉作为页面主 UI。
不要引入新 UI 库。
```

实现建议：

```text
优先用 Radix Popover + 自定义触发器 + 内部隐藏或透明的 input[type=date] 作为第一版。
如果实现完整日历网格成本太高，可以让“选日期”点击后触发隐藏的原生 date input，但页面可见的触发器和清空/今天动作必须完全是 Nexus 风格。
桌面快速添加、移动快速添加、任务卡片、详情页计划日期、详情页截止日期都必须使用同一个 TodoDatePicker。
```

如果使用浏览器原生 date picker，系统弹出的日期面板无法完全定制可以接受；但页面里可见的触发器、选中日期、清空动作、今天动作、hover/focus/disabled/invalid 状态必须和 Nexus UI 保持一致。UI 风格一致是 Nexus 产品底线。

### 7. 卡片重设计

#### 任务 tab 卡片

展示：

```text
标题
优先级
计划日期选择器
取消按钮
```

行为：

```text
选择计划日期后调用 update：
  scheduledDate = selectedDate
  dueDate = selectedDate
  status = not_started

保存成功后该任务必须从“任务”消失，进入 ToDo List 对应分组。
```

取消按钮必须二次确认：

```text
确认后 status = cancelled，进入历史。
```

#### 今日卡片

展示：

```text
标题
优先级
截止日期
状态按钮
```

#### 未来卡片

展示：

```text
标题
优先级
计划日期
截止日期
状态按钮
```

#### 已过期卡片

展示：

```text
标题
优先级
计划日期
截止日期
状态按钮
```

视觉：

```text
使用轻微 destructive 风格提示过期。
不要整卡强红，不要破坏信息可读性。
```

### 8. 详情页

修改：

```text
frontend/src/pages/ToDo/todo.components.tsx
```

`TodoDetailDialog` 字段顺序改为：

```text
标题
优先级
状态
计划日期
截止日期
备注
操作按钮
```

备注：

```text
放在最下面。
默认 2 行左右。
内容多时自适应变高。
设置 max-height，超过后允许滚动。
```

建议实现：

```ts
onInput={(event) => {
  const el = event.currentTarget
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, 192)}px`
}}
```

详情页必须实现 `dueDateTouched`：

```ts
const [dueDateTouched, setDueDateTouched] = useState(false)
```

打开详情时：

```text
dueDateTouched = false
```

用户手动改截止日期时：

```text
dueDateTouched = true
```

用户改计划日期时：

```text
如果新计划日期为空：
  scheduledDate = ''
  dueDate = ''

如果新计划日期不为空且 dueDateTouched=false：
  dueDate = scheduledDate

如果 dueDateTouched=true：
  不自动覆盖 dueDate，但保存前校验 dueDate >= scheduledDate
```

保存前校验：

```text
如果 scheduledDate 和 dueDate 都存在，且 dueDate < scheduledDate：
  阻止保存
  显示“截止日期不能早于计划日期”
```

保存清空日期时必须传：

```ts
{
  clearScheduledDate: true,
  clearDueDate: true
}
```

不能只传 `undefined`，否则后端会理解为“不修改”。

## 必须修复的重复分组 bug

当前 bug：

```text
在已过期分组修改 todo 的计划日期为今日后，过期分组还保留这条 todo，今日分组里也出现同一条。
```

修复原则：

```text
1. 前端不要再用 todayQuery + overdueQuery + pendingQuery 多查询拼装。
2. 前端统一使用 boardQuery。
3. 后端 board() 保证互斥分组。
4. mutation 成功后 invalidate ['todo']。
5. 如果保留旧 list/overdue 接口，也不能影响新页面。
```

验收：

```text
把一条 overdue ToDo 的 scheduledDate 和 dueDate 都改为今天后：
  board.today 包含它
  board.overdue 不包含它
  页面只在“今日”显示一次
```

## 验证命令

后端：

```bash
cd backend && mvn test
```

前端：

```bash
cd frontend && pnpm build
```

手动验收：

```text
1. 快速添加不选日期，进入“任务”。
2. 快速添加过去日期，进入“已过期”。
3. 快速添加今天，进入“今日”。
4. 快速添加未来日期，进入“未来”。
5. 任务页中给任务选择日期后，任务从“任务”消失并进入对应 ToDo List 分组。
6. 已过期任务的计划日期和截止日期都改为今天后，只出现在“今日”，不再保留在“已过期”。
7. scheduledDate=today 但 dueDate=yesterday 时，只出现在“已过期”。
8. 详情页清空计划日期后，任务回到“任务”。
9. 截止日期早于计划日期时，前端提示，后端也拒绝。
10. 取消任务需要二次确认，确认后进入历史。
11. 桌面端和移动端布局都正常，没有文字重叠、按钮溢出或卡片错位。
12. 移动端快速添加默认状态不能占据大块首屏空间；默认只保留标题输入和添加按钮，优先级与日期设置按需展开。
13. 桌面端日期清空动作必须在 TodoDatePicker 内部完成，不能在日期选择器和添加按钮之间出现孤立外置 X。
14. 顶部统计卡如果使用颜色区分，就所有卡片都要有一致的颜色体系，不允许只有“已过期”有颜色、其他卡片全是无差别白色。
15. 桌面快速添加、移动快速添加、任务卡片和详情页所有日期入口都必须复用同一个 Nexus 风格 TodoDatePicker，不能出现风格不一致的日期控件。
```

## 实施约束

```text
不要修改已应用的 Flyway 历史迁移。
不要引入新的 UI 库。
不要做无关重构。
不要删除 /focus 兼容路径。
前端响应式必须保持同一路由，不新增 /m/todo。
复杂桌面/移动差异继续放在 DesktopView/MobileView。
所有新增导出 React 组件顶部必须有一行中文用途注释。
后端 Service/Controller/Component 类和非平凡 public 方法必须有中文注释或 Javadoc。
注释解释 WHY，不写废话注释。
```

请按“后端规则和测试 -> 前端 API/数据编排 -> UI 重构 -> 验证”的顺序执行，并在每个阶段运行相关测试或构建。
