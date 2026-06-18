import { useEffect, useState } from 'react'
import * as pageCache from './pageCache'

export interface PageLoader {
  getSrc: (page: number) => string | undefined
  isLoading: (page: number) => boolean
  isFailed: (page: number) => boolean
  load: (page: number, width: number) => void
  invalidate: () => void
}

export function usePageLoader(pdfPath: string): PageLoader {
  const [, setTick] = useState(0)

  useEffect(() => pageCache.subscribe(() => setTick(t => t + 1)), [])

  return {
    getSrc: (page) => pageCache.getSrc(pdfPath, page),
    isLoading: (page) => pageCache.isLoading(pdfPath, page),
    isFailed: (page) => pageCache.isFailed(pdfPath, page),
    load: (page, width) => pageCache.load(pdfPath, page, width),
    invalidate: () => pageCache.evict(pdfPath),
  }
}
