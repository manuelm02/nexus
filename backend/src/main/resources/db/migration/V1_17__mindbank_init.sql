-- V1_17: Mindbank Phase 6 基础设施表
-- 注意：与 V1_3 的 mindbank_docs 表不同，本批表服务于 Phase 6 的 Workspace/Pipeline/Prompt 模板体系。

-- Workspace 表（对应 AnythingLLM workspace）
CREATE TABLE mindbank_workspaces (
    id                  BIGSERIAL PRIMARY KEY,
    name                VARCHAR(100) NOT NULL,
    domain_tag          VARCHAR(50),
    anythingllm_slug    VARCHAR(100),
    description         TEXT,
    master_note_path    VARCHAR(500),
    anythingllm_doc_id  VARCHAR(200),
    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 文档记录表（每次通过 Crawl 或 Mindbank 导入的文件）
CREATE TABLE mindbank_documents (
    id                  BIGSERIAL PRIMARY KEY,
    workspace_id        BIGINT REFERENCES mindbank_workspaces(id) ON DELETE SET NULL,
    file_name           VARCHAR(255) NOT NULL,
    source_type         VARCHAR(20) NOT NULL,   -- 'crawl_web' | 'crawl_file'
    original_minio_key  VARCHAR(500) NOT NULL,  -- MinIO key（originals/...）
    processed_minio_key VARCHAR(500),           -- MinIO key（processed/...）
    content_type_tag    VARCHAR(10),            -- Step1: A/B/C/D/E/F
    pipeline_status     VARCHAR(20) NOT NULL DEFAULT 'pending',
    step1_status        VARCHAR(20) NOT NULL DEFAULT 'pending',
    step2_status        VARCHAR(20) NOT NULL DEFAULT 'pending',
    step3_status        VARCHAR(20) NOT NULL DEFAULT 'pending',
    step4_status        VARCHAR(20) NOT NULL DEFAULT 'pending',
    step5_status        VARCHAR(20) NOT NULL DEFAULT 'pending',
    step_error_msg      TEXT,
    session_note_path   VARCHAR(500),
    prompt_template_id  BIGINT,
    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Prompt 模板表
CREATE TABLE mindbank_prompt_templates (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    prompt_type VARCHAR(30) NOT NULL,   -- 'organize_init' | 'organize_merge' | 'session_note' | 'classify_folder'
    content     TEXT NOT NULL,
    is_default  BOOLEAN NOT NULL DEFAULT FALSE,
    is_builtin  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 内置 Prompt 模板初始数据
INSERT INTO mindbank_prompt_templates (name, prompt_type, is_default, is_builtin, content) VALUES
('通用知识整理（初始）', 'organize_init', true, true, '你是专业的知识整理助手。将以下材料整理为结构清晰的知识笔记。

【原则】按知识点逻辑重组，保留所有细节，每个知识点说清楚是什么/为什么重要/怎么用。专业术语保留英文并附中文解释。

【格式】
# {title}

## 核心主旨

## 知识地图

## {知识点}
### 定义与概念
### 核心要点
### 示例/应用

## 关键结论

## 延伸思考

---
来源：{source_url}
创建：{timestamp}
Workspace：{workspace_name}
v1 — 初始创建'),
('通用知识融合（更新）', 'organize_merge', true, true, '你是专业知识整合助手。将新材料知识融合进已有主笔记。

【已有主笔记】
{master_note}

【新材料】
{new_content}

【融合原则】新概念新增章节；补充已有内容；与已有内容矛盾时标注[更新]；不删减已有内容；更新知识地图索引。输出完整更新后笔记。

文尾追加：
> 本次更新：融合了 {document_name}（{timestamp}），新增/扩展了...'),
('导入速记', 'session_note', true, true, '基于以下材料，生成本次导入速记（300字内）。

【格式】
## {title} — 导入速记
**来源：** {document_name}
**日期：** {date}
**Workspace：** {workspace_name}

### 核心贡献
-
-

### 关键结论

---
原始：{source_url}
主笔记：{master_note_path}'),
('文件夹分类', 'classify_folder', true, true, '根据笔记信息选择 Obsidian 子文件夹。

现有文件夹：{existing_folders}

Workspace：{workspace_name}
领域：{domain_tag}
主旨：{summary}

优先匹配现有文件夹，无匹配则建议新名称（中文4字内）。只返回文件夹名。');
