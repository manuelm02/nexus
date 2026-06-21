# Settings 结构调整 + Notes 页面修正 — 执行计划

> 创建日期：2026-06-18  
> 背景：Phase 6.2 实现的 Settings Mindbank Tab 把所有配置混在一起；Notes 页面设计需要确认 vault 路径直接作为根目录展示，无额外子文件夹层级。

---

## 变更一览

### 变更 1：Settings 拆分为独立 Tab

| 原位置 | 新位置 |
|--------|--------|
| Settings → Mindbank → Crawl4AI URL | Settings → **Crawl** |
| Settings → Mindbank → MarkItDown URL | Settings → **Crawl** |
| Settings → Mindbank → Obsidian Vault 路径 | Settings → **Notes** |
| Settings → Mindbank → AnythingLLM URL/Key | Settings → **Mindbank**（保留）|
| Settings → Mindbank → MinIO URL/Bucket/Keys | Settings → **Mindbank**（保留）|
| Settings → Mindbank → Obsidian 子文件夹 | Settings → **Mindbank**（保留，供 AI 笔记写入路径使用）|
| Settings → Mindbank → AI 模型 | Settings → **Mindbank**（保留）|
| Settings → Mindbank → 流水线行为 | Settings → **Mindbank**（保留）|

最终 Settings Tab 顺序：模型 / Translate / Inbox / Subscriptions / Chat / **Crawl** / **Notes** / **Mindbank** / System

### 变更 2：system_configs key 重命名

| 旧 key | 新 key |
|--------|--------|
| `mindbank.crawl4ai.url` | `crawl.crawl4ai.url` |
| `mindbank.markitdown.url` | `crawl.markitdown.url` |
| `mindbank.obsidian.vault_path` | `notes.obsidian.vault_path` |

其余 `mindbank.*` key 不变。

### 变更 3：Notes 页面 vault 根目录展示

- `NotesService.getFileTree()` 读取 `notes.obsidian.vault_path` 作为根目录，直接展示整个 vault 目录树
- 不做任何子文件夹过滤，vault 里有什么展示什么
- `MindBankPipelineService` 写 Obsidian 文件时读取 `notes.obsidian.vault_path`（根） + `mindbank.obsidian.sub_folder`（子文件夹）两个 key

---

## 后端改动

### 1. Flyway 迁移：V1_17__rename_config_keys.sql

```sql
-- 重命名 system_configs 中的 key，保留已保存的值
UPDATE system_configs SET config_key = 'crawl.crawl4ai.url'      WHERE config_key = 'mindbank.crawl4ai.url';
UPDATE system_configs SET config_key = 'crawl.markitdown.url'    WHERE config_key = 'mindbank.markitdown.url';
UPDATE system_configs SET config_key = 'notes.obsidian.vault_path' WHERE config_key = 'mindbank.obsidian.vault_path';
```

### 2. 更新 Client 读取的 key

| 文件 | 修改点 |
|------|--------|
| `Crawl4AiClient.java` | `SystemConfigService.get("crawl.crawl4ai.url")` |
| `MarkItDownClient.java` | `SystemConfigService.get("crawl.markitdown.url")` |
| `NotesService.java` | `SystemConfigService.get("notes.obsidian.vault_path")` |
| `MindBankPipelineService.java` | vault 根路径改为 `notes.obsidian.vault_path`，子文件夹保持 `mindbank.obsidian.sub_folder` |

### 3. Settings 接口拆分

现有 `GET/PUT /api/settings/mindbank` 拆为三个端点：

```
GET/PUT /api/settings/crawl
  → 管理: crawl.crawl4ai.url, crawl.markitdown.url

GET/PUT /api/settings/notes
  → 管理: notes.obsidian.vault_path

GET/PUT /api/settings/mindbank（保留，但移除已拆出的 key）
  → 管理: mindbank.anythingllm.url, mindbank.anythingllm.api_key,
           mindbank.minio.url, mindbank.minio.access_key, mindbank.minio.secret_key,
           mindbank.minio.bucket, mindbank.obsidian.sub_folder,
           mindbank.pipeline.auto_session_note
  → 模型配置（workflowType: mindbank_classify/organize/condense）不变
```

若使用现有 `SettingsController`，在其中新增两个方法处理 crawl 和 notes 配置即可，无需新建 Controller。

---

## 前端改动

### 文件结构

**新增**
```
frontend/src/pages/Settings/
  CrawlSettingsPanel.tsx   ← 新建
  NotesSettingsPanel.tsx   ← 新建
```

**修改**
```
frontend/src/pages/Settings/
  index.tsx                ← 新增 'crawl' | 'notes' Tab
  MindBankSettingsPanel.tsx ← 移除 Crawl4AI URL、MarkItDown URL、Obsidian Vault 路径三个字段
```

### CrawlSettingsPanel.tsx 字段

| 字段 | key | 类型 |
|------|-----|------|
| Crawl4AI URL | `crawl.crawl4ai.url` | 文本输入，默认 `http://192.168.110.10:3003` |
| MarkItDown URL | `crawl.markitdown.url` | 文本输入，默认 `http://192.168.110.10:3004` |

页面描述文字："配置网页爬取和文件格式转换服务地址。"

### NotesSettingsPanel.tsx 字段

| 字段 | key | 类型 |
|------|-----|------|
| Obsidian Vault 路径 | `notes.obsidian.vault_path` | 文本输入，placeholder `/path/to/your/vault` |

页面描述文字："配置 Obsidian vault 根目录路径，Notes 页面将展示该路径下的所有笔记。"

下方展示一个说明提示（Info callout）：
> "路径为 Nexus 后端服务器（192.168.110.10）上的本地绝对路径，若 vault 通过 NAS 挂载，填写挂载后的路径。"

### MindBankSettingsPanel.tsx 移除的字段

从"服务地址"分组中移除：
- Crawl4AI URL
- MarkItDown URL
- Obsidian Vault 路径

其余字段（AnythingLLM URL/Key、MinIO 全部字段、Obsidian 子文件夹、AI 模型、流水线行为）保持不变。

### Settings Tab 顺序更新

在 `SettingsTab` 联合类型中新增 `'crawl'` 和 `'notes'`，插入位置在 `'chat'` 之后、`'mindbank'` 之前：

```typescript
type SettingsTab = 'model' | 'translate' | 'inbox' | 'subscriptions' | 'chat' | 'crawl' | 'notes' | 'mindbank' | 'system'
```

---

## 验证步骤

```bash
# 后端
mise exec java@21 -- mvn spring-boot:run -Dspring-boot.run.profiles=local
# → V1_17 migration applied，无报错

# 前端
pnpm build
# → 无类型错误

# 手动验证
# 1. Settings 页面出现 Crawl / Notes 两个新 Tab
# 2. Crawl Tab：填写 Crawl4AI URL → 保存 → 刷新 → 值持久化
# 3. Notes Tab：填写 vault 路径 → 保存 → 打开 Notes 页面 → 文件树正常展示整个 vault
# 4. Mindbank Tab：不再出现 Crawl4AI URL / MarkItDown URL / Obsidian Vault 路径
# 5. Notes 页面：直接展示 vault 根目录，无额外子文件夹层级过滤
```
