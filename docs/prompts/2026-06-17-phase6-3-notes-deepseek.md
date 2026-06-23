# Phase 6.3 — Notes 页面提示词

执行计划：`docs/superpowers/plans/2026-06-17-mindbank-crawl-phase6.md`（Phase 6.4 节）  
设计文档：`docs/superpowers/specs/2026-06-17-mindbank-crawl-phase6-design.md`（第 13 节）  
前置：Phase 6.1 完成（后端基础设施），Phase 6.2 完成（Settings 中已有 vault 路径配置）

---

你正在开发 Nexus 项目（路径：`/Users/manuelm/Workspace/Projects/Nexus/nexus`），Spring Boot 3.x 后端 + React 18 + TypeScript 前端。请先阅读 `CLAUDE.md` 和 `AGENTS.md`，再阅读计划文档 Phase 6.4 节和设计文档第 13 节。

本阶段目标：实现 Notes 页面——与 Crawl / Mindbank 同级的独立页面，提供 Obsidian vault 的浏览器端 Markdown 编辑和阅读能力（文件树 + 编辑器）。

---

## 第一步：安装前端依赖

```bash
cd frontend
pnpm add @uiw/react-md-editor
pnpm approve-builds
```

## 第二步：后端 NotesService

创建 `backend/src/main/java/com/nexus/service/NotesService.java`：
- vault 根路径从 `SystemConfigService.get("mindbank.obsidian.vault_path")` 读取
- **所有方法必须先调用 `resolveSafePath(relativePath)` 做路径安全校验**（防路径穿越），校验实现：
  ```java
  private Path resolveSafePath(String relativePath) {
      Path vaultRoot = Path.of(getVaultPath()).toAbsolutePath().normalize();
      Path resolved = vaultRoot.resolve(relativePath).normalize();
      if (!resolved.startsWith(vaultRoot)) throw new IllegalArgumentException("非法路径");
      return resolved;
  }
  ```
- 实现方法：
  - `FileTreeNode getFileTree()` — 递归读取 vault，只包含 `.md` 文件和目录，最大深度 10 层（`FileTreeNode` record：`String name, String path, String type, List<FileTreeNode> children`）
  - `String readFile(String path)` — 读取文件内容
  - `void saveFile(String path, String content)` — 写入文件（父目录不存在则创建）
  - `void createFile(String path)` — 创建空 `.md` 文件
  - `void createFolder(String path)` — 创建目录
  - `void rename(String oldPath, String newPath)` — `Files.move`
  - `void deleteFile(String path)` — 删除文件
  - `void deleteFolder(String path)` — `FileUtils.deleteDirectory` 或递归 `Files.walk` 删除

## 第三步：后端 NotesController

创建 `backend/src/main/java/com/nexus/controller/NotesController.java`（`@RequestMapping("/api/notes")`）：
- 实现计划文档 Phase 6.4 节列出的 8 个接口，调用 NotesService
- 所有接口返回 `ApiResponse<T>` 格式
- vault 路径未配置时返回友好错误（`message: "请先在 Settings → Mindbank 中配置 Obsidian vault 路径"`）

## 第四步：前端 Notes 页面

### 文件结构
```
frontend/src/pages/Notes/
  index.tsx
  notes.api.ts
  notes.types.ts         ← FileTreeNode 类型
  NotesDesktopView.tsx
  NotesMobileView.tsx
  components/
    NotesFileTree.tsx
    FileTreeNode.tsx
    NotesEditor.tsx
    FileNameDialog.tsx   ← 新建/重命名弹窗（Radix Dialog）
```

### notes.types.ts
```typescript
export interface FileTreeNode {
  name: string
  path: string
  type: 'file' | 'folder'
  children?: FileTreeNode[]
}
```

### 页面状态（index.tsx）
使用 TanStack Query 加载文件树（`useQuery(['notes-tree'])`），本地 state 管理：选中文件路径、文件内容、是否有未保存修改（`isDirty`）。

### NotesDesktopView.tsx 布局
```
flex w-full h-[calc(100vh-64px)]   ← 减去顶部导航高度
├── 左侧 NotesFileTree（w-60 shrink-0 border-r overflow-y-auto）
└── 右侧 NotesEditor（flex-1 overflow-hidden）
```

### NotesFileTree.tsx
- 顶部：搜索框（按文件名实时过滤）+ "新建文件"和"新建文件夹"两个 icon 按钮
- 文件树递归渲染 FileTreeNode
- 文件夹：可展开/折叠（chevron icon），点击展开不选中
- 文件：点击加载内容到编辑器，当前选中文件高亮
- 右键菜单（Radix ContextMenu）：重命名 / 删除

### NotesEditor.tsx
- 工具栏（`flex items-center justify-between h-10 border-b px-3`）：
  - 左侧：当前文件路径面包屑（`text-xs text-muted-foreground`）
  - 右侧：保存状态 chip（"已保存" 绿色 / "未保存" 黄色）+ 模式切换按钮（编辑/预览/分栏）+ 保存按钮
- 编辑器区：使用 `@uiw/react-md-editor`，`height="100%"` 填满剩余空间
- `Ctrl+S` / `Cmd+S` 事件监听触发保存
- 空状态（未选中文件）：居中显示"选择左侧文件开始阅读或编辑"

### NotesMobileView.tsx
- 默认全屏展示编辑器，顶部 Hamburger 按钮展开文件树 Sheet（底部抽屉）
- 编辑器移动端默认 preview 模式，顶部按钮切换编辑

### FileNameDialog.tsx
- Radix Dialog，单个输入框（文件名/文件夹名）
- 新建文件时自动补全 `.md` 后缀（若用户未输入）
- 重命名时预填当前名称

## 第五步：路由 + 导航

1. 在 App.tsx（或路由配置文件）中添加 `/notes` 路由，渲染 `NotesPage`
2. 桌面侧边栏（`Sidebar.tsx`）新增 Notes 导航项（图标：`FileText` from lucide-react）
3. 移动端 More Sheet 新增 Notes 入口

## 第六步：验证

```bash
pnpm build
mise exec java@21 -- mvn -q test
# 手动测试：
# 1. Settings 中配置正确的 vault 路径
# 2. 打开 Notes 页面 → 文件树正常加载
# 3. 点击一个 .md 文件 → 内容加载到编辑器
# 4. 修改内容 → 状态变为"未保存" → Ctrl+S → 状态变为"已保存"
# 5. 刷新页面 → 重新打开该文件 → 内容已持久化
# 6. 新建文件 → 文件树出现新文件
# 7. 重命名 → 文件树更新
# 8. 删除（含二次确认）
# 9. 移动端：文件树 Sheet 正常展开/关闭
```

**注意事项：**
- `@uiw/react-md-editor` 在 SSR 环境可能有问题，若报错加 `dynamic import` 或 `typeof window !== 'undefined'` 检查
- 文件树搜索只做前端过滤（不重新请求接口），搜索结果展示扁平化列表还是保持树结构均可，选扁平化列表更简单
- 删除文件夹前端必须二次确认（弹窗说明"此操作将删除文件夹内所有文件"），确认后再调接口
- 编辑器高度需要 `calc(100vh - XXpx)` 精确计算，避免出现双滚动条
- `isDirty` 状态：每次从接口加载内容后重置为 false；用户修改内容后设为 true；保存成功后重置为 false
