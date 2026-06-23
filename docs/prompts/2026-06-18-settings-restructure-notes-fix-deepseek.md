# Settings 结构调整 + Notes 页面修正 — 执行提示词

执行计划：`docs/superpowers/plans/2026-06-18-settings-restructure-notes-fix.md`  
设计文档：`docs/superpowers/specs/2026-06-17-mindbank-crawl-phase6-design.md`

---

你正在开发 Nexus 项目（路径：`/Users/manuelm/Workspace/Projects/Nexus/nexus`），Spring Boot 3.x 后端 + React 18 + TypeScript 前端。请先阅读 `CLAUDE.md` 了解项目规范，再阅读上方计划文档了解本次改动全貌。

**改动背景：** Phase 6.2 实现的 Settings 把 Crawl、Notes、Mindbank 的配置全塞进一个 Mindbank Tab，需要拆分为独立 Tab。同时 Notes 页面应直接展示整个 Obsidian vault 路径下的内容，不做额外子文件夹过滤。

请按以下顺序执行，每步完成后验证再继续。

---

## 第一步：Flyway 迁移（key 重命名）

创建 `backend/src/main/resources/db/migration/V1_17__rename_config_keys.sql`：

```sql
UPDATE system_configs SET config_key = 'crawl.crawl4ai.url'
  WHERE config_key = 'mindbank.crawl4ai.url';
UPDATE system_configs SET config_key = 'crawl.markitdown.url'
  WHERE config_key = 'mindbank.markitdown.url';
UPDATE system_configs SET config_key = 'notes.obsidian.vault_path'
  WHERE config_key = 'mindbank.obsidian.vault_path';
```

验证：
```bash
mise exec java@21 -- mvn spring-boot:run -Dspring-boot.run.profiles=local
# 日志中看到 V1_17 migration applied，Ctrl+C 停止
```

---

## 第二步：后端 Client 和 Service 更新 key 名

修改以下文件中 `SystemConfigService.get(...)` 的 key 参数：

1. **`Crawl4AiClient.java`**：
   - `"mindbank.crawl4ai.url"` → `"crawl.crawl4ai.url"`

2. **`MarkItDownClient.java`**：
   - `"mindbank.markitdown.url"` → `"crawl.markitdown.url"`

3. **`NotesService.java`**：
   - `"mindbank.obsidian.vault_path"` → `"notes.obsidian.vault_path"`

4. **`MindBankPipelineService.java`**（Step 4 写 Obsidian 文件时）：
   - vault 根路径：`systemConfigService.get("mindbank.obsidian.vault_path")` → `"notes.obsidian.vault_path"`
   - 子文件夹：`systemConfigService.get("mindbank.obsidian.sub_folder")` 保持不变

搜索确认没有遗漏：
```bash
grep -rn "mindbank.crawl4ai\|mindbank.markitdown\|mindbank.obsidian.vault_path" backend/src/
# 结果应为空（说明已全部替换完毕）
```

---

## 第三步：后端 Settings 接口拆分

在现有 Settings 相关 Controller 中（可能是 `SettingsController.java` 或 `MindBankSettingsController.java`）：

**新增两个接口组：**

```java
// Crawl 配置
@GetMapping("/api/settings/crawl")
public ApiResponse<Map<String, String>> getCrawlSettings() {
    // 读取并返回：crawl.crawl4ai.url, crawl.markitdown.url
    // 无需加密/解密（这两个字段不是密钥）
}

@PutMapping("/api/settings/crawl")
public ApiResponse<Void> saveCrawlSettings(@RequestBody Map<String, String> body) {
    // 保存：crawl.crawl4ai.url, crawl.markitdown.url
}

// Notes 配置
@GetMapping("/api/settings/notes")
public ApiResponse<Map<String, String>> getNotesSettings() {
    // 读取并返回：notes.obsidian.vault_path
}

@PutMapping("/api/settings/notes")
public ApiResponse<Void> saveNotesSettings(@RequestBody Map<String, String> body) {
    // 保存：notes.obsidian.vault_path
}
```

**修改现有 `/api/settings/mindbank` 接口：**  
从返回字段中移除 `crawl.crawl4ai.url`、`crawl.markitdown.url`、`notes.obsidian.vault_path` 三个 key（它们已移至各自的接口）。

---

## 第四步：前端 Settings — 新增 Crawl Tab

新建 `frontend/src/pages/Settings/CrawlSettingsPanel.tsx`：

```tsx
// CrawlSettingsPanel 提供 Crawl 页面所需的外部服务地址配置。
export function CrawlSettingsPanel() {
  // 使用 useQuery 从 /api/settings/crawl 加载配置
  // 使用 useMutation 通过 PUT /api/settings/crawl 保存
  // 字段：Crawl4AI URL, MarkItDown URL
  // 页面描述："配置网页爬取和文件格式转换服务地址。"
  // 布局参照现有 MindBankSettingsPanel 的结构（分组卡片 + 保存/取消按钮）
}
```

字段配置：

| 标签 | key | 输入类型 | 默认占位 |
|------|-----|----------|----------|
| Crawl4AI URL | `crawl.crawl4ai.url` | text | `http://192.168.110.10:3003` |
| MarkItDown URL | `crawl.markitdown.url` | text | `http://192.168.110.10:3004` |

---

## 第五步：前端 Settings — 新增 Notes Tab

新建 `frontend/src/pages/Settings/NotesSettingsPanel.tsx`：

```tsx
// NotesSettingsPanel 配置 Notes 页面使用的 Obsidian vault 路径。
export function NotesSettingsPanel() {
  // 使用 useQuery 从 /api/settings/notes 加载配置
  // 使用 useMutation 通过 PUT /api/settings/notes 保存
}
```

字段配置：

| 标签 | key | 输入类型 | 说明 |
|------|-----|----------|------|
| Obsidian Vault 路径 | `notes.obsidian.vault_path` | text，全宽 | placeholder: `/path/to/your/vault` |

字段下方添加说明文字（`text-xs text-muted-foreground`）：
> "填写 Nexus 后端服务器上的 Obsidian vault 绝对路径。Notes 页面将直接展示该路径下的所有笔记文件。"

---

## 第六步：前端 Settings — 修改 MindBankSettingsPanel

从 `MindBankSettingsPanel.tsx` 的"服务地址"分组中**删除**以下三个字段及其对应的 state/API 逻辑：
- Crawl4AI URL
- MarkItDown URL  
- Obsidian Vault 路径

"服务地址"分组保留：
- AnythingLLM URL
- MinIO URL
- MinIO Bucket
- Obsidian 子文件夹（这是 Mindbank AI 笔记写入 vault 内的目标子目录，与 Notes 的 vault 根路径不同）

其余分组（认证 / AI 模型 / 流水线行为）保持不变。

同时更新 API 调用：`PUT /api/settings/mindbank` 提交的字段中移除已拆出的三个 key。

---

## 第七步：前端 Settings index.tsx — 注册新 Tab

在 Settings 页面主文件中：

1. 更新 `SettingsTab` 类型：
```typescript
type SettingsTab = 'model' | 'translate' | 'inbox' | 'subscriptions' | 'chat' | 'crawl' | 'notes' | 'mindbank' | 'system'
```

2. 在 Tab 列表中，`'chat'` 之后、`'mindbank'` 之前插入两项：
```typescript
{ id: 'crawl',  label: 'Crawl' }
{ id: 'notes',  label: 'Notes' }
```

3. 在 Tab 内容渲染区域增加：
```tsx
{activeTab === 'crawl'  && <CrawlSettingsPanel />}
{activeTab === 'notes'  && <NotesSettingsPanel />}
```

---

## 第八步：确认 Notes 页面行为

检查 `NotesService.java` 的 `getFileTree()` 方法：
- 确认它读取 `notes.obsidian.vault_path`（第二步已修改）
- 确认没有任何子文件夹过滤逻辑——直接从 vault 根路径递归展示全部 `.md` 文件和目录
- **不应该**有类似 `resolve(subFolder)` 的代码出现在 `getFileTree()` 中

如果存在子文件夹过滤逻辑，移除它。

---

## 验证

```bash
# 后端编译 + 测试
mise exec java@21 -- mvn -q -pl backend compile
mise exec java@21 -- mvn -q test

# 前端构建
pnpm build

# 手动验证清单：
# ✅ Settings 侧边栏出现 Crawl / Notes 两个新 Tab（位于 Chat 和 Mindbank 之间）
# ✅ Crawl Tab：只有 Crawl4AI URL 和 MarkItDown URL，保存后刷新值持久化
# ✅ Notes Tab：只有 Obsidian Vault 路径，保存后刷新值持久化
# ✅ Mindbank Tab：服务地址分组中不再出现 Crawl4AI URL / MarkItDown URL / Obsidian Vault 路径
# ✅ Notes 页面：填写正确 vault 路径后，文件树直接从 vault 根目录展示，无额外子文件夹层级
# ✅ Crawl 页面功能正常（Crawl4AI / MarkItDown client 仍能正确读取配置）
```

**注意事项：**
- `CrawlSettingsPanel` 和 `NotesSettingsPanel` 参照现有 `MindBankSettingsPanel` 的 API 调用模式（useQuery + useMutation + 保存/取消按钮），保持 UI 风格一致
- 保存/取消按钮的行为：本地 state 跟踪"是否有未保存变更"，取消时重置为服务端值，与现有 Settings 行为一致
- V1_17 迁移如果本地 DB 中从未保存过旧 key，UPDATE 语句不会报错（影响 0 行是正常的）
