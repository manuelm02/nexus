// Notes 页面类型定义

/** 文件树节点，对应 vault 中的目录或 .md 文件 */
export interface FileTreeNode {
  /** 显示名（文件名或目录名） */
  name: string
  /** 相对于 vault 根路径的相对路径，前端操作的唯一标识 */
  path: string
  /** "file" 或 "folder" */
  type: 'file' | 'folder'
  /** 子节点列表，仅 folder 类型有值 */
  children?: FileTreeNode[]
}

/** 读取文件内容响应 */
export interface NoteFileContent {
  content: string
}
