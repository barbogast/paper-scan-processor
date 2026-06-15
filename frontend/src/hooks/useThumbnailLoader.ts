import { useRef, useState, useEffect } from 'react'
import { VirtualItem } from '@tanstack/react-virtual'
import { RenderPage } from '../../wailsjs/go/main/App'

interface ThumbnailLoader {
  getSrc: (page: number) => string | undefined
  isLoading: (page: number) => boolean
  isFailed: (page: number) => boolean
  invalidate: () => void
}

export function useThumbnailLoader(
  pdfPath: string,
  thumbWidth: number,
  virtualItems: VirtualItem[],
): ThumbnailLoader {
  const cacheRef = useRef(new Map<number, string>())
  const loadingRef = useRef(new Set<number>())
  const failedRef = useRef(new Set<number>())
  // Refs don't trigger re-renders; setTick nudges React after mutating them.
  const [, setTick] = useState(0)

  const invalidate = () => {
    cacheRef.current.clear()
    loadingRef.current.clear()
    failedRef.current.clear()
    setTick(t => t + 1)
  }

  // Invalidate when the PDF changes
  useEffect(() => {
    invalidate()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfPath])

  // Load thumbnails for currently visible items — runs after every render so it
  // picks up new virtual items as the user scrolls without needing a dep array.
  useEffect(() => {
    for (const item of virtualItems) {
      const page = item.index + 1
      if (cacheRef.current.has(page) || loadingRef.current.has(page) || failedRef.current.has(page)) continue
      loadingRef.current.add(page)
      RenderPage(pdfPath, page, thumbWidth)
        .then((b64: string) => {
          cacheRef.current.set(page, `data:image/png;base64,${b64}`)
          loadingRef.current.delete(page)
          setTick(t => t + 1)
        })
        .catch((err: unknown) => {
          console.error(`RenderPage failed for page ${page}:`, err)
          loadingRef.current.delete(page)
          failedRef.current.add(page)
          setTick(t => t + 1)
        })
    }
  })

  return {
    getSrc: (page) => cacheRef.current.get(page),
    isLoading: (page) => loadingRef.current.has(page),
    isFailed: (page) => failedRef.current.has(page),
    invalidate,
  }
}
