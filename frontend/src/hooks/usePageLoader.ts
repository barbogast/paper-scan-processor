import { useRef, useState, useEffect } from 'react'
import { RenderPage } from '../../wailsjs/go/main/App'

interface PageLoader {
  getSrc: (page: number) => string | undefined
  isLoading: (page: number) => boolean
  isFailed: (page: number) => boolean
  load: (page: number) => void
  invalidate: () => void
}

export function usePageLoader(pdfPath: string, widthPx: number): PageLoader {
  const cacheRef = useRef(new Map<number, string>())
  const loadingRef = useRef(new Set<number>())
  const failedRef = useRef(new Set<number>())
  const [, setTick] = useState(0)

  const invalidate = () => {
    cacheRef.current.clear()
    loadingRef.current.clear()
    failedRef.current.clear()
    setTick(t => t + 1)
  }

  useEffect(() => {
    invalidate()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfPath])

  const load = (page: number) => {
    if (cacheRef.current.has(page) || loadingRef.current.has(page) || failedRef.current.has(page)) return
    loadingRef.current.add(page)
    RenderPage(pdfPath, page, widthPx)
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

  return {
    getSrc: (page) => cacheRef.current.get(page),
    isLoading: (page) => loadingRef.current.has(page),
    isFailed: (page) => failedRef.current.has(page),
    load,
    invalidate,
  }
}
