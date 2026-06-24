import { useEffect, useRef, useState } from 'react'

/** 检测容器是否具有非零尺寸，用于延迟渲染 recharts 等依赖实际宽高的组件 */
export function useContainerReady<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setReady(width > 0 && height > 0)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return { ref, ready }
}
