// Crawl 页面类型定义

/** Crawl 操作结果（网页爬取或文件上传后返回） */
export interface CrawlResult {
  docId: number
  processedMinioKey: string
  markdownPreview: string
}

/** Mindbank 文档记录（对应后端 MindBankDocument entity） */
export interface MindBankDocument {
  id: number
  workspaceId: number | null
  fileName: string
  sourceType: 'crawl_web' | 'crawl_file'
  originalMinioKey: string
  processedMinioKey: string | null
  contentTypeTag: string | null
  pipelineStatus: string
  step1Status: string
  step2Status: string
  step3Status: string
  step4Status: string
  step5Status: string
  stepErrorMsg: string | null
  sessionNotePath: string | null
  promptTemplateId: number | null
  createdAt: string
  updatedAt: string
}

/** Mindbank Workspace（导入弹窗用） */
export interface MindBankWorkspace {
  id: number
  name: string
  domainTag: string | null
  anythingllmSlug: string | null
  description: string | null
  masterNotePath: string | null
  anythingllmDocId: string | null
  createdAt: string
  updatedAt: string
}

/** 导入到 Mindbank 的请求体 */
export interface ImportToMindbankRequest {
  docId: number
  workspaceId: number
}
