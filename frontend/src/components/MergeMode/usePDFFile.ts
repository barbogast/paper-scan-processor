import { useState } from 'react'
import { OpenPDF, PageCount } from '../../../wailsjs/go/main/App'
import { evict } from '../../lib/pageCache'

export interface PDFFile {
  path: string | null
  count: number
  skipped: Set<number>
  rotations: Map<number, number>
  load: () => Promise<boolean>
  toggleSkip: (page: number) => void
  rotate: (page: number, delta?: 90 | -90) => void
}

export function usePDFFile(): PDFFile {
  const [path, setPath] = useState<string | null>(null)
  const [count, setCount] = useState(0)
  const [skipped, setSkipped] = useState<Set<number>>(() => new Set())
  const [rotations, setRotations] = useState<Map<number, number>>(() => new Map())

  const load = async () => {
    const p = await OpenPDF()
    if (!p) return false
    const c = await PageCount(p)
    if (path) evict(path)
    setPath(p)
    setCount(c)
    setSkipped(new Set())
    setRotations(new Map())
    return true
  }

  const toggleSkip = (page: number) => {
    setSkipped(prev => {
      const next = new Set(prev)
      if (next.has(page)) next.delete(page); else next.add(page)
      return next
    })
  }

  const rotate = (page: number, delta: 90 | -90 = 90) => {
    setRotations(prev => {
      const next = new Map(prev)
      const deg = ((next.get(page) ?? 0) + delta + 360) % 360
      if (deg === 0) next.delete(page); else next.set(page, deg)
      return next
    })
  }

  return { path, count, skipped, rotations, load, toggleSkip, rotate }
}
