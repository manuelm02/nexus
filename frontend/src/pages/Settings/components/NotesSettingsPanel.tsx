import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, Loader2, Save, FolderOpen } from 'lucide-react'
import { settingsApi } from '../../../api/settings.api'

const K_VAULT_PATH = 'notes.obsidian.vault_path'

// NotesSettingsPanel 配置 Notes 页面使用的 Obsidian vault 路径。
export function NotesSettingsPanel() {
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'notes'],
    queryFn: () => settingsApi.getNotesSettings(),
    select: (res) => res.data?.data ?? {},
  })

  const [draft, setDraft] = useState({ [K_VAULT_PATH]: '' })

  useEffect(() => {
    if (data) {
      setDraft({ [K_VAULT_PATH]: data[K_VAULT_PATH] ?? '' })
    }
  }, [data])

  const dirty = data ? draft[K_VAULT_PATH] !== (data[K_VAULT_PATH] ?? '') : false

  const saveMutation = useMutation({
    mutationFn: () => settingsApi.saveNotesSettings(draft),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['settings', 'notes'] }),
  })

  const handleCancel = () => {
    if (data) {
      setDraft({ [K_VAULT_PATH]: data[K_VAULT_PATH] ?? '' })
    }
  }

  if (isLoading) {
    return (
      <section className="nexus-surface space-y-4 p-4">
        <p className="text-sm text-muted-foreground">加载中…</p>
      </section>
    )
  }

  return (
    <section className="nexus-surface space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-foreground">Notes 设置</h2>
          <p className="mt-1 text-xs text-muted-foreground">配置 Notes 页面使用的 Obsidian vault 路径。</p>
        </div>
        {dirty && (
          <span className="rounded-md bg-warning-soft px-2 py-1 text-xs font-bold text-warning">
            有未保存更改
          </span>
        )}
      </div>

      <div className="rounded-xl border border-border bg-muted/30 p-4">
        <div className="mb-3 flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-extrabold text-foreground">Obsidian Vault</h3>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-muted-foreground">Obsidian Vault 路径</label>
          <input
            type="text"
            value={draft[K_VAULT_PATH]}
            placeholder="/path/to/your/vault"
            onChange={(e) => setDraft({ [K_VAULT_PATH]: e.target.value })}
            className="nexus-input h-9 w-full px-3 text-sm"
          />
          <p className="text-xs text-muted-foreground">
            填写 Nexus 后端服务器上的 Obsidian vault 绝对路径。Notes 页面将直接展示该路径下的所有笔记文件。
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card/95 p-3 shadow-[var(--shadow-xs)]">
        <button
          type="button"
          onClick={() => saveMutation.mutate()}
          disabled={!dirty || saveMutation.isPending}
          className="nexus-button-primary inline-flex items-center gap-1.5 px-4 text-xs disabled:opacity-50"
        >
          {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saveMutation.isPending ? '保存中…' : '保存设置'}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={!dirty || saveMutation.isPending}
          className="nexus-button-utility px-4 text-xs disabled:opacity-50"
        >
          取消更改
        </button>
        {saveMutation.isError && (
          <span className="flex items-center gap-1 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5" /> 保存失败
          </span>
        )}
      </div>
    </section>
  )
}
