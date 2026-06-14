import { Tag } from 'lucide-react'
import { cn } from '../../../../lib/utils'
import type { NoteTagEntry } from '../../../../types/domain.types'

export type TagPickerProps = {
  /** 标签索引中的可选标签列表（来自 GET /inbox/notes/tags） */
  availableTags: NoteTagEntry[]
  selectedTags: string[]
  onChange: (tags: string[]) => void
  /** 选中数量上限；笔记录入场景传 1，汇总检索场景不传（不限制） */
  maxTags?: number
}

// 标签多选器：以 chip 形式展示标签索引中的标签，点击切换选中状态；
// 达到 maxTags 上限时，未选中的 chip 置为禁用，防止单篇笔记标签数超限。
export function TagPicker({ availableTags, selectedTags, onChange, maxTags }: TagPickerProps) {
  const toggleTag = (name: string) => {
    if (selectedTags.includes(name)) {
      onChange(selectedTags.filter((t) => t !== name))
      return
    }
    if (maxTags !== undefined && selectedTags.length >= maxTags) return
    onChange([...selectedTags, name])
  }

  if (availableTags.length === 0) {
    return <p className="text-xs text-muted-foreground">暂无可选标签，AI 整理后会自动生成</p>
  }

  const reachedLimit = maxTags !== undefined && selectedTags.length >= maxTags

  return (
    <div className="flex flex-wrap gap-1.5">
      {availableTags.map((tag) => {
        const selected = selectedTags.includes(tag.name)
        const disabled = !selected && reachedLimit
        return (
          <button
            key={tag.name}
            type="button"
            onClick={() => toggleTag(tag.name)}
            disabled={disabled}
            title={tag.description}
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors',
              selected
                ? 'bg-primary text-primary-foreground'
                : 'bg-accent text-accent-foreground hover:bg-accent/80',
              disabled && 'cursor-not-allowed opacity-40',
            )}
          >
            <Tag className="h-2.5 w-2.5" />
            {tag.name}
          </button>
        )
      })}
    </div>
  )
}
