/**
 * Mindbank 模块 TypeScript 类型定义。
 * 与后端 DTO（WorkspaceResponse / MindBankDocumentResponse / CreateWorkspaceRequest 等）一一对应。
 */

/** Pipeline 步骤状态枚举 */
export type PipelineStepStatus = 'pending' | 'processing' | 'done' | 'failed'

/** Pipeline 整体状态枚举 */
export type PipelineStatus = 'pending' | 'processing' | 'done' | 'failed'

/** 文档来源类型 */
export type SourceType = 'crawl_web' | 'crawl_file'

/** Mindbank Workspace 详情 */
export interface Workspace {
  id: number
  name: string
  domainTag: string | null
  description: string | null
  /** AnythingLLM 工作空间标识，未联动成功时为 null */
  anythingllmSlug: string | null
  /** Obsidian vault 中的 Master Note 路径，Phase 6.6 写入 */
  masterNotePath: string | null
  /** 挂载的文档总数（含所有流水线状态） */
  documentCount: number
  createdAt: string
}

/** Mindbank 文档（流水线状态） */
export interface MindBankDocument {
  id: number
  workspaceId: number | null
  fileName: string
  sourceType: SourceType
  originalMinioKey: string | null
  processedMinioKey: string | null
  /** A/B/C/D/E/F 内容类型，Step 1 识别结果 */
  contentTypeTag: string | null
  pipelineStatus: PipelineStatus
  step1Status: PipelineStepStatus
  step2Status: PipelineStepStatus
  step3Status: PipelineStepStatus
  step4Status: PipelineStepStatus
  step5Status: PipelineStepStatus
  stepErrorMsg: string | null
  sessionNotePath: string | null
  promptTemplateId: number | null
  createdAt: string
  updatedAt: string
}

/** Pipeline 步骤元信息：序号、中文标签、英文标签（用于 tooltip） */
export interface PipelineStepDef {
  step: 1 | 2 | 3 | 4 | 5
  label: string
}

/** Pipeline 5 步定义：识别 → 整理 → 速记 → 写入 → 嵌入 */
export const PIPELINE_STEPS: PipelineStepDef[] = [
  { step: 1, label: '识别' },
  { step: 2, label: '整理' },
  { step: 3, label: '速记' },
  { step: 4, label: '写入' },
  { step: 5, label: '嵌入' },
]

/** 取得指定步骤的状态字段名 */
export function getStepStatusField(step: 1 | 2 | 3 | 4 | 5): keyof MindBankDocument {
  return `step${step}Status` as keyof MindBankDocument
}

/** 新建 Workspace 请求 */
export interface CreateWorkspaceRequest {
  name: string
  domainTag?: string
  description?: string
}

/** 更新 Workspace 请求（所有字段可选） */
export interface UpdateWorkspaceRequest {
  name?: string
  domainTag?: string
  description?: string
}

/** Mindbank 内部 Tab 枚举 */
export type MindBankTab = 'documents' | 'qa' | 'agent'

/** Mindbank 内部 Tab 标签与定义 */
export const MINDBANK_TABS: { key: MindBankTab; label: string }[] = [
  { key: 'documents', label: '文件/入库' },
  { key: 'qa', label: 'Q&A' },
  { key: 'agent', label: 'Agent 知识管家' },
]

/** Q&A 消息角色 */
export type QaMessageRole = 'user' | 'assistant'

/** Q&A 消息 */
export interface QaMessage {
  id: string
  role: QaMessageRole
  content: string
  sources?: string[]
}

/** Prompt 模板类型 */
export type PromptType = 'organize_init' | 'organize_merge' | 'session_note' | 'classify_folder'

/** Prompt 模板 */
export interface PromptTemplate {
  id: number
  name: string
  promptType: PromptType
  content: string
  defaultFlag: boolean
  builtinFlag: boolean
  createdAt: string
  updatedAt: string
}

/** 创建 Prompt 模板请求 */
export interface CreatePromptTemplateRequest {
  name: string
  promptType: PromptType
  content: string
  defaultFlag?: boolean
}

/** 更新 Prompt 模板请求 */
export interface UpdatePromptTemplateRequest {
  name?: string
  content?: string
  defaultFlag?: boolean
}

/** Prompt 模板类型中文映射 */
export const PROMPT_TYPE_LABELS: Record<PromptType, string> = {
  organize_init: '初始整理',
  organize_merge: '融合更新',
  session_note: '导入速记',
  classify_folder: '文件夹分类',
}

/** 各模板类型可用变量 */
export const PROMPT_TYPE_VARIABLES: Record<PromptType, string[]> = {
  organize_init: ['{content}', '{source_url}', '{timestamp}', '{workspace_name}'],
  organize_merge: ['{master_note}', '{new_content}', '{document_name}', '{timestamp}', '{workspace_name}'],
  session_note: ['{content}', '{document_name}', '{date}', '{workspace_name}', '{source_url}', '{master_note_path}'],
  classify_folder: ['{existing_folders}', '{workspace_name}', '{domain_tag}', '{summary}'],
}
