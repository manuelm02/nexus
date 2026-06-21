import { useState, useRef } from 'react'
import { UploadCloud, FileText, ChevronDown, ChevronUp } from 'lucide-react'

type FileUploadTabProps = {
  onUpload: (file: File) => void
  isPending: boolean
  error: string | null
  result: string | null
}

// FileUploadTab 支持拖拽和点击选择文件上传，转换为 Markdown 后展示预览。
// 桌面端优先拖拽交互，移动端通过 hidden input + click 触发文件选择。
export function FileUploadTab({ onUpload, isPending, error, result }: FileUploadTabProps) {
  const [dragOver, setDragOver] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewExpanded, setPreviewExpanded] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = (file: File | undefined) => {
    if (!file) return
    setSelectedFile(file)
    onUpload(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    handleFile(e.dataTransfer.files[0])
  }

  return (
    <section className="nexus-surface space-y-4 p-4">
      <div className="flex items-center gap-2">
        <UploadCloud className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-extrabold text-foreground">文件上传</h2>
      </div>

      {/* 拖拽上传区（桌面端）/ 点击选择区（移动端） */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 transition-colors ${
          dragOver ? 'border-primary bg-primary/5' : 'border-border bg-muted/20 hover:border-primary/40'
        }`}
      >
        <UploadCloud className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-bold text-foreground">
          {isPending ? '上传转换中…' : '点击或拖拽文件到此处'}
        </p>
        <p className="text-xs text-muted-foreground">支持 PDF / DOCX / TXT / MD / 图片</p>
        {selectedFile && !isPending && (
          <p className="flex items-center gap-1 text-xs font-bold text-primary">
            <FileText className="h-3.5 w-3.5" /> {selectedFile.name}
          </p>
        )}
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.gif,.webp"
          onChange={(e) => handleFile(e.target.files?.[0])}
          disabled={isPending}
        />
      </div>

      {/* 错误提示 */}
      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive-soft px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}

      {/* Markdown 预览 */}
      {result && (
        <div className="rounded-xl border border-border bg-muted/30 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">Markdown 预览</span>
            <button
              type="button"
              onClick={() => setPreviewExpanded((v) => !v)}
              className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
            >
              {previewExpanded ? (
                <>收起 <ChevronUp className="h-3.5 w-3.5" /></>
              ) : (
                <>展开 <ChevronDown className="h-3.5 w-3.5" /></>
              )}
            </button>
          </div>
          <pre className={`whitespace-pre-wrap break-words text-xs leading-6 text-foreground ${previewExpanded ? '' : 'line-clamp-[10]'}`}>
            {result}
          </pre>
        </div>
      )}
    </section>
  )
}
