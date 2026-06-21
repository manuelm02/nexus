# Nexus Phase 6：Mindbank & Crawl 系统设计文档

> 版本：2026-06-17 v2  
> 状态：设计确认中（Brainstorming 阶段输出）  
> 范围：Mindbank 知识处理中心 + Crawl 内容摄入中心

---

## 1. 设计目标

打造一个个人知识中心，实现从"原始材料"到"可检索知识"的完整闭环：

- 任何形式的内容（网页、PDF、文档、笔记）都能统一纳入知识体系
- AI 自动整理并持续累积进化主笔记，无缝写入 Obsidian，供人阅读
- 知识库支持自然语言问答，召回精准，引用可溯源至 MinIO 原始文件
- 原始文件永久保存、不被修改，支持未来迁移到自实现 RAG
- Nexus Mindbank Web 界面作为 Obsidian 的外网访问替代入口

---

## 2. 模块职责划分

### 2.1 Crawl — 内容摄入中心

**职责：** 把外部内容（网页 + 本地文件）规范化为 Markdown，存入 MinIO。

Crawl **不做** AI 处理，只做内容采集和格式转换。

| 能力 | 说明 |
|------|------|
| 网页爬取 | 输入 URL → Crawl4AI 抓取 → 输出 Markdown |
| 文件上传 & 转换 | 上传任意格式文件 → MarkItDown 统一转为 Markdown |
| 存入 MinIO | 原始文件和转换后 Markdown 分开路径存放 |
| 一键导入 Mindbank | 选择目标 Workspace → 触发 Mindbank AI 流水线 |

### 2.2 Mindbank — 知识处理 & 问答中心

**职责：** 从 MinIO 选取文件，触发 AI 处理流水线，管理 Workspace 和进化主笔记，提供 Q&A 问答。

Mindbank **不做** 内容摄入，只做知识加工和检索。

| 能力 | 说明 |
|------|------|
| MinIO 文件浏览 | 浏览 MinIO 中的文件，按来源、类型、处理状态筛选 |
| Workspace 管理 | 创建/删除 Workspace，支持领域标签 |
| AI 流水线触发 | 选文件 + 指定 Workspace → 启动 AI 处理流水线 |
| 流水线状态追踪 | 每个文件的处理进度实时可见，支持单步重试 |
| 笔记查看 | 在 Nexus 界面浏览各 Workspace 的 Master Note（外网可访问） |
| Q&A 问答 | 在指定 Workspace 内进行自然语言问答，回答附带原始文件引用 |
| Prompt 模板管理 | 配置 AI 整理笔记时使用的提示词模板（内置 + 自定义） |

---

## 3. 技术架构

### 3.1 服务依赖

| 服务 | 用途 | 地址 |
|------|------|------|
| MinIO | 原始文件 + 转换后 Markdown 存储 | `192.168.110.105:7001`（API）/ `7002`（Console） |
| Crawl4AI | 网页爬取，输出 Markdown | `192.168.110.10:3003` |
| MarkItDown Service | 本地文件格式转换（PDF/DOCX/XLSX/PPTX 等 → Markdown）| `192.168.110.10:3004`（新增轻量 FastAPI 服务） |
| AnythingLLM | Workspace 管理、文档 Embedding、RAG 问答 | `192.168.110.10:3001` |
| Obsidian Vault | 接收 AI 生成笔记，供本地阅读 | 路径通过 Settings 页面配置（挂载到 Nexus 后端可写路径） |
| Nexus Backend | 编排所有服务，流水线状态管理 | Spring Boot 3.x / Java 21 |

### 3.2 MarkItDown Service 说明

Microsoft 开源的 [MarkItDown](https://github.com/microsoft/markitdown) 是目前最适合的文件格式转换工具：

| 支持格式 | 效果 |
|----------|------|
| PDF | 内置支持，输出干净 Markdown |
| DOCX / XLSX / PPTX | Office 全系列，保留结构 |
| HTML | 直接转 Markdown |
| 图片 | 可接 LLM Vision 描述图片内容（可选） |
| TXT / MD | 直接透传 |

在 192.168.110.10 上包一个轻量 FastAPI 服务：

```python
# markitdown_service.py（示意）
from fastapi import FastAPI, UploadFile
from markitdown import MarkItDown

app = FastAPI()
md = MarkItDown()

@app.post("/convert")
async def convert(file: UploadFile):
    result = md.convert(await file.read(), file_extension=file.filename.split(".")[-1])
    return {"markdown": result.text_content}
```

Nexus Java 后端统一调 `POST http://192.168.110.10:3004/convert`，不需要在 Java 里引 PDFBox / POI 等重依赖。

### 3.3 MinIO 存储结构

```
mindbank-bucket/
├── originals/              ← 原始文件（只写不改，永久存档）
│   ├── 2026-06/
│   │   ├── langchain-rag.pdf
│   │   └── atomic-habits-notes.docx
│   └── ...
└── processed/              ← MarkItDown 转换后的 Markdown（供 AI 流水线读取）
    ├── 2026-06/
    │   ├── langchain-rag.md
    │   └── atomic-habits-notes.md
    └── ...
```

**关键原则：**
- `originals/` 只写不改，这是迁移 RAG 时的数据底仓
- `processed/` 是 AI 流水线的"入口"（AI 读取这里的 Markdown 做整理）
- AI 流水线的"出口"是 Obsidian Master Note + AnythingLLM embedding
- **MinIO 中的文件本身不会直接被 embedding**，AnythingLLM 里存的是 AI 生成的 Master Note

**未来迁移自实现 RAG 时：**
- 重新跑 `processed/` 的文件通过 AI 流水线，重新生成 Master Note，喂进自己的向量库
- 或直接把 `processed/` 的 Markdown 喂进向量库（跳过 AI 整理，速度快但质量稍低）

### 3.4 Obsidian Vault 结构

```
vault/
└── {配置的知识库子文件夹}/      ← 路径在 Settings 页面配置
    ├── _index.md               ← 自动维护的全局索引（按 Workspace 分组）
    ├── 编程技术/
    │   ├── LangChain学习__master.md          ← 进化主笔记（持续更新）
    │   ├── LangChain学习__session__2026-06-17.md  ← 单次导入速记
    │   └── LangChain学习__session__2026-06-18.md
    ├── AI研究/
    └── 读书笔记/
```

### 3.5 Obsidian 外网访问策略

| 方案 | 适用场景 | 说明 |
|------|----------|------|
| **Tailscale**（推荐短期）| 手机/电脑 Obsidian 在外也能连 NAS | 在 NAS 和所有设备装 Tailscale，零配置虚拟局域网，免费 |
| **Nexus Mindbank 笔记页**（推荐中期）| 浏览器访问，任意设备 | Nexus Web 界面直接渲染 Master Note，Nexus 部署在 192.168.110.10，外网可访问 |
| Notion 同步 | — | **不推荐**：双写维护成本高，格式转换有损耗，Nexus 已能覆盖需求 |

---

## 4. 核心架构改动：进化主笔记（Master Note）

> 这是与"一文件一笔记"方案最大的区别，也是知识积累质量的关键。

### 4.1 设计理念

每个 Workspace 维护一份**持续进化的主笔记**（Master Note）。每次向 Workspace 导入新文档，AI 不是创建新笔记，而是将新知识**融合进已有主笔记**，使其越来越完整。

```
第一次（文档 A → LangChain学习 workspace）：
  Master Note 不存在 → AI 生成 Master Note v1 → 写 Obsidian → embedding 进 AnythingLLM

第二次（文档 B → 同一 workspace）：
  读取 Master Note v1 → AI 融合新知识 → 生成 Master Note v2
  → 覆盖写 Obsidian → 删除旧 embedding + 重新 embedding v2

第三次、第四次……：
  Master Note 持续进化，知识越来越完整
```

### 4.2 两种笔记的职责

| 笔记类型 | 生成方式 | 更新策略 | 存放位置 | 用途 |
|----------|----------|----------|----------|------|
| **Master Note**（进化主笔记）| 每次导入后 AI 融合更新 | 覆盖写（版本号记录在文尾）| Obsidian + AnythingLLM | 完整知识全图，Q&A 检索来源 |
| **Session Note**（单次速记）| 每次导入后单独生成 | 追加（不覆盖）| 仅 Obsidian | 记录"这次导入贡献了什么新知识" |

### 4.3 Master Note 融合 Prompt

```
你是专业的知识整合助手。你需要将新材料中的知识融合进一份已有的知识笔记中，
使笔记持续进化、愈加完整。

【已有主笔记】
{master_note_content}

【新材料内容（已转换为 Markdown）】
{new_document_content}

【融合原则】
1. 识别新材料中的核心知识点
2. 判断每个知识点与已有笔记的关系：
   - 全新概念：新增对应章节或小节
   - 对已有内容的补充：在对应位置扩展
   - 与已有内容矛盾：保留原有内容并注明"[更新] 根据新材料..."
   - 重复内容：不重复写，只在相关位置补充新角度
3. 保留已有笔记的全部内容，只增加不删减
4. 保持整体结构的逻辑一致性，必要时重组章节顺序
5. 更新"知识地图"索引列表

【输出】
完整的更新后主笔记（完整内容，不是 diff）

在文尾追加一行：
> 📝 本次更新：融合了 {new_document_name}（{timestamp}），新增/扩展了 {简要说明变化的章节}
```

---

## 5. Crawl 模块工作流

### 5.1 网页爬取流程

```
用户输入 URL
    → Nexus 后端调用 Crawl4AI API（192.168.110.10:3003）
    → Crawl4AI 抓取页面，输出 Markdown
    → 前端预览 Markdown 内容
    → 用户确认存入 MinIO：
        ├── 原始 HTML → MinIO originals/{yyyy-MM}/{filename}.html
        └── Markdown → MinIO processed/{yyyy-MM}/{filename}.md
    → 标记状态：已采集，待处理
    → （可选）一键导入 Mindbank：
        └── 选择目标 Workspace → 触发 AI 流水线
```

### 5.2 文件上传 & 转换流程

```
用户上传文件（PDF / DOCX / XLSX / PPTX / TXT / MD / 图片）
    → 原始文件上传 MinIO originals/{yyyy-MM}/{filename}
    → Nexus 后端调用 MarkItDown Service（192.168.110.10:3004）
        POST /convert → 返回 Markdown 文本
    → 转换后 Markdown 上传 MinIO processed/{yyyy-MM}/{filename}.md
    → 前端展示转换结果预览
    → 标记状态：已采集，待处理
    → （可选）一键导入 Mindbank：
        └── 选择目标 Workspace → 触发 AI 流水线
```

### 5.3 爬虫能力选择策略（对用户透明）

| 场景 | 使用能力 |
|------|----------|
| 网页爬取（普通 / JS 渲染）| Crawl4AI（主力，内置 Playwright）|
| 网页爬取降级 | Jsoup（Spring Boot JAR 依赖，Crawl4AI 失败时自动切换）|
| 本地文件转换 | MarkItDown Service |

---

## 6. Mindbank AI 处理流水线详解

每步都有独立状态：`pending → processing → done / failed`，失败可单步重试。

### 流水线概览

```
MinIO processed/ 的 Markdown 文件
    ↓
Step 1：内容类型识别
    ↓
Step 2：AI 融合整理 → 更新 Master Note（详细版）
    ↓
Step 3：AI 生成 Session Note（本次导入速记）
    ↓
Step 4：写入 Obsidian vault（Master Note 覆盖 + Session Note 追加）
    ↓
Step 5：更新 AnythingLLM embedding（删旧 doc + 上传新 Master Note）
```

---

### Step 1：内容类型识别

**输入：** MinIO processed/ 的 Markdown 内容前 500 字  
**输出：** 内容类型标签，决定 Step 2 使用哪套 Prompt 模板

```
Prompt：

分析以下内容的前 500 字，判断它最接近哪种类型：
A. 学术论文 / 研究报告
B. 技术教程 / 官方文档
C. 新闻 / 博客文章
D. 书籍章节 / 读书笔记
E. 会议记录 / 工作文档
F. 其他

内容：
{content_preview}

只返回字母，不需要解释。
```

---

### Step 2：AI 融合整理 → 更新 Master Note

**逻辑判断：**
- 若 Workspace 已有 Master Note → 执行**融合更新**（见上方 4.3 融合 Prompt）
- 若 Workspace 是首次导入 → 执行**初始生成**（见下方初始 Prompt）

**初始生成 Prompt（通用模板）：**

```
你是专业的知识整理助手，擅长把原始材料转化为结构清晰、信息完整的知识笔记。

【整理原则】
- 按知识点的逻辑关系重新组织，不要按原文顺序复述
- 每个知识点：说清楚是什么、为什么重要、怎么用
- 保留所有重要细节、数据、步骤，不做压缩
- 不熟悉该主题的人读完这份笔记，应该能真正理解它
- 遇到专业术语保留英文原文并附中文解释

【输出格式（Markdown）】

# {自动提取的标题}

## 核心主旨
（2-3 句话：这份内容讲什么，对读者有什么价值）

## 知识地图
（列出本笔记涉及的所有核心知识点，作为阅读索引）
- [知识点一]
- [知识点二]

## {知识点一}
### 定义与概念
### 核心要点
### 示例 / 应用场景
### 注意事项

## {知识点二}
（同上结构）

## 关键结论
（对内容最重要观点的提炼，带依据）

## 延伸思考
（与哪些已知概念相关？有哪些值得深入的问题？）

---
📎 首次来源：{minio_original_url}
🕐 创建时间：{timestamp}
🏷 所属 Workspace：{workspace_name}
📝 版本记录：v1 — 初始创建，来源 {document_name}
```

**技术类文档额外追加：**
```
## 快速参考
（命令 / API / 参数速查表）

## 常见问题 & 踩坑
```

**学术论文额外追加：**
```
## 研究方法
## 实验结论 & 关键数据
## 我的收获 / 可借鉴之处
```

**长文档处理策略：** 超过 3000 token 的文件，按语义段落分块处理，最后 AI 合并成完整笔记。

---

### Step 3：AI 生成 Session Note（单次速记）

**输入：** 本次导入的文档内容  
**输出：** 本次导入"贡献了什么新知识"的快速记录，单独写 Obsidian（不覆盖）

```
Prompt：

基于以下材料，生成一份本次导入的知识速记。
这不是一份完整笔记，而是记录"这份材料的核心贡献是什么"。

【要求】
- 控制在 300 字以内
- 重点：这份材料最核心的 3-5 个知识点/结论
- 适合作为"我为什么导入这份材料"的快速回顾

【输出格式】

## {文档标题} — 导入速记

**来源：** {document_name}  
**日期：** {date}  
**所属 Workspace：** {workspace_name}

### 核心贡献
- 
- 

### 关键结论

---
📎 原始文件：{minio_original_url}
📖 主笔记：{master_note_obsidian_path}
```

---

### Step 4：写入 Obsidian Vault

**操作：**
```
vault/{配置路径}/{AI分类文件夹}/
├── {workspace_name}__master.md        ← Master Note（覆盖写）
└── {workspace_name}__session__{date}.md  ← Session Note（追加写）

vault/{配置路径}/_index.md             ← 更新全局索引
```

**文件夹自动分类 Prompt：**

```
根据以下笔记信息，为其选择合适的 Obsidian 子文件夹。

现有文件夹列表：{existing_folders}

Workspace 名称：{workspace_name}
领域标签：{domain_tag}
核心主旨：{summary_first_paragraph}

规则：优先匹配现有文件夹；若无合适匹配，建议新文件夹名（中文，4 字以内）。
只返回文件夹名称。
```

---

### Step 5：更新 AnythingLLM Embedding

**操作：**
```
1. 若 Workspace 已有旧版 Master Note 文档：
   DELETE /api/v1/workspace/{slug}/remove-embedded  → 删除旧文档

2. 上传新版 Master Note：
   POST /api/v1/workspace/{slug}/upload
   → 内容：最新 Master Note 全文（含 MinIO 原始文件引用）

3. 记录新文档 ID 到 Nexus DB（mindbank_documents 表）
```

**为什么 embedding Master Note 而非原始文件：**
- Master Note 已按知识点逻辑组织 → chunk 语义边界清晰 → 召回率更高
- Master Note 文尾含 MinIO 原始文件链接 → Q&A 回答时自带溯源引用

---

## 7. Workspace 组织架构

### Workspace 设计：精细主题单元 + 领域标签

```
领域标签：编程技术
├── Workspace: LangChain 学习       → master.md（持续进化）
├── Workspace: RAG 原理
└── Workspace: Spring Boot 3.x

领域标签：读书笔记
├── Workspace: Atomic Habits
└── Workspace: 深度工作

领域标签：AI 研究
├── Workspace: Transformer 架构
└── Workspace: Diffusion Model
```

### 数据库模型（Nexus DB）

```sql
-- Workspace 表（对应 AnythingLLM workspace）
CREATE TABLE mindbank_workspaces (
    id                  BIGSERIAL PRIMARY KEY,
    name                VARCHAR(100) NOT NULL,
    domain_tag          VARCHAR(50),
    anythingllm_slug    VARCHAR(100),
    description         TEXT,
    master_note_path    VARCHAR(500),           -- Obsidian Master Note 路径
    anythingllm_doc_id  VARCHAR(100),           -- 当前 embedding 的 Master Note 文档 ID
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW()
);

-- 文档记录表（每次导入的文件）
CREATE TABLE mindbank_documents (
    id                  BIGSERIAL PRIMARY KEY,
    workspace_id        BIGINT REFERENCES mindbank_workspaces(id),
    original_minio_url  VARCHAR(500),           -- MinIO originals/ 路径
    processed_minio_url VARCHAR(500),           -- MinIO processed/ 路径
    file_name           VARCHAR(255),
    source_type         VARCHAR(20),            -- 'crawl' | 'upload'
    content_type        VARCHAR(10),            -- A/B/C/D/E/F（Step 1 识别结果）
    pipeline_status     VARCHAR(20),            -- overall: pending/processing/done/failed
    step1_status        VARCHAR(20) DEFAULT 'pending',
    step2_status        VARCHAR(20) DEFAULT 'pending',
    step3_status        VARCHAR(20) DEFAULT 'pending',
    step4_status        VARCHAR(20) DEFAULT 'pending',
    step5_status        VARCHAR(20) DEFAULT 'pending',
    session_note_path   VARCHAR(500),           -- Session Note 在 Obsidian 的路径
    prompt_template_id  BIGINT,
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW()
);

-- Prompt 模板表
CREATE TABLE mindbank_prompt_templates (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    type        VARCHAR(20),                    -- 'organize' | 'condense' | 'merge' | 'classify'
    content     TEXT NOT NULL,
    is_default  BOOLEAN DEFAULT FALSE,
    is_builtin  BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMP DEFAULT NOW()
);
```

---

## 8. Settings 配置

Settings 页面新增 **Mindbank Tab**，包含：

| 配置项 | 类型 | 说明 |
|--------|------|------|
| Obsidian vault 路径 | 文本输入 | Nexus 后端写文件的根路径 |
| 知识库子文件夹名 | 文本输入 | vault 内专用于 Mindbank 的目录名 |
| AnythingLLM API Key | 密码输入（加密存储）| 复用 LlmConfigService.encrypt() |
| AnythingLLM 地址 | 文本输入 | 默认 `http://192.168.110.10:3001` |
| MinIO 地址 | 文本输入 | 默认 `http://192.168.110.105:7001` |
| MinIO Access Key | 密码输入（加密存储）| — |
| MinIO Secret Key | 密码输入（加密存储）| — |
| MinIO Bucket | 文本输入 | 默认 `mindbank` |
| MarkItDown 地址 | 文本输入 | 默认 `http://192.168.110.10:3004` |
| Crawl4AI 地址 | 文本输入 | 默认 `http://192.168.110.10:3003` |
| mindbank_organize 模型 | 模型选择 | Step 2 整理用，建议最强模型 |
| mindbank_condense 模型 | 模型选择 | Step 3 速记用，中等模型 |
| mindbank_classify 模型 | 模型选择 | Step 1 类型识别用，最快模型 |
| Stage 3 触发方式 | 开关 | 自动 / 手动触发 Session Note 生成 |

---

## 9. Prompt 模板系统

提供**内置默认模板** + **用户自定义模板**：

| 模板 | 用途 | 可编辑 |
|------|------|--------|
| 通用知识整理（初始）| 首次创建 Master Note | ✅ |
| 通用知识融合（更新）| 融合新文档进 Master Note | ✅ |
| 导入速记 | Session Note 生成 | ✅ |
| 技术文档整理 | 技术类内容专用（含快速参考表）| ✅ |
| 学术论文分析 | 论文专用（含研究方法、实验结论）| ✅ |
| 读书笔记提炼 | 书籍章节专用 | ✅ |
| 自定义模板 | 用户新建 | ✅ |

模板变量：`{content}`、`{master_note_content}`、`{workspace_name}`、`{minio_original_url}`、`{timestamp}`、`{document_name}`

---

## 10. Q&A 问答流程

```
用户在 Workspace Q&A 页面输入问题
    → Nexus 后端调用 AnythingLLM Workspace Chat API
        POST /api/v1/workspace/{slug}/chat
    → AnythingLLM 执行 RAG 检索（只搜索该 Workspace 的 Master Note）
    → 返回：回答文本 + 引用的 chunk（含 MinIO 原始文件链接）
    → 前端展示：
        ├── AI 回答（Markdown 渲染）
        └── 来源引用卡片（来源笔记段落 + 可点击的 MinIO 原始文件链接）

跨 Workspace 问答（Phase 6 可选，后期标准功能）：
    → 用户选择多个 Workspace 或"全局"
    → Nexus 后端并发调用多个 AnythingLLM workspace chat
    → 合并结果，综合回答
```

---

## 11. 架构预留：自实现 RAG 迁移路径

```java
// Port 接口（参考项目现有 TranslationProviderPort 模式）
public interface KnowledgeBasePort {
    String createWorkspace(String name, String description);
    void uploadDocument(String workspaceSlug, String content, String filename);
    void deleteDocument(String workspaceSlug, String docId);
    KnowledgeBaseAnswer query(String workspaceSlug, String question);
    KnowledgeBaseAnswer queryMultiple(List<String> workspaceSlugs, String question);
}

// Phase 6 实现：AnythingLLM
@Service
public class AnythingLlmKnowledgeBaseAdapter implements KnowledgeBasePort { ... }

// 未来实现：PGVector + LangChain4j
// @Service
// public class NativeRagKnowledgeBaseAdapter implements KnowledgeBasePort { ... }
```

迁移时只需：切换 Spring Bean → 重新 embedding `processed/` 下的 Markdown → 完成。

---

## 12. Phase 6 完整功能清单

### Crawl 页面
- [ ] 网页 URL 输入 + Crawl4AI 爬取 + Markdown 预览
- [ ] 本地文件上传 + MarkItDown 格式转换 + Markdown 预览
- [ ] 存入 MinIO（originals/ + processed/）
- [ ] MinIO 文件列表管理（查看 / 删除）
- [ ] 一键导入 Mindbank（选 Workspace → 触发 AI 流水线）

### Mindbank 页面
- [ ] Workspace 列表（含领域标签，支持新建 / 删除）
- [ ] MinIO 文件浏览器（按 Workspace / 全局浏览，显示处理状态）
- [ ] 文件与 Workspace 关联 + 触发 AI 流水线
- [ ] 流水线状态追踪（5 步进度，支持单步重试）
- [ ] Master Note 查看器（Nexus 内 Markdown 渲染，外网可访问）
- [ ] Session Note 列表（按时间线展示每次导入的速记）
- [ ] Q&A 对话界面（指定 Workspace 问答 + 来源引用展示）
- [ ] Prompt 模板管理（内置 + 自定义）

### Settings — Mindbank Tab
- [ ] Obsidian vault 路径配置
- [ ] AnythingLLM / MinIO / Crawl4AI / MarkItDown 地址配置
- [ ] mindbank_organize / mindbank_condense / mindbank_classify 模型配置
- [ ] Stage 3 Session Note 触发方式（自动 / 手动）

---

## 13. Notes 页面设计

### 13.1 概述

Notes 是与 Crawl / Mindbank 同级的独立导航页面，提供 Obsidian vault 的浏览器端 Markdown 编辑和阅读能力。vault 路径复用 Settings Mindbank Tab 中配置的路径，Notes 和 Mindbank 共享同一个 vault。

### 13.2 功能范围

| 功能 | 说明 |
|------|------|
| 文件树 | 递归展示 vault 下所有文件夹和 `.md` 文件，支持展开/折叠 |
| Markdown 编辑器 | 使用 `@uiw/react-md-editor`，支持编辑模式、预览模式、分栏模式 |
| 文件操作 | 新建文件、新建文件夹、重命名、删除（二次确认气泡） |
| 保存 | Ctrl+S 快捷键 + 工具栏保存按钮，显示"已保存 / 未保存"状态 |
| 搜索 | 文件树顶部搜索框，按文件名实时过滤 |

### 13.3 后端 API

所有路径参数均为相对于 vault 根路径的相对路径，后端强制校验路径不得越界。

```
GET    /api/notes/tree              → 返回 vault 完整目录树（递归，只含 .md 文件和目录）
GET    /api/notes/file?path=        → 读取指定 .md 文件内容
PUT    /api/notes/file              → 保存文件内容 { path, content }
POST   /api/notes/file              → 新建文件 { path }（内容为空）
POST   /api/notes/folder            → 新建文件夹 { path }
PUT    /api/notes/rename            → 重命名 { oldPath, newPath }
DELETE /api/notes/file?path=        → 删除文件
DELETE /api/notes/folder?path=      → 删除文件夹（含子内容，需二次确认）
```

**安全约束：** 所有路径操作必须在配置的 vault 根路径内，防止路径穿越攻击（`Path.normalize` 后校验前缀）。

### 13.4 前端组件结构

```
NotesPage
├── NotesFileTree（左侧，240px 固定宽，可折叠侧边栏）
│   ├── 搜索框（文件名过滤）
│   ├── 新建文件 / 新建文件夹按钮
│   └── 文件树（递归 FileTreeNode，支持右键菜单：重命名/删除）
└── NotesEditor（右侧，flex-1）
    ├── 工具栏（当前文件路径 + 保存状态 chip + 模式切换）
    └── MDEditor（@uiw/react-md-editor，高度 fill viewport）

空状态（未选中文件）：
    → 居中提示"选择左侧文件开始阅读或编辑"
```

### 13.5 移动端适配

- 文件树默认收起，顶部 Hamburger 按钮展开为底部 Sheet 抽屉
- 编辑器在移动端默认预览模式，点击编辑图标切换编辑模式
- 参照 AGENTS.md 响应式规范，复杂视图拆 `NotesDesktopView` / `NotesMobileView`

---

## 14. 待决定的技术细节（实施阶段补充）

- [ ] MarkItDown Service 是独立容器还是集成进 Crawl4AI 容器
- [ ] AnythingLLM API 鉴权方式（Bearer Token）
- [ ] Obsidian vault 挂载方式（Docker volume / 本地路径）
- [ ] 长文档分块的具体参数（chunk size、overlap）
- [ ] Crawl4AI 异步任务回调方式（轮询 vs WebSocket）
- [ ] Master Note 版本历史是否保留（git 管理 vault？）
