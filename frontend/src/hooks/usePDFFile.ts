import { useState } from 'react'
import { OpenPDF, PageCount } from '../../wailsjs/go/main/App'

export interface PDFFile {
  path: string | null
  count: number
  skipped: Set<number>
  load: () => Promise<boolean>
  toggleSkip: (page: number) => void
}

export function usePDFFile(): PDFFile {
  const [path, setPath] = useState<string | null>(null)
  const [count, setCount] = useState(0)
  const [skipped, setSkipped] = useState<Set<number>>(() => new Set())

  const load = async () => {
    const p = await OpenPDF()
    if (!p) return false
    const c = await PageCount(p)
    setPath(p)
    setCount(c)
    setSkipped(new Set())
    return true
  }

  const toggleSkip = (page: number) => {
    setSkipped(prev => {
      const next = new Set(prev)
      if (next.has(page)) next.delete(page); else next.add(page)
      return next
    })
  }

  return { path, count, skipped, load, toggleSkip }
}
